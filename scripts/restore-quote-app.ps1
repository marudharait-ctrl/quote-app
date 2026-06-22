param(
  [Parameter(Mandatory = $true)]
  [string]$BackupZip,
  [string]$AppRoot = "C:\Users\User\Documents\quote-app",
  [string]$CloudflaredRoot = "C:\Users\User\.cloudflared",
  [switch]$RestoreCloudflared,
  [switch]$Apply
)

$ErrorActionPreference = "Stop"

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

if (!(Test-Path -LiteralPath $BackupZip)) {
  throw "Backup zip not found: $BackupZip"
}

$timestamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
$extractRoot = Join-Path $env:TEMP "maruquote-restore-$timestamp"
if (Test-Path -LiteralPath $extractRoot) {
  Remove-Item -LiteralPath $extractRoot -Recurse -Force
}

Expand-Archive -LiteralPath $BackupZip -DestinationPath $extractRoot -Force

$restoredDb = Join-Path $extractRoot "data\quotes.db"
Assert-SqliteFile -Path $restoredDb

$liveDb = Join-Path $AppRoot "data\quotes.db"
$safetyCopy = Join-Path $AppRoot "data\quotes.before-restore-$timestamp.db"
$actions = @(
  "Validated backup database: $restoredDb",
  "Would copy live database to safety copy: $safetyCopy",
  "Would restore database to: $liveDb"
)

if ($RestoreCloudflared) {
  $backupCloudflared = Join-Path $extractRoot "private\cloudflared"
  if (Test-Path -LiteralPath $backupCloudflared) {
    $actions += "Would restore Cloudflare tunnel files from: $backupCloudflared"
  } else {
    $actions += "No Cloudflare tunnel files found in backup."
  }
}

if (!$Apply) {
  [pscustomobject]@{
    status = "DRY_RUN"
    message = "No live files changed. Re-run with -Apply to restore."
    actions = $actions
  } | ConvertTo-Json -Depth 4
  exit 0
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $liveDb) | Out-Null
if (Test-Path -LiteralPath $liveDb) {
  Copy-Item -LiteralPath $liveDb -Destination $safetyCopy -Force
}
Copy-Item -LiteralPath $restoredDb -Destination $liveDb -Force

if ($RestoreCloudflared) {
  $backupCloudflared = Join-Path $extractRoot "private\cloudflared"
  if (Test-Path -LiteralPath $backupCloudflared) {
    New-Item -ItemType Directory -Force -Path $CloudflaredRoot | Out-Null
    Copy-Item -LiteralPath (Join-Path $backupCloudflared "*") -Destination $CloudflaredRoot -Force
  }
}

[pscustomobject]@{
  status = "RESTORED"
  backupZip = $BackupZip
  liveDb = $liveDb
  safetyCopy = $safetyCopy
} | ConvertTo-Json -Depth 4
