param([string]$Exe,[string]$UserData,[string]$Fixed,[int]$Seconds=120)
$env:WEBVIEW2_USER_DATA_FOLDER = $UserData
if ($Fixed) { $env:WEBVIEW2_BROWSER_EXECUTABLE_FOLDER = $Fixed }
function Get-Tree($id) { $id; $all | Where-Object ParentProcessId -eq $id | ForEach-Object { Get-Tree $_.ProcessId } }
$proc = Start-Process -FilePath $Exe -WorkingDirectory (Split-Path $Exe) -PassThru
$seen = @{}; $paths=@{}
for ($t = 3; $t -le $Seconds; $t += 3) {
  Start-Sleep -Seconds 3
  $all = Get-CimInstance Win32_Process
  $ids = @(Get-Tree $proc.Id)
  $all | Where-Object { $ids -contains $_.ProcessId -and $_.Name -eq 'msedgewebview2.exe' } | ForEach-Object { $paths[$_.ExecutablePath] = 1 }
  Get-NetTCPConnection -OwningProcess $ids -ErrorAction SilentlyContinue |
    Where-Object { $_.RemoteAddress -notin '127.0.0.1','::1','0.0.0.0','::' } | ForEach-Object {
      $name = ($all | Where-Object ProcessId -eq $_.OwningProcess).Name
      $key = "$($_.RemoteAddress):$($_.RemotePort) $name"
      if (-not $seen.ContainsKey($key)) { $seen[$key] = $t; "+${t}s $key ($($_.State))" }
    }
}
"webview2 exe paths: " + (($paths.Keys) -join '; ')
"distinct non-local remote endpoints: $($seen.Count)"
$null = $proc.CloseMainWindow()
Start-Sleep -Seconds 10
"app still running after close: " + [bool](Get-Process -Id $proc.Id -ErrorAction SilentlyContinue)
