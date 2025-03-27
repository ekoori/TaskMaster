import { exec } from "child_process";
import { promisify } from "util";
import { InsertTask, Task, TaskWithMetadata } from "@shared/schema";
import * as path from "path";
import * as fs from "fs";

const execAsync = promisify(exec);

export class TaskwarriorService {
  private dataDir: string;
  private baseCommand: string;
  private exportCommand = "export";
  
  constructor() {
    // Use a persistent data directory within the project
    this.dataDir = path.resolve(process.cwd(), "data/taskwarrior");
    
    // Ensure the data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Create the taskrc file if it doesn't exist
    const taskrcPath = path.join(this.dataDir, ".taskrc");
    if (!fs.existsSync(taskrcPath)) {
      const taskrcContent = 
        `data.location=${this.dataDir}\n` +
        `confirmation=no\n`;
      fs.writeFileSync(taskrcPath, taskrcContent, 'utf8');
    }
    
    // Configure task command with the custom rc file
    this.baseCommand = `task rc:${taskrcPath}`;
  }
  
  // Convert Taskwarrior JSON to our Task schema
  private convertTaskwarriorTask(twTask: any): TaskWithMetadata {
    // Map Taskwarrior fields to our schema
    const task: TaskWithMetadata = {
      id: twTask.uuid || `tw_${Date.now()}`,
      description: twTask.description || "",
      status: twTask.status || "pending",
      priority: twTask.priority || null,
      project: twTask.project || null,
      tags: twTask.tags || null,
      tagsList: twTask.tags || [],
      due: twTask.due ? new Date(twTask.due) : null,
      wait: twTask.wait ? new Date(twTask.wait) : null,
      scheduled: twTask.scheduled ? new Date(twTask.scheduled) : null,
      until: twTask.until ? new Date(twTask.until) : null,
      annotations: Array.isArray(twTask.annotations) 
        ? twTask.annotations.map((a: any) => a.description).join("\n") 
        : (twTask.annotations || null),
      created: twTask.entry ? new Date(twTask.entry) : new Date(),
      modified: twTask.modified ? new Date(twTask.modified) : new Date(),
      completed: twTask.end ? new Date(twTask.end) : null,
      urgency: twTask.urgency?.toString() || null,
    };
    
    return task;
  }
  
  // Convert our Task schema to Taskwarrior format
  private createTaskwarriorCommand(task: InsertTask | Partial<Task>): string {
    const components = [`${this.baseCommand} add`];
    
    // Add description (required)
    if ("description" in task && task.description) {
      components.push(`"${task.description}"`);
    }
    
    // Add project if present
    if (task.project) {
      components.push(`project:"${task.project}"`);
    }
    
    // Add priority if present
    if (task.priority) {
      components.push(`priority:${task.priority}`);
    }
    
    // Add due date if present
    if (task.due) {
      let dueDate: Date;
      if (typeof task.due === 'string') {
        dueDate = new Date(task.due);
      } else {
        dueDate = task.due;
      }
      components.push(`due:${dueDate.toISOString().split('T')[0]}`);
    }
    
    // Add tags if present
    if (task.tags && Array.isArray(task.tags) && task.tags.length > 0) {
      const tagStr = task.tags.map(tag => `+${tag}`).join(' ');
      components.push(tagStr);
    }
    
    // Add annotations if present
    if (task.annotations) {
      components.push(`annotation:"${task.annotations}"`);
    }
    
    return components.join(' ');
  }

  // Execute any Taskwarrior command
  async executeCommand(command: string): Promise<string> {
    try {
      // If the command doesn't start with 'task' or the baseCommand, add it
      let fullCommand = command;
      
      // Check if this is a raw Taskwarrior command without the task prefix
      if (!command.startsWith('task') && !command.startsWith(this.baseCommand)) {
        fullCommand = `${this.baseCommand} ${command}`;
      }
      
      console.log(`Executing full command: ${fullCommand}`);
      const { stdout, stderr } = await execAsync(fullCommand);
      
      if (stderr) {
        console.error(`Taskwarrior stderr: ${stderr}`);
      }
      
      return stdout.trim();
    } catch (error) {
      console.error(`Taskwarrior command failed: ${error}`);
      throw new Error(`Failed to execute Taskwarrior command: ${error}`);
    }
  }
  
