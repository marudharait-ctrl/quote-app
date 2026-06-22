param(
  [string]$BackupRoot = "G:\My Drive\Marudhara Quote App Backups",
  [string]$AppRoot = "C:\Users\User\Documents\quote-app",
  [string]$CloudflaredRoot = "C:\Users\User\.cloudflared",
  [ValidateSet("daily", "weekly", "monthly", "manual")]
  [string]$BackupType = "daily",
  [int]$DailyRetentionDays = 14,
  [int]$WeeklyRetentionDays = 56,
  [int]$MonthlyRetentionDays = 365
)

$ErrorActionPreference = "Stop"

function Get-FileSha256 {
  param([Parameter(Mandatory = $true)][string]$Path)
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Copy-IfExists {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  if (Test-Path -LiteralPath $Source) {
    $parent = Split-Path -Parent $Destination
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    return $true
  }

  return $false
}

function Assert-SqliteFile {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (!(Test-Path -LiteralPath $Path)) {
    throw "Database not found: $Path"
  }

  if ((Get-Item -LiteralPath $Path).Length -le 0) {
    throw "Database is empty: $Path"
  }

  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $headerLength = [Math]::Min(16, $bytes.Length)
  $header = [System.Text.Encoding]::ASCII.GetString($bytes, 0, $headerLength)
  if ($header -ne "SQLite format 3`0") {
    throw "Database header is not SQLite format 3: $Path"
  }
}

if (!(Test-Path -LiteralPath $AppRoot)) {
  throw "App root does not exist: $AppRoot"
}

if (!(Test-Path -LiteralPath $BackupRoot)) {
  New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
$backupTypeRoot = Join-Path $BackupRoot $BackupType
$archiveName = "maruquote-backup-$timestamp.zip"
$archivePath = Join-Path $backupTypeRoot $archiveName
$stagingRoot = Join-Path $env:TEMP "maruquote-backup-$timestamp"
$dbPath = Join-Path $AppRoot "data\quotes.db"
$logPath = Join-Path $BackupRoot "backup-log.txt"

New-Item -ItemType Directory -Force -Path $backupTypeRoot | Out-Null
if (Test-Path -LiteralPath $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null

Assert-SqliteFile -Path $dbPath

$items = @(
  @{ Source = "data\quotes.db"; Destination = "data\quotes.db"; Required = $true },
  @{ Source = "package.json"; Destination = "package.json"; Required = $true },
  @{ Source = "package-lock.json"; Destination = "package-lock.json"; Required = $false },
  @{ Source = "README.md"; Destination = "README.md"; Required = $false },
  @{ Source = "setup.js"; Destination = "setup.js"; Required = $false },
  @{ Source = "start-quote-app-stable.ps1"; Destination = "start-quote-app-stable.ps1"; Required = $false },
  @{ Source = "start-maruquote-tunnel-stable.ps1"; Destination = "start-maruquote-tunnel-stable.ps1"; Required = $false },
  @{ Source = "start-quote-app-with-tunnel.ps1"; Destination = "start-quote-app-with-tunnel.ps1"; Required = $false }
)

foreach ($item in $items) {
  $source = Join-Path $AppRoot $item.Source
  $destination = Join-Path $stagingRoot $item.Destination
  $copied = Copy-IfExists -Source $source -Destination $destination
  if (!$copied -and $item.Required) {
    throw "Required backup file missing: $source"
  }
}

foreach ($dir in @("src", "views", "public", "docs")) {
  $source = Join-Path $AppRoot $dir
  $destination = Join-Path $stagingRoot $dir
  if (Test-Path -LiteralPath $source) {
    Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
  }
}

$cloudflaredBackupDir = Join-Path $stagingRoot "private\cloudflared"
$cloudflaredConfigPath = Join-Path $CloudflaredRoot "config.yml"
if (Copy-IfExists -Source $cloudflaredConfigPath -Destination (Join-Path $cloudflaredBackupDir "config.yml")) {
  $configText = Get-Content -Raw -LiteralPath $cloudflaredConfigPath
  $credentialMatches = [regex]::Matches($configText, '(?im)^\s*credentials-file:\s*(.+?)\s*$')
  foreach ($match in $credentialMatches) {
    $credentialPath = $match.Groups[1].Value.Trim().Trim('"')
    if ($credentialPath -and (Test-Path -LiteralPath $credentialPath)) {
      Copy-IfExists -Source $credentialPath -Destination (Join-Path $cloudflaredBackupDir (Split-Path -Leaf $credentialPath)) | Out-Null
    }
  }
}

$relativeFiles = Get-ChildItem -LiteralPath $stagingRoot -File -Recurse | ForEach-Object {
  $relativePath = $_.FullName.Substring($stagingRoot.Length).TrimStart('\')
  [pscustomobject]@{
    path = $relativePath.Replace('\', '/')
    bytes = $_.Length
    sha256 = Get-FileSha256 -Path $_.FullName
  }
} | Sort-Object path

$gitCommit = $null
try {
  $gitCommit = (git -C $AppRoot rev-parse HEAD 2>$null).Trim()
} catch {
  $gitCommit = $null
}

$manifest = [ordered]@{
  app = "quote-app"
  createdAt = (Get-Date).ToUniversalTime().ToString("o")
  backupType = $BackupType
  sourceMachine = $env:COMPUTERNAME
  appRoot = $AppRoot
  backupRoot = $BackupRoot
  databasePath = "data/quotes.db"
  gitCommit = $gitCommit
  files = $relativeFiles
}

$manifestPath = Join-Path $stagingRoot "manifest.json"
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Assert-SqliteFile -Path (Join-Path $stagingRoot "data\quotes.db")
$stagingItems = Get-ChildItem -LiteralPath $stagingRoot -Force
Compress-Archive -LiteralPath $stagingItems.FullName -DestinationPath $archivePath -CompressionLevel Optimal -Force

if (!(Test-Path -LiteralPath $archivePath)) {
  throw "Backup archive was not created: $archivePath"
}

$archiveHash = Get-FileSha256 -Path $archivePath
$message = "$(Get-Date -Format s) OK $BackupType $archivePath SHA256=$archiveHash"
Add-Content -LiteralPath $logPath -Value $message

$retentionDays = switch ($BackupType) {
  "daily" { $DailyRetentionDays }
  "weekly" { $WeeklyRetentionDays }
  "monthly" { $MonthlyRetentionDays }
  default { 0 }
}

if ($retentionDays -gt 0) {
  $cutoff = (Get-Date).AddDays(-$retentionDays)
  Get-ChildItem -LiteralPath $backupTypeRoot -Filter "maruquote-backup-*.zip" -File |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    Remove-Item -Force
}

Remove-Item -LiteralPath $stagingRoot -Recurse -Force

[pscustomobject]@{
  status = "OK"
  backupType = $BackupType
  archivePath = $archivePath
  archiveBytes = (Get-Item -LiteralPath $archivePath).Length
  sha256 = $archiveHash
  logPath = $logPath
} | ConvertTo-Json -Depth 4
