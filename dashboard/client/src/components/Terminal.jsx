import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const Terminal = () => {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const socketRef = useRef(null);
  const fitAddonRef = useRef(null);

  useEffect(() => {
    // Initialize XTerm
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0f172a', // slate-900
        foreground: '#f8fafc', // slate-50
      },
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(terminalRef.current);
    fitAddon.fit();
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const socket = new WebSocket(`${protocol}://${host}/terminal`);
    
    socketRef.current = socket;

    socket.onopen = () => {
      term.writeln('\x1b[1;32mconnected to server shell\x1b[0m');
    };

    socket.onmessage = (event) => {
      term.write(event.data);
    };

    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    const handleResize = () => {
      fitAddon.fit();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.close();
      term.dispose();
    };
  }, []);

  return (
    <div className="flex-grow min-h-0 bg-[#0f172a] rounded-xl overflow-hidden border border-slate-700/50 p-2">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
};

export default Terminal;
