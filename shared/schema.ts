import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Original user schema kept for reference
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// New schemas for task management application

// Task schema based on Taskwarrior fields
export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(), // UUID from Taskwarrior
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"),
  priority: text("priority"), // H, M, L
  project: text("project"),
  tags: text("tags").array(), // Array of tags
  due: timestamp("due"),
  wait: timestamp("wait"),
  scheduled: timestamp("scheduled"),
  until: timestamp("until"),
  annotations: text("annotations"), // Additional notes
  created: timestamp("created").notNull().defaultNow(),
  modified: timestamp("modified").notNull().defaultNow(),
  completed: timestamp("completed"),
  urgency: text("urgency"), // Computed by Taskwarrior
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  urgency: true,
  created: true,
  modified: true,
  completed: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Project schema (extracted from tasks)
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Report Schema
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  filter: text("filter").notNull(), // Taskwarrior filter string
  description: text("description"),
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
});

export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;

// Chat Message Schema
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  role: text("role").notNull(), // 'user' or 'assistant'
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Enhanced types for frontend
export type TaskWithMetadata = Task & {
  tagsList?: string[];
};

export type TaskFilter = {
  status?: string;
  project?: string;
  tag?: string;
  priority?: string;
  search?: string;
  report?: string;
};
