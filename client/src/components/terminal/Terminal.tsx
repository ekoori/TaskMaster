import * as React from "react";
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
  // Set a constant prompt that matches what tasksh will use
  const [prompt, setPrompt] = useState("tasksh> ");
  
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
    
    // Write welcome message - the actual welcome message will come from the server/tasksh
    term.writeln("\x1B[1;3;32mConnecting to Taskwarrior Shell...\x1B[0m");
    term.write(prompt);
    
    // Create WebSocket connection with a specific path to avoid conflicts with Vite's WebSocket
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/terminal`;
    
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 2000; // 2 seconds
    
    const connectWebSocket = () => {
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        console.log("WebSocket connection established");
        reconnectAttempts = 0;
        
        // Don't write anything here, the tasksh process will send its own welcome message
        
        // Store the socket in state once it's open
        setWs(socket);
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        term.writeln("\r\n\x1B[1;31mWebSocket error. Connection might be lost.\x1B[0m");
        term.write(prompt);
      };
      
      socket.onclose = (event) => {
        console.log("WebSocket connection closed", event.code, event.reason);
        term.writeln("\r\n\x1B[1;31mConnection closed.\x1B[0m");
        
        // Clear the socket from state
        setWs(null);
        
        // Attempt to reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          term.writeln(`\r\n\x1B[1;33mAttempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...\x1B[0m`);
          
          setTimeout(() => {
            connectWebSocket();
          }, reconnectDelay);
        } else {
          term.writeln("\r\n\x1B[1;31mFailed to reconnect after multiple attempts. Please refresh the page.\x1B[0m");
        }
      };
      
      socket.onmessage = (event) => {
        try {
          // Check if message is JSON parseable
          let data;
          try {
            data = JSON.parse(event.data);
          } catch (e) {
            // If not JSON, treat as plain text output
            term.writeln("\r\n" + event.data);
            term.write(prompt);
            return;
          }
          
          if (data.type === "output") {
            // Write command output to terminal
            // Check if the output contains a tasksh prompt and strip it out
            const output = data.output.replace(/^tasksh> /gm, "");
            
            // Write output to terminal
            term.writeln("\r\n" + output);
            
            // Write the prompt
            term.write(prompt);
          } else if (data.type === "command") {
            // Set suggested command from AI
            setInputBuffer(data.command);
            term.write(data.command);
          } else if (data.type === "error") {
            term.writeln("\r\n\x1B[1;31mError: " + data.error + "\x1B[0m");
            term.write(prompt);
          }
        } catch (error) {
          console.error("Failed to process WebSocket message:", error);
          term.writeln("\r\n\x1B[1;31mError processing server response\x1B[0m");
          term.write(prompt);
        }
      };
    };
    
    // Initialize WebSocket connection
    connectWebSocket();
    
    // Set up terminal key input handling
    term.onKey(({ key, domEvent }) => {
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;
      
      // Handle arrow up/down for history
      if (domEvent.key === "ArrowUp") {
        if (history.length > 0 && historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          
          // Clear current line and write history item
          const promptLength = prompt.length;
          term.write("\r" + prompt + " ".repeat(inputBuffer.length));
          term.write("\r" + prompt + history[history.length - 1 - newIndex]);
          setInputBuffer(history[history.length - 1 - newIndex]);
        }
        return;
      } else if (domEvent.key === "ArrowDown") {
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          
          // Clear current line and write history item
          term.write("\r" + prompt + " ".repeat(inputBuffer.length));
          term.write("\r" + prompt + history[history.length - 1 - newIndex]);
          setInputBuffer(history[history.length - 1 - newIndex]);
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          term.write("\r" + prompt + " ".repeat(inputBuffer.length));
          term.write("\r" + prompt);
          setInputBuffer("");
        }
        return;
      }
      
      // Handle backspace
      if (domEvent.key === "Backspace") {
        if (inputBuffer.length > 0 && term.buffer.active.cursorX > prompt.length) {
          term.write("\b \b");
          setInputBuffer(inputBuffer.slice(0, -1));
        }
        return;
      }
      
      // Handle enter
      if (domEvent.key === "Enter") {
        const command = inputBuffer.trim();
        
        // Always create a new line after an Enter
        term.writeln("");
        
        if (command) {
          // Add to history
          setHistory(prev => [...prev, command]);
          setHistoryIndex(-1);
          
          // Send command to server
          if (ws && ws.readyState === 1) { // WebSocket.OPEN is 1
            // Send command to server, server will echo it back in the response
            ws.send(JSON.stringify({ type: "command", command }));
            
            // XTerm.js doesn't have a setOption in this version,
            // we could implement a lock through state if this becomes an issue
          } else {
            term.writeln("\x1B[1;31mWebSocket not connected. Try refreshing the page.\x1B[0m");
            term.write(prompt);
          }
        } else {
          // Empty command, just show a new prompt
          term.write(prompt);
        }
        
        setInputBuffer("");
        return;
      }
      
      // Handle tab completion (optional enhancement)
      if (domEvent.key === "Tab") {
        domEvent.preventDefault();
        // Could implement tab completion here by sending a special message to the server
        return;
      }
      
      // Handle normal printable characters
      if (printable) {
        // Special handling for space - the most reliable approach
        if (key === ' ' || domEvent.key === ' ' || domEvent.key === 'Space') {
          // Update buffer first
          const newBuffer = inputBuffer + ' ';
          setInputBuffer(newBuffer);
          
          // Use a consistent rendering approach for spaces
          term.write(' ');
          
          // Log for debugging
          console.log("Space character entered, buffer updated to:", newBuffer);
        } else {
          // For non-space characters, use the standard approach
          term.write(key);
          setInputBuffer(inputBuffer + key);
        }
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
      
      if (ws) {
        ws.close();
      }
      
      if (term) {
        term.dispose();
      }
    };
  }, [prompt]);
  
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
        style={{ height: "400px" }}
      />
    </div>
  );
}
