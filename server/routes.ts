import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { z } from "zod";
import { storage } from "./storage";
import { TaskwarriorService } from "./services/taskwarrior";
import openai from "./services/openai";
import { insertTaskSchema, insertChatMessageSchema } from "@shared/schema";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

// Initialize services
const taskwarrior = new TaskwarriorService();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Setup WebSocket server for terminal with specific path
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: "/terminal"
  });
  
  wss.on("connection", (ws) => {
    console.log("Terminal WebSocket connection established");
    
    // Set up Taskwarrior environment
    const dataDir = path.resolve(process.cwd(), "data/taskwarrior");
    const taskrcPath = path.join(dataDir, ".taskrc");
    
    // Ensure the data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Create default taskrc if it doesn't exist
    if (!fs.existsSync(taskrcPath)) {
      const taskrcContent = 
        `data.location=${dataDir}\n` +
        `confirmation=no\n` +
        `verbose=blank,label,new-id,edit,special,project,sync,unwait,recur\n`;
      fs.writeFileSync(taskrcPath, taskrcContent, 'utf8');
    }
    
    // Environment for tasksh process
    const env = {
      ...process.env,
      TASKRC: taskrcPath,
      TASKDATA: dataDir
    };
    
    // Get path to tasksh
    const taskshPath = "/nix/store/yfb4hsrh8pd94s7sr0dm0jx11kgrp0x1-tasksh-1.2.0/bin/tasksh";
    
    // Spawn tasksh process
    const tasksh = spawn(taskshPath, [], { 
      env
    });
    
    // Initialize terminal session
    let terminated = false;
    
    // Send welcome message
    ws.send(JSON.stringify({ 
      type: "output", 
      output: "Welcome to Taskwarrior Shell (tasksh)\nType commands directly without 'task' prefix\nType 'exit' to close the terminal session\n" 
    }));
    
    // Handle tasksh stdout
    tasksh.stdout.on('data', (data) => {
      if (!terminated) {
        ws.send(JSON.stringify({ type: "output", output: data.toString() }));
      }
    });
    
    // Handle tasksh stderr
    tasksh.stderr.on('data', (data) => {
      if (!terminated) {
        ws.send(JSON.stringify({ type: "error", error: data.toString() }));
      }
    });
    
    // Handle tasksh process exit
    tasksh.on('close', (code) => {
      console.log(`tasksh process exited with code ${code}`);
      if (!terminated) {
        ws.send(JSON.stringify({ 
          type: "output", 
          output: `\nTaskwarrior shell session ended. Refresh to start a new session.` 
        }));
        terminated = true;
        ws.close();
      }
    });
    
    // Handle WebSocket messages from client
    ws.on("message", async (message) => {
      try {
        if (terminated) return;
        
        const data = JSON.parse(message.toString());
        
        if (data.type === "command") {
          const command = data.command;
          console.log("Sending command to tasksh:", JSON.stringify(command));
          
          // Special handling for commands with spaces
          if (command.includes(' ')) {
            // For "add" command with description, use specific formatting
            if (command.startsWith('add ')) {
              console.log("Add command detected with description");
              const description = command.substring(4);
              // Send the add command first with special handling
              tasksh.stdin.write('add' + '\n');
              
              // Then wait a bit and send the description
              setTimeout(() => {
                console.log("Sending description:", JSON.stringify(description));
                tasksh.stdin.write(description + '\n');
              }, 100);
            } else {
              // For other commands with spaces, send normally
              tasksh.stdin.write(command + '\n');
            }
          } else {
            // Regular commands without spaces
            tasksh.stdin.write(command + '\n');
          }
        } else if (data.type === "parse") {
          // Parse natural language to Taskwarrior command
          const command = await openai.parseCommand(data.text);
          ws.send(JSON.stringify({ type: "command", command }));
        }
      } catch (error) {
        console.error("WebSocket error:", error);
        if (!terminated) {
          ws.send(JSON.stringify({ type: "error", error: "Failed to process command" }));
        }
      }
    });
    
    // Handle WebSocket close
    ws.on("close", () => {
      console.log("WebSocket connection closed");
      if (!terminated) {
        terminated = true;
        // Kill tasksh process when WebSocket closes
        tasksh.kill();
      }
    });
  });
  
  // API Routes
  const api = express.Router();
  
  // Tasks API
  api.get("/tasks", async (req: Request, res: Response) => {
    try {
      const filter = req.query.filter || "";
      const tasks = await taskwarrior.getTasks(filter as string);
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  api.get("/tasks/:id", async (req: Request, res: Response) => {
    try {
      const task = await taskwarrior.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  api.post("/tasks", async (req: Request, res: Response) => {
    try {
      const validatedData = insertTaskSchema.parse(req.body);
      const task = await taskwarrior.createTask(validatedData);
      res.status(201).json(task);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });
  
  api.patch("/tasks/:id", async (req: Request, res: Response) => {
    try {
      const taskId = req.params.id;
      const updates = req.body;
      const updatedTask = await taskwarrior.updateTask(taskId, updates);
      
      if (!updatedTask) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      res.json(updatedTask);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  api.delete("/tasks/:id", async (req: Request, res: Response) => {
    try {
      const success = await taskwarrior.deleteTask(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Task refresh endpoint - used by Taskwarrior hooks
  api.post("/tasks/refresh", async (_req: Request, res: Response) => {
    try {
      console.log("Task data change detected via hook");
      // We don't need to do anything here as clients will poll for updates
      // In a production app, we might use WebSockets to notify clients
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Projects API
  api.get("/projects", async (_req: Request, res: Response) => {
    try {
      const projectNames = await taskwarrior.getProjects();
      const projects = projectNames.map((name, index) => ({
        id: index + 1,
        name
      }));
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Tags API
  api.get("/tags", async (_req: Request, res: Response) => {
    try {
      const tags = await taskwarrior.getTags();
      const formattedTags = tags.map((name, index) => ({
        id: index + 1,
        name
      }));
      res.json(formattedTags);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Reports API
  api.get("/reports", async (_req: Request, res: Response) => {
    try {
      const reports = await storage.getReports();
      res.json(reports);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Chat API
  api.get("/chat", async (_req: Request, res: Response) => {
    try {
      const messages = await storage.getChatMessages();
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  api.post("/chat", async (req: Request, res: Response) => {
    try {
      const validatedData = insertChatMessageSchema.parse(req.body);
      
      // Store user message
      const userMessage = await storage.createChatMessage(validatedData);
      
      // Get chat history
      const chatHistory = await storage.getChatMessages();
      
      // Get response from OpenAI
      const aiResponse = await openai.sendMessage(validatedData.content, chatHistory);
      
      // Store AI response
      const assistantMessage = await storage.createChatMessage({
        content: aiResponse,
        role: "assistant"
      });
      
      res.status(201).json({
        userMessage,
        assistantMessage
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });
  
  // Mount API routes
  app.use("/api", api);

  return httpServer;
}