  // Get all tasks with optional filter
  async getTasks(filter = ""): Promise<TaskWithMetadata[]> {
    const command = `${this.baseCommand} ${filter} ${this.exportCommand}`;
    
    try {
      const output = await this.executeCommand(command);
      
      if (!output) {
        return [];
      }
      
      const tasks = JSON.parse(output);
      return Array.isArray(tasks) 
        ? tasks.map(task => this.convertTaskwarriorTask(task))
        : [];
    } catch (error) {
      console.error("Error fetching tasks:", error);
      throw new Error(`Failed to fetch tasks: ${error}`);
    }
  }
  
  // Get a single task by ID
  async getTask(id: string): Promise<TaskWithMetadata | null> {
    const command = `${this.baseCommand} uuid:${id} ${this.exportCommand}`;
    
    try {
      const output = await this.executeCommand(command);
      
      if (!output) {
        return null;
      }
      
      const tasks = JSON.parse(output);
      if (Array.isArray(tasks) && tasks.length > 0) {
        return this.convertTaskwarriorTask(tasks[0]);
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching task ${id}:`, error);
      throw new Error(`Failed to fetch task ${id}: ${error}`);
    }
  }
  
  // Helper function to wait for a specified time
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Create a new task with retry logic
  async createTask(task: InsertTask): Promise<TaskWithMetadata> {
    const command = this.createTaskwarriorCommand(task);
    
    try {
      const output = await this.executeCommand(command);
      
      // Taskwarrior doesn't return the created task directly
      // We need to extract the ID from the output and fetch the task
      const idMatch = output.match(/Created task (\d+)/);
      if (idMatch && idMatch[1]) {
        const taskId = idMatch[1];
        
        // Implement retry logic with delay
        let retries = 5;
        let newTask = null;
        
        while (retries > 0 && !newTask) {
          // Add a small delay between retries
          await this.delay(200);
          
          // Try to fetch the newly created task
          newTask = await this.getTask(taskId);
          
          if (newTask) {
            return newTask;
          }
          
          retries--;
        }
        
        // If we still can't find the task but have the ID, return a minimal task object
        if (!newTask) {
          // Get all tasks as a fallback
          const allTasks = await this.getTasks();
          // Try to find the task by description
          const fallbackTask = allTasks.find(t => 
            t.description === task.description && 
            (!task.project || t.project === task.project)
          );
          
          if (fallbackTask) {
            return fallbackTask;
          }
          
          // Create a minimal response with the data we know
          return {
            id: taskId,
            description: task.description,
            annotations: task.annotations || null,
            project: task.project || null,
            priority: task.priority || null,
            due: task.due || null,
            tags: task.tags || null,
            status: "pending",
            wait: null,
            scheduled: null,
            until: null,
            created: new Date(),
            modified: new Date(),
            completed: null,
            urgency: null,
          };
        }
      }
      
      throw new Error("Failed to create task: Unable to retrieve created task");
    } catch (error) {
      console.error("Error creating task:", error);
      throw new Error(`Failed to create task: ${error}`);
    }
  }
  
  // Update an existing task with retry logic
  async updateTask(id: string, updates: Partial<Task>): Promise<TaskWithMetadata | null> {
    // Build the update command
    const components = [`${this.baseCommand} uuid:${id} modify`];
    
    // Add description if present
    if (updates.description) {
      components.push(`description:"${updates.description}"`);
    }
    
    // Add project if present
    if (updates.project) {
      components.push(`project:"${updates.project}"`);
    }
    
    // Add priority if present
    if (updates.priority) {
      components.push(`priority:${updates.priority}`);
    }
    
    // Add due date if present
    if (updates.due) {
      let dueDate: Date;
      if (typeof updates.due === 'string') {
        dueDate = new Date(updates.due);
      } else {
        dueDate = updates.due;
      }
      components.push(`due:${dueDate.toISOString().split('T')[0]}`);
    }
    
    // Handle status changes
    if (updates.status) {
      if (updates.status === 'completed') {
        // Use 'done' command for completing tasks
        components[0] = `${this.baseCommand} uuid:${id} done`;
      } else if (updates.status === 'deleted') {
        // Use 'delete' command for deleting tasks
        components[0] = `${this.baseCommand} uuid:${id} delete`;
      } else {
        // For other status changes, use modify
        components.push(`status:${updates.status}`);
      }
    }
    
    // Handle tags changes
    if (updates.tags) {
      // Remove existing tags first
      await this.executeCommand(`${this.baseCommand} uuid:${id} modify -ALLTAGS`);
      
      // Add new tags
      if (Array.isArray(updates.tags) && updates.tags.length > 0) {
        const tagStr = updates.tags.map(tag => `+${tag}`).join(' ');
        components.push(tagStr);
      }
    }
    
    // Handle annotations
    if (updates.annotations) {
      components.push(`annotation:"${updates.annotations}"`);
    }
    
    const command = components.join(' ');
    
    try {
      await this.executeCommand(command);
      
      // Implement retry logic with delay for fetching the updated task
      let retries = 5;
      let updatedTask = null;
      
      while (retries > 0 && !updatedTask) {
        // Add a small delay between retries
        await this.delay(200);
        
        // Try to fetch the updated task
        updatedTask = await this.getTask(id);
        
        if (updatedTask) {
          return updatedTask;
        }
        
        retries--;
      }
      
      // If we failed to get the updated task after retries
      if (!updatedTask) {
        console.warn(`Task ${id} was updated but could not be retrieved after update`);
        
        // Get all tasks and try to find it
        const allTasks = await this.getTasks();
        const matchedTask = allTasks.find(t => t.id === id);
        
        if (matchedTask) {
          return matchedTask;
        }
        
        // If we still can't find it, return a minimal object
        return {
          id: id,
          description: updates.description || "Unknown task",
          annotations: updates.annotations || null,
          project: updates.project || null,
          priority: updates.priority || null,
          due: updates.due || null,
          tags: updates.tags || null,
          status: updates.status || "pending",
          wait: null,
          scheduled: null,
          until: null,
          created: new Date(),
          modified: new Date(),
          completed: null,
          urgency: null,
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Error updating task ${id}:`, error);
      throw new Error(`Failed to update task ${id}: ${error}`);
    }
  }
  
  // Delete a task
  async deleteTask(id: string): Promise<boolean> {
    const command = `${this.baseCommand} uuid:${id} delete rc.confirmation=off`;
    
    try {
      await this.executeCommand(command);
      return true;
    } catch (error) {
      console.error(`Error deleting task ${id}:`, error);
      throw new Error(`Failed to delete task ${id}: ${error}`);
    }
  }
  
  // Get all projects
  async getProjects(): Promise<string[]> {
    const command = `${this.baseCommand} _projects`;
    
    try {
      const output = await this.executeCommand(command);
      return output.split('\n').filter(Boolean);
    } catch (error) {
      console.error("Error fetching projects:", error);
      throw new Error(`Failed to fetch projects: ${error}`);
    }
  }
  
  // Get all tags
  async getTags(): Promise<string[]> {
    const command = `${this.baseCommand} _tags`;
    
    try {
      const output = await this.executeCommand(command);
      return output.split('\n').filter(Boolean);
    } catch (error) {
      console.error("Error fetching tags:", error);
      throw new Error(`Failed to fetch tags: ${error}`);
    }
  }
}

export default new TaskwarriorService();
