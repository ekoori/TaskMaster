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
            
            // Ensure the input buffer is cleared and ready for new input
            setInputBuffer("");
          } else if (data.type === "command") {
            // Set suggested command from AI for auto-completion
            const newBuffer = data.command;
            setInputBuffer(newBuffer);
            
            // Render the entire line with the suggested command
            term.write("\r" + prompt);
            term.write(newBuffer);
          } else if (data.type === "error") {
            term.writeln("\r\n\x1B[1;31mError: " + data.error + "\x1B[0m");
            term.write(prompt);
            setInputBuffer("");
          }
        } catch (error) {
          console.error("Failed to process WebSocket message:", error);
          term.writeln("\r\n\x1B[1;31mError processing server response\x1B[0m");
          term.write(prompt);
          setInputBuffer("");
        }
      };
    };
    
    // Initialize WebSocket connection
    connectWebSocket();
    
    // We'll create a completely new approach for handling terminal input
    const renderLine = (buffer: string) => {
      // Get cursor position and current line length
      const currentLineLength = prompt.length + inputBuffer.length;
      
      // Move to start of line and clear it completely
      term.write("\r");
      term.write(" ".repeat(currentLineLength + 10)); // Add extra spaces to ensure full clearing
      
      // Move back to start and write the prompt and buffer
      term.write("\r" + prompt + buffer);
      
      // Debug logging for space issues
      if (buffer.includes(" ")) {
        console.log("Rendering buffer with space:", JSON.stringify(buffer));
      }
    };
    
    term.onKey(({ key, domEvent }) => {
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;
      
      // Handle arrow up/down for history
      if (domEvent.key === "ArrowUp") {
        if (history.length > 0 && historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          
          const historyItem = history[history.length - 1 - newIndex];
          renderLine(historyItem);
          setInputBuffer(historyItem);
        }
        return;
      } else if (domEvent.key === "ArrowDown") {
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          
          const historyItem = history[history.length - 1 - newIndex];
          renderLine(historyItem);
          setInputBuffer(historyItem);
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          renderLine("");
          setInputBuffer("");
        }
        return;
      }
      
      // Handle backspace
      if (domEvent.key === "Backspace") {
        if (inputBuffer.length > 0) {
          const newBuffer = inputBuffer.slice(0, -1);
          setInputBuffer(newBuffer);
          renderLine(newBuffer);
        }
        return;
      }
      
      // Handle enter
      if (domEvent.key === "Enter") {
        const command = inputBuffer.trim();
        
        // Always create a new line after Enter
        term.writeln("");
        
        if (command) {
          // Add to history
          setHistory(prev => [...prev, command]);
          setHistoryIndex(-1);
          
          // Send command to server
          if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: "command", command }));
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
        return;
      }
      
      // Handle all printable characters including spaces
      if (printable) {
        // Update the input buffer with the new character
        const newBuffer = inputBuffer + key;
        setInputBuffer(newBuffer);
        
        // Re-render the entire line to ensure consistency
        renderLine(newBuffer);
        
        // Log spaces for debugging
        if (key === ' ') {
          console.log("Space character added, new buffer:", newBuffer);
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
