$ErrorActionPreference = 'Stop'

$env:WEBTTY_NO_OPEN = '1'
$webtty = 'C:\Users\Administrator\AppData\Roaming\npm\webtty.cmd'
$node = 'C:\Program Files\nodejs\node.exe'
$proxy = 'C:\Users\Administrator\AppData\Local\hermes\hermes-tui-server6.js'
$checkIntervalSeconds = 15

function Test-LocalListener([int]$Port) {
    return $null -ne (Get-NetTCPConnection -State Listen -LocalAddress '127.0.0.1' -LocalPort $Port -ErrorAction SilentlyContinue)
}

# Remain alive as the scheduled task's supervisor. Boot/logon triggers start
# this process, and IgnoreNew prevents a second copy from racing it.
while ($true) {
    try {
        if (-not (Test-LocalListener 2346)) {
            # `go` creates the named session without eagerly starting a
            # fixed-size PTY. Hermes starts at the first client's geometry.
            & $webtty go hermes-tui
            if ($LASTEXITCODE -ne 0) {
                throw "webtty session startup failed with exit code $LASTEXITCODE"
            }
        }

        if (-not (Test-LocalListener 9092)) {
            Start-Process -FilePath $node -ArgumentList @($proxy) `
                -WorkingDirectory (Split-Path -Parent $proxy) -WindowStyle Hidden
        }
    }
    catch {
        Write-Error "Hosted TUI supervisor check failed: $_" -ErrorAction Continue
    }

    Start-Sleep -Seconds $checkIntervalSeconds
}
