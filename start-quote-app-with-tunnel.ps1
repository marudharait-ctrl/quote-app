# Start the WovenBag Quote System and Cloudflare Tunnel

# Start the Node.js app in a new PowerShell window
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd 'C:\Users\User\Documents\quote-app'; npm start"

# Give the app a few seconds to boot
Start-Sleep -Seconds 5

# Log file for the tunnel URL/output
$logPath = 'C:\Users\User\Documents\quote-app\tunnel-log.txt'

# Start Cloudflare Tunnel in another PowerShell window and log its output
$cfCommand = "cd 'C:\Users\User\Downloads'; .\cloudflared.exe tunnel --url http://localhost:3000 2>&1 | Tee-Object -FilePath '$logPath' -Append"
Start-Process powershell -ArgumentList '-NoExit', '-Command', $cfCommand

Write-Host "Cloudflare tunnel output is being logged to $logPath"