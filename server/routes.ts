import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { z } from "zod";
import { storage } from "./storage";
import { TaskwarriorService } from "./services/taskwarrior";
import openai from "./services/openai";
import { insertTaskSchema, insertChatMessageSchema } from "@shared/schema";

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
    
    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === "command") {
          // Execute Taskwarrior command
          const result = await taskwarrior.executeCommand(data.command);
          ws.send(JSON.stringify({ type: "output", output: result }));
        } else if (data.type === "parse") {
          // Parse natural language to Taskwarrior command
          const command = await openai.parseCommand(data.text);
          ws.send(JSON.stringify({ type: "command", command }));
        }
      } catch (error) {
        console.error("WebSocket error:", error);
        ws.send(JSON.stringify({ type: "error", error: "Failed to process command" }));
      }
    });
    
    ws.on("close", () => {
      console.log("WebSocket connection closed");
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
