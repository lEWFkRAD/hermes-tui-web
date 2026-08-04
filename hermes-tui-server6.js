const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 9092);
const HERMES_HOME = path.join('C:', 'Users', 'Administrator', 'AppData', 'Local', 'hermes');

function readAsset(fileName, packagePath) {
    const candidates = [
        path.join(__dirname, 'static', fileName),
        path.join(__dirname, 'node_modules', packagePath),
        path.join(HERMES_HOME, 'static', fileName)
    ];
    const assetPath = candidates.find(candidate => fs.existsSync(candidate));
    if (!assetPath) {
        throw new Error(`Missing ${fileName}; run npm install or provide static/${fileName}`);
    }
    return fs.readFileSync(assetPath, 'utf8');
}

// Embed terminal assets at startup so the phone never depends on a CDN.
const XTERM_JS = readAsset('xterm.min.js', path.join('xterm', 'lib', 'xterm.js'));
const XTERM_FIT_JS = readAsset('xterm-addon-fit.min.js', path.join('xterm-addon-fit', 'lib', 'xterm-addon-fit.js'));

// HTML template with embedded JS
const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Hermes TUI</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { height: 100%; overflow: hidden; background: #000000; font-family: 'Courier New', monospace; }
        .xterm { cursor: text; position: relative; user-select: none; -webkit-user-select: none; }
        .xterm.focus, .xterm:focus { outline: none; }
        .xterm .xterm-helpers { position: absolute; top: 0; z-index: 5; }
        .xterm .xterm-helper-textarea { position: absolute; opacity: 0; left: -9999em; top: 0; width: 0; height: 0; z-index: -5; white-space: nowrap; overflow: hidden; resize: none; }
        .xterm .xterm-char-measure-element { display: inline-block; visibility: hidden; position: absolute; top: 0; left: -9999em; line-height: normal; }
        .xterm .xterm-viewport { background-color: #000; overflow-y: scroll; cursor: default; position: absolute; inset: 0; }
        .xterm .xterm-screen { position: relative; }
        .xterm .xterm-screen canvas { position: absolute; left: 0; top: 0; }
        .xterm .xterm-scroll-area { visibility: hidden; }
        #terminal { width: 100vw; height: 100vh; font-size: 14px; line-height: 1.2; color: #00ff00; background: #000000; }
        .header { position: fixed; top: 0; left: 0; right: 0; background: rgba(0,0,0,0.9); color: #00ff00; padding: 8px 12px; font-size: 12px; z-index: 1000; border-bottom: 1px solid #00ff00; display: flex; justify-content: space-between; align-items: center; }
        .header .status { display: flex; gap: 10px; align-items: center; }
        .header .dot { width: 8px; height: 8px; border-radius: 50%; background: #00ff00; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
        .header .model { color: #ff00ff; }
        .header .skin { color: #ffff00; }
        .terminal-container { position: fixed; top: 36px; left: 0; right: 0; bottom: 0; overflow: hidden; }
        @media (max-width: 768px) { #terminal { font-size: 12px; line-height: 1.1; } .header { font-size: 10px; padding: 6px 10px; } }
        @media (max-width: 480px) { #terminal { font-size: 10px; line-height: 1.1; } .header { font-size: 9px; padding: 4px 8px; } }
        ::-webkit-scrollbar { display: none; }
    </style>
</head>
<body>
    <div class="header">
        <span>Hermes TUI</span>
        <div class="status">
            <span class="dot"></span>
            <span class="model">laguna-s-2.1</span>
            <span class="skin">neon-ghost</span>
        </div>
    </div>
    <div class="terminal-container">
        <div id="terminal"></div>
    </div>
    <script>${XTERM_JS}</script>
    <script>${XTERM_FIT_JS}</script>
    <script>
        const term = new Terminal({
            cursorBlink: true,
            theme: { background: '#000000', foreground: '#00ff00', cursor: '#00ff00', cursorAccent: '#000000' },
            fontFamily: 'Menlo, Consolas, monospace',
            // Keep portrait phones in Hermes's simpler branding tier. Wider
            // Unicode art can drift because browser terminals disagree about
            // ambiguous-width glyphs.
            fontSize: window.innerWidth <= 768 ? 11 : 13,
            lineHeight: 1.1,
            scrollback: 10000,
            convertLinks: false
        });
        const fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        term.open(document.getElementById('terminal'));
        fitAddon.fit();
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = protocol + '//' + window.location.host + '/ws/hermes-tui/pty?cols=' + term.cols + '&rows=' + term.rows;
        const socket = new WebSocket(wsUrl);
        socket.binaryType = 'arraybuffer';
        socket.onopen = function() { socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })); };
        socket.onmessage = function(event) {
            if (event.data instanceof ArrayBuffer) {
                const decoder = new TextDecoder('utf-8');
                term.write(decoder.decode(event.data));
            } else if (event.data instanceof Blob) {
                event.data.arrayBuffer().then(function(data) {
                    term.write(new TextDecoder('utf-8').decode(data));
                });
            } else {
                term.write(event.data);
            }
        };
        socket.onclose = function() { term.writeln('\\r\\n\\x1b[31m[Connection closed]\\x1b[0m'); };
        term.onData(function(data) { if (socket.readyState === WebSocket.OPEN) { socket.send(data); } });
        window.addEventListener('resize', function() { fitAddon.fit(); if (socket.readyState === WebSocket.OPEN) { socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })); } });
        document.addEventListener('paste', function(e) { const text = e.clipboardData.getData('text/plain'); term.write(text); });
        document.getElementById('terminal').addEventListener('click', function() { term.focus(); });
        if ('ontouchstart' in window) { document.getElementById('terminal').addEventListener('touchstart', function(e) { term.focus(); }); }
    </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
    let urlPath = req.url;
    if (urlPath === '/' || urlPath === '/s/hermes-tui') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(HTML_PAGE);
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

const wss = new WebSocket.Server({ server, path: '/ws/hermes-tui/pty' });
wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const cols = url.searchParams.get('cols') || 120;
    const rows = url.searchParams.get('rows') || 40;
    const webttyWs = new WebSocket(`ws://127.0.0.1:2346/ws/hermes-tui/pty?cols=${cols}&rows=${rows}`);
    webttyWs.on('open', () => {
        ws.on('message', (data) => { webttyWs.send(data); });
        webttyWs.on('message', (data, isBinary) => {
            // ws represents text frames as Buffer objects. Preserve the frame
            // type so browsers do not receive terminal text as binary blobs.
            ws.send(isBinary ? data : data.toString('utf8'), { binary: isBinary });
        });
        ws.on('close', () => { webttyWs.close(); });
        webttyWs.on('close', () => { ws.close(); });
    });
    webttyWs.on('error', (err) => { ws.close(); });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running on port ${PORT}`);
});
