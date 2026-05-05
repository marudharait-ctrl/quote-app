$ErrorActionPreference = 'Stop'
$workDir = 'C:\Users\User\Downloads'
$logDir = 'C:\Users\User\Documents\quote-app\logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Set-Location $workDir

while ($true) {
  try {
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path (Join-Path $logDir 'maruquote-supervisor.log') -Value "[$ts] starting maruquote tunnel"
    & .\cloudflared.exe tunnel --config C:\Users\User\.cloudflared\config.yml run maruquote 2>&1 | Tee-Object -FilePath (Join-Path $logDir 'maruquote.log') -Append
  } catch {
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path (Join-Path $logDir 'maruquote-supervisor.log') -Value "[$ts] tunnel crashed: $($_.Exception.Message)"
  }
  Start-Sleep -Seconds 2
}
