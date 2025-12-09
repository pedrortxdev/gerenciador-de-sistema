import { useEffect, useRef } from 'react';
import Cookies from 'js-cookie';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export default function WebTerminal() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // 1. Initialize Xterm
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e293b', // slate-800
        foreground: '#e2e8f0', // slate-200
      }
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;

    // 2. Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // localhost:3010 or vps domain
    // Note: The backend is proxied at /api, but WS usually needs a direct path or handled via nginx upgrade at /api/terminal
    // In our nginx config: /api/ passes to backend. So wss://domain/api/terminal should reach backend/terminal
    
    const token = Cookies.get('auth_token');
    const wsUrl = `${protocol}//${host}/api/terminal?token=${token}`; 

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    // 3. Handlers
    socket.onopen = () => {
      term.write('\r\n\x1b[32mConnected to System Shell\x1b[0m\r\n');
      // Send resize
      const dims = { cols: term.cols, rows: term.rows };
      socket.send('1' + JSON.stringify(dims));
    };

    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        term.write(event.data);
      } else {
        // Handle Blob/ArrayBuffer if strictly binary
         const reader = new FileReader();
         reader.onload = () => {
            term.write(reader.result as string);
         };
         reader.readAsText(event.data);
      }
    };
    
    socket.onclose = () => {
      term.write('\r\n\x1b[31mConnection Closed\x1b[0m\r\n');
    };

    socket.onerror = () => {
      term.write('\r\n\x1b[31mConnection Error\x1b[0m\r\n');
    };

    // 4. Terminal Input -> Socket
    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send('0' + data);
      }
    });

    // 5. Resize Listener
    const handleResize = () => {
      fitAddon.fit();
      if (socket.readyState === WebSocket.OPEN) {
         const dims = { cols: term.cols, rows: term.rows };
         socket.send('1' + JSON.stringify(dims));
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.close();
      term.dispose();
    };
  }, []);

  return (
    <div className="h-[600px] bg-slate-800 rounded-xl overflow-hidden p-2 shadow-xl border border-slate-700">
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
}
