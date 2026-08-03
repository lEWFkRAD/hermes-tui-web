# Hermes TUI Web

Host the Hermes TUI as a mobile-friendly web page accessible via Tailscale MagicDNS.

## Architecture

```
Phone → Tailscale Serve (:9093) → Node.js Server (:9092) → webtty (:2346) → node-pty → Hermes TUI
```

## Key Features

- **Embedded xterm.js** — No CDN dependencies. The entire terminal library is bundled in the HTML response.
- **Mobile-friendly** — Viewport meta tag, responsive font sizing, touch support.
- **Tailscale MagicDNS** — Access from anywhere on your tailnet.

## Prerequisites

- Hermes installed and configured
- webtty: `npm install -g webtty`
- node-pty, ws, xterm, xterm-addon-fit: `npm install node-pty ws xterm xterm-addon-fit`
- Tailscale running with MagicDNS

## Setup

1. Install dependencies:
   ```bash
   npm install -g webtty
   npm install node-pty ws xterm xterm-addon-fit
   ```

2. Start webtty and create a session:
   ```bash
   webtty start
   webtty go hermes-tui
   ```

3. Start the server:
   ```bash
   node hermes-tui-server6.js < /dev/null
   ```

4. Configure Tailscale Serve:
   ```bash
   tailscale serve --http=9093 http://127.0.0.1:9092
   ```

5. Access: `https://shatner.tail3bf242.ts.net:9093/s/hermes-tui`

## Files

- `hermes-tui-server6.js` — Node.js server with embedded xterm.js
- `hermes-pty.js` — node-pty wrapper for Hermes TUI
- `run-hermes-tui.bat` — Batch file to start Hermes TUI via node-pty

## License

MIT
