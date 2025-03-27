import { useEffect, useRef, useState } from "react";
import { Terminal as XTerminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

export default function Terminal() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const terminalInstance = useRef<XTerminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const [inputBuffer, setInputBuffer] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Initialize terminal and WebSocket
  useEffect(() => {
    // Create and mount terminal
    if (!terminalRef.current) return;
    
    const term = new XTerminal({
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      fontSize: 14,
      theme: {
        background: "#1e1e1e",
        foreground: "#f1f1f1",
        cursor: "#ffffff",
      },
      cursorBlink: true,
    });
    
    const fit = new FitAddon();
    fitAddon.current = fit;
    term.loadAddon(fit);
    
    term.open(terminalRef.current);
    fit.fit();
    
    terminalInstance.current = term;
    
    // Write welcome message
    term.writeln("\x1B[1;3;32mWelcome to TaskWarrior Terminal\x1B[0m");
    term.writeln("\x1B[3mType 'help' for a list of commands.\x1B[0m");
    term.writeln("");
    term.write("$ ");
    
    // Create WebSocket connection with a specific path to avoid conflicts with Vite's WebSocket
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/terminal`;
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log("WebSocket connection established");
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "output") {
          // Write command output to terminal
          term.writeln("\r\n" + data.output);
          term.write("$ ");
        } else if (data.type === "command") {
          // Set suggested command from AI
          setInputBuffer(data.command);
          term.write(data.command);
        } else if (data.type === "error") {
          term.writeln("\r\n\x1B[1;31mError: " + data.error + "\x1B[0m");
          term.write("$ ");
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
        term.writeln("\r\n\x1B[1;31mError processing server response\x1B[0m");
        term.write("$ ");
      }
    };
    
    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      term.writeln("\r\n\x1B[1;31mWebSocket error. Connection might be lost.\x1B[0m");
      term.write("$ ");
    };
    
    socket.onclose = () => {
      console.log("WebSocket connection closed");
      term.writeln("\r\n\x1B[1;31mConnection closed. Refresh the page to reconnect.\x1B[0m");
    };
    
    setWs(socket);
    
    // Set up terminal key input handling
    term.onKey(({ key, domEvent }) => {
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;
      
      // Handle arrow up/down for history
      if (domEvent.key === "ArrowUp") {
        if (history.length > 0 && historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          
          // Clear current line and write history item
          const currentLine = term.buffer.active.cursorX - 2;
          term.write("\r$ " + " ".repeat(inputBuffer.length));
          term.write("\r$ " + history[history.length - 1 - newIndex]);
          setInputBuffer(history[history.length - 1 - newIndex]);
        }
        return;
      } else if (domEvent.key === "ArrowDown") {
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          
          // Clear current line and write history item
          term.write("\r$ " + " ".repeat(inputBuffer.length));
          term.write("\r$ " + history[history.length - 1 - newIndex]);
          setInputBuffer(history[history.length - 1 - newIndex]);
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          term.write("\r$ " + " ".repeat(inputBuffer.length));
          term.write("\r$ ");
          setInputBuffer("");
        }
        return;
      }
      
      // Handle backspace
      if (domEvent.key === "Backspace") {
        if (inputBuffer.length > 0 && term.buffer.active.cursorX > 2) {
          term.write("\b \b");
          setInputBuffer(inputBuffer.slice(0, -1));
        }
        return;
      }
      
      // Handle enter
      if (domEvent.key === "Enter") {
        const command = inputBuffer.trim();
        
        if (command) {
          // Add to history
          setHistory(prev => [...prev, command]);
          setHistoryIndex(-1);
          
          // Send command to server
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "command", command }));
          } else {
            term.writeln("\r\n\x1B[1;31mWebSocket not connected. Try refreshing the page.\x1B[0m");
            term.write("$ ");
          }
        } else {
          // Empty command, just show a new prompt
          term.writeln("");
          term.write("$ ");
        }
        
        setInputBuffer("");
        return;
      }
      
      // Handle tab completion (optional enhancement)
      if (domEvent.key === "Tab") {
        domEvent.preventDefault();
        // Could implement tab completion here
        return;
      }
      
      // Handle normal printable characters
      if (printable) {
        term.write(key);
        setInputBuffer(inputBuffer + key);
      }
    });
    
    // Handle resize events
    const handleResize = () => {
      if (fit) fit.fit();
    };
    
    window.addEventListener("resize", handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      
      if (socket) {
        socket.close();
      }
      
      if (term) {
        term.dispose();
      }
    };
  }, []);
  
  // Resize terminal when its container becomes visible
  useEffect(() => {
    if (fitAddon.current) {
      setTimeout(() => {
        fitAddon.current?.fit();
      }, 100);
    }
  }, []);
  
  return (
    <div className="px-4 py-2">
      <div 
        ref={terminalRef}
        className="rounded-md overflow-hidden" 
        style={{ height: "300px" }}
      />
    </div>
  );
}
