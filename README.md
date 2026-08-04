# Hermes TUI Web

Host the Hermes TUI as a phone-friendly terminal over a private Tailscale network.

## Architecture

```text
Phone
  -> Tailscale Serve HTTPS (:443)
  -> xterm.js frontend (127.0.0.1:9092)
  -> webtty PTY backend (127.0.0.1:2346)
  -> Hermes TUI
```

The frontend and PTY backend listen only on loopback. Tailscale Serve is the sole network-facing entry point.

## Why this design

- The browser sends its real column and row count before Hermes starts.
- There is only one PTY. A nested `node-pty` wrapper previously forced Hermes to 120x40 and corrupted narrow phone layouts.
- xterm.js handles Hermes's terminal control sequences more reliably than webtty's native Ghostty web renderer.
- WebSocket text frames stay text frames; ArrayBuffer and Blob payloads are also decoded safely.
- The terminal assets are embedded in the response, so the phone does not need a CDN.
- Portrait phones use a conservative font size that avoids ambiguous-width Unicode banner drift.
- The Visual Viewport API refits the terminal while the iPhone keyboard animates, scrolls to the prompt, and keeps the hidden input anchor inside the visible area.
- Apple standalone web-app metadata and a manifest allow a Home Screen launch without Safari's browser chrome.

## Prerequisites

- Windows with Hermes installed under `%LOCALAPPDATA%\hermes`
- Node.js
- Tailscale with MagicDNS enabled
- webtty installed globally: `npm install -g webtty`

Install the repository dependencies:

```powershell
npm install
```

## Files

- `hermes-tui-server6.js` — loopback xterm.js frontend and WebSocket proxy
- `run-hermes-tui.bat` — direct Hermes launcher with browser-hosted TUI flags
- `Start-Hermes-HostedTui.ps1` — idempotent scheduled-task launcher

`hermes-pty.js` is intentionally gone. webtty must own the only PTY so browser resize events reach Hermes.

## Setup

1. Copy `hermes-tui-server6.js` and `run-hermes-tui.bat` to `%LOCALAPPDATA%\hermes`.

2. Configure webtty's shell to use `run-hermes-tui.bat`, bind webtty to `127.0.0.1:2346`, and create the dormant session:

   ```powershell
   $env:WEBTTY_NO_OPEN = '1'
   webtty go hermes-tui
   ```

3. Start the frontend:

   ```powershell
   node "$env:LOCALAPPDATA\hermes\hermes-tui-server6.js"
   ```

4. Publish only the frontend through persistent HTTPS Serve:

   ```powershell
   tailscale serve --bg http://127.0.0.1:9092
   ```

5. Open the session from a tailnet device:

   ```text
   https://<machine-name>.<tailnet>.ts.net/s/hermes-tui
   ```

On SHATNER, the current URL is:

```text
https://shatner.tail3bf242.ts.net/s/hermes-tui
```

## iPhone full-screen mode

Safari cannot be forced into fullscreen from page JavaScript. Install the terminal as a Home Screen web app instead:

1. Open the URL in Safari.
2. Tap **More** or **Share**.
3. Tap **Add to Home Screen**.
4. Turn on **Open as Web App**.
5. Tap **Add**, then launch **Hermes TUI** from the new Home Screen icon.

The installed web app uses standalone display mode and removes Safari's address and tab bars. The iPhone status area remains under iOS control.

## Persistence

Create a scheduled task named `Hermes_Hosted_TUI` that runs `Start-Hermes-HostedTui.ps1` at boot and user logon. Configure it with `IgnoreNew`, no execution time limit, and restart-on-failure. The production task uses 999 one-minute restart attempts.

The script remains alive as a lightweight supervisor and checks loopback ports 2346 and 9092 every 15 seconds. If webtty exits, it recreates the dormant session with `WEBTTY_NO_OPEN=1`; if the xterm.js frontend exits, it restarts that process. Hermes itself still waits for the first browser connection so it receives the client's exact geometry.

## Verification

```powershell
# Expected listeners: 2346 and 9092 on 127.0.0.1, plus Tailscale HTTPS 443.
Get-NetTCPConnection -State Listen |
  Where-Object LocalPort -in 443,2346,9092 |
  Select-Object LocalAddress,LocalPort,OwningProcess

webtty ls
tailscale serve status

# Both paths should return HTTP 200.
curl.exe -I http://127.0.0.1:9092/s/hermes-tui
curl.exe -I https://shatner.tail3bf242.ts.net/s/hermes-tui
```

For mobile acceptance, test a portrait viewport near 390x844. The initial ConPTY width should match the browser (about 61 columns with the default phone font), and no 120-column `hermes-pty.js` process should exist.

For keyboard acceptance, reduce the visible viewport height while the terminal input is focused. `--app-height`, the terminal container, the prompt, and xterm's helper textarea should all remain within the visual viewport.

For recovery acceptance, stop webtty and the frontend separately. Each listener should return within approximately 15–30 seconds without manually rerunning the task.

## Security notes

- Keep ports 2346 and 9092 bound to loopback.
- Do not expose the Node server directly on `0.0.0.0`.
- Restrict the Tailscale endpoint with appropriate tailnet grants or ACLs.
- This is an Administrator terminal on SHATNER; tailnet access is the security boundary.

## Troubleshooting

- Corrupted narrow layout: ensure `run-hermes-tui.bat` invokes `hermes.exe` directly and no nested `node-pty` wrapper is running.
- Repeated `W` characters above the terminal: the xterm layout CSS is missing.
- Browser receives garbage or blank output: verify the WebSocket proxy preserves upstream text frame type.
- Old page persists on a phone: close the tab completely and reopen it to discard the cached terminal canvas.
- Duplicate ports return after cleanup: inspect Hermes cron jobs for an obsolete server watchdog before killing processes repeatedly.

## License

MIT
