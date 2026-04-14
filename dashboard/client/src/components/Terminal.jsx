import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const Terminal = () => {
  const terminalRef = useRef(null);
  const xtermRef    = useRef(null);
  const socketRef   = useRef(null);
  const fitAddonRef = useRef(null);

  useEffect(() => {
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0f172a',
        foreground: '#f8fafc',
        cursor:     '#6366f1',
        selection:  'rgba(99,102,241,0.3)',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current    = term;
    fitAddonRef.current = fitAddon;

    // Include JWT in WS URL so server can authenticate the upgrade
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host     = window.location.host;
    const token    = localStorage.getItem('token') || '';
    const socket   = new WebSocket(`${protocol}://${host}/terminal?token=${encodeURIComponent(token)}`);

    socketRef.current = socket;

    socket.onopen = () => {
      term.writeln('\x1b[1;32mConnected to server shell\x1b[0m');
      term.writeln('\x1b[90mType commands below. Session is logged.\x1b[0m\r\n');
    };

    socket.onerror = () => {
      term.writeln('\x1b[1;31mConnection failed — Super Admin required\x1b[0m');
    };

    socket.onclose = () => {
      term.writeln('\r\n\x1b[1;33mSession closed.\x1b[0m');
    };

    socket.onmessage = (event) => {
      term.write(event.data);
    };

    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(data);
    });

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.close();
      term.dispose();
    };
  }, []);

  return (
    <div className="h-full w-full bg-[#0f172a] rounded-xl overflow-hidden border border-slate-700/50 p-2">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
};

export default Terminal;
