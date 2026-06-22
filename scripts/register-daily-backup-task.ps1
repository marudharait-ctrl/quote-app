param(
  [string]$TaskName = "MaruQuote Daily Google Drive Backup",
  [string]$AppRoot = "C:\Users\User\Documents\quote-app",
  [string]$BackupRoot = "G:\My Drive\Marudhara Quote App Backups",
  [string]$At = "02:00"
)

$ErrorActionPreference = "Stop"

$backupScript = Join-Path $AppRoot "scripts\backup-quote-app.ps1"
if (!(Test-Path -LiteralPath $backupScript)) {
  throw "Backup script not found: $backupScript"
}

$time = [datetime]::ParseExact($At, "HH:mm", $null)
$actionArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`" -BackupRoot `"$BackupRoot`" -BackupType daily"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $actionArgs -WorkingDirectory $AppRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Daily quote app backup to Google Drive." -Force | Out-Null

[pscustomobject]@{
  status = "REGISTERED"
  taskName = $TaskName
  dailyAt = $At
  backupScript = $backupScript
  backupRoot = $BackupRoot
} | ConvertTo-Json -Depth 4
