$ErrorActionPreference = 'Stop'

$env:WEBTTY_NO_OPEN = '1'
$webtty = 'C:\Users\Administrator\AppData\Roaming\npm\webtty.cmd'
$node = 'C:\Program Files\nodejs\node.exe'
$proxy = 'C:\Users\Administrator\AppData\Local\hermes\hermes-tui-server6.js'

# `go` creates the named session without eagerly starting a fixed-size PTY.
# Hermes starts when the first browser connects, using that client's geometry.
& $webtty go hermes-tui
if ($LASTEXITCODE -ne 0) {
    throw "webtty failed with exit code $LASTEXITCODE"
}

if (-not (Get-NetTCPConnection -State Listen -LocalPort 9092 -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath $node -ArgumentList @($proxy) `
        -WorkingDirectory (Split-Path -Parent $proxy) -WindowStyle Hidden
}
