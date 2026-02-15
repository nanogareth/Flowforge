export function getTerminalHtml(wsUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5/css/xterm.min.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #0a0a0a; }
    #terminal { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="terminal"></div>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5/lib/xterm.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0/lib/addon-fit.min.js"></script>
  <script>
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0a0a0a',
        foreground: '#e6edf3',
        cursor: '#238636',
        selectionBackground: '#264f78',
        black: '#0a0a0a',
        red: '#f85149',
        green: '#238636',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39d353',
        white: '#e6edf3',
      },
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById('terminal'));
    fitAddon.fit();

    // WebSocket connection
    const ws = new WebSocket('${wsUrl}');
    let connected = false;

    // Android double-Enter debounce
    let lastEnterTime = 0;

    ws.onopen = () => {
      connected = true;
      // Send initial size
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'output':
            term.write(msg.data);
            break;
          case 'scrollback':
            if (msg.data) term.write(msg.data);
            break;
          case 'exit':
            term.write('\\r\\n[Process exited with code ' + msg.code + ']');
            break;
          case 'error':
            term.write('\\r\\n[Error: ' + msg.message + ']');
            break;
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    };

    ws.onclose = () => {
      connected = false;
      term.write('\\r\\n[Connection closed]');
    };

    ws.onerror = () => {
      term.write('\\r\\n[Connection error]');
    };

    // Terminal input
    term.onData((data) => {
      if (!connected) return;
      // Android double-Enter debounce
      if (data === '\\r') {
        const now = Date.now();
        if (now - lastEnterTime < 50) return;
        lastEnterTime = now;
      }
      ws.send(JSON.stringify({ type: 'input', data }));
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (connected) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    });
    resizeObserver.observe(document.getElementById('terminal'));

    // Ping keepalive
    setInterval(() => {
      if (connected) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  </script>
</body>
</html>`;
}
