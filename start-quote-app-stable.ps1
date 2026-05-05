$ErrorActionPreference = 'Stop'
$projectDir = 'C:\Users\User\Documents\quote-app'
$logDir = Join-Path $projectDir 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Set-Location $projectDir

while ($true) {
  try {
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path (Join-Path $logDir 'quote-app-supervisor.log') -Value "[$ts] starting quote app"
    & node src/app.js 2>&1 | Tee-Object -FilePath (Join-Path $logDir 'quote-app.log') -Append
  } catch {
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path (Join-Path $logDir 'quote-app-supervisor.log') -Value "[$ts] app crashed: $($_.Exception.Message)"
  }
  Start-Sleep -Seconds 2
}
