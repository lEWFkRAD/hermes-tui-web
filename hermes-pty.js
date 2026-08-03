const { spawn } = require('node-pty');
const path = require('path');

const hermesPath = path.join('C:', 'Users', 'Administrator', 'AppData', 'Local', 'hermes', 'hermes-agent', 'venv', 'Scripts', 'hermes.exe');

const shell = spawn(hermesPath, ['chat', '--tui'], {
    name: 'xterm-256color',
    cols: 120,
    rows: 40,
    cwd: path.join('C:', 'Users', 'Administrator'),
    env: {
        ...process.env,
        HERMES_HOME: ''
    }
});

shell.on('data', (data) => {
    process.stdout.write(data);
});

shell.on('exit', (code) => {
    process.exit(code);
});

// Only set raw mode if stdin is a TTY
if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.on('data', (data) => {
        shell.write(data);
    });
} else {
    // Read from stdin as a stream
    process.stdin.on('data', (data) => {
        shell.write(data);
    });
}
