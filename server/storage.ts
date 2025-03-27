import { 
  tasks, type Task, type InsertTask,
  projects, type Project, type InsertProject,
  reports, type Report, type InsertReport,
  chatMessages, type ChatMessage, type InsertChatMessage,
  TaskWithMetadata, TaskFilter
} from "@shared/schema";

// Interface for storage operations
export interface IStorage {
  // User operations (keeping original methods)
  getUser(id: number): Promise<any | undefined>;
  getUserByUsername(username: string): Promise<any | undefined>;
  createUser(user: any): Promise<any>;
  
  // Task operations
  getTasks(filter?: TaskFilter): Promise<TaskWithMetadata[]>;
  getTask(id: string): Promise<TaskWithMetadata | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<Task>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;
  
  // Project operations
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  
  // Report operations
  getReports(): Promise<Report[]>;
  getReport(id: number): Promise<Report | undefined>;
  createReport(report: InsertReport): Promise<Report>;
  
  // Chat operations
  getChatMessages(limit?: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, any>;
  private tasksList: Map<string, Task>;
  private projectsList: Map<number, Project>;
  private reportsList: Map<number, Report>;
  private chatMessagesList: Map<number, ChatMessage>;
  
  private userCurrentId: number;
  private projectCurrentId: number;
  private reportCurrentId: number;
  private chatMessageCurrentId: number;

  constructor() {
    this.users = new Map();
    this.tasksList = new Map();
    this.projectsList = new Map();
    this.reportsList = new Map();
    this.chatMessagesList = new Map();
    
    this.userCurrentId = 1;
    this.projectCurrentId = 1;
    this.reportCurrentId = 1;
    this.chatMessageCurrentId = 1;
    
    // Initialize with default reports
    this.initializeDefaults();
  }

  // Initialize default data
  private initializeDefaults() {
    // Default reports
    const defaultReports: InsertReport[] = [
      { 
        name: "Pending", 
        filter: "status:pending", 
        description: "Tasks that are pending completion" 
      },
      { 
        name: "Completed", 
        filter: "status:completed", 
        description: "Tasks that have been completed" 
      },
      { 
        name: "Due Soon", 
        filter: "due:today or due:tomorrow", 
        description: "Tasks due today or tomorrow" 
      },
      { 
        name: "All Tasks", 
        filter: "", 
        description: "All tasks in the system" 
      }
    ];
    
    defaultReports.forEach(report => this.createReport(report));
  }

  // User methods (existing)
  async getUser(id: number): Promise<any | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<any | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(user: any): Promise<any> {
    const id = this.userCurrentId++;
    const newUser = { ...user, id };
    this.users.set(id, newUser);
    return newUser;
  }

  // Task methods
  async getTasks(filter?: TaskFilter): Promise<TaskWithMetadata[]> {
    let tasks = Array.from(this.tasksList.values());
    
    // Apply filters
    if (filter) {
      if (filter.status) {
        tasks = tasks.filter(task => task.status === filter.status);
      }
      
      if (filter.project) {
        tasks = tasks.filter(task => task.project === filter.project);
      }
      
      if (filter.tag) {
        tasks = tasks.filter(task => {
          if (!task.tags) return false;
          const tagsList = Array.isArray(task.tags) 
            ? task.tags 
            : typeof task.tags === 'string' 
              ? [task.tags] 
              : [];
          return tagsList.includes(filter.tag!);
        });
      }
      
      if (filter.priority) {
        tasks = tasks.filter(task => task.priority === filter.priority);
      }
      
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        tasks = tasks.filter(task => 
          task.description.toLowerCase().includes(searchLower) || 
          (task.annotations && task.annotations.toLowerCase().includes(searchLower))
        );
      }
    }
    
    // Enhance with metadata
    return tasks.map(task => {
      const tagsList = task.tags && Array.isArray(task.tags) ? task.tags : [];
      return { ...task, tagsList };
    });
  }

  async getTask(id: string): Promise<TaskWithMetadata | undefined> {
    const task = this.tasksList.get(id);
    if (!task) return undefined;
    
    const tagsList = task.tags && Array.isArray(task.tags) ? task.tags : [];
    return { ...task, tagsList };
  }

  async createTask(task: InsertTask): Promise<Task> {
    const id = `task_${Date.now()}`;
    const now = new Date();
    const newTask: Task = { 
      ...task, 
      id, 
      created: now, 
      modified: now,
      tags: task.tags || []
    };
    
    this.tasksList.set(id, newTask);
    
    // Create project if it doesn't exist
    if (task.project) {
      const existingProject = Array.from(this.projectsList.values())
        .find(p => p.name === task.project);
      
      if (!existingProject) {
        await this.createProject({ name: task.project });
      }
    }
    
    return newTask;
  }

  async updateTask(id: string, updateData: Partial<Task>): Promise<Task | undefined> {
    const task = this.tasksList.get(id);
    if (!task) return undefined;
    
    const updatedTask: Task = { 
      ...task, 
      ...updateData,
      modified: new Date()
    };
    
    if (updateData.status === 'completed' && !updatedTask.completed) {
      updatedTask.completed = new Date();
    }
    
    this.tasksList.set(id, updatedTask);
    
    // Create project if it doesn't exist
    if (updateData.project && updateData.project !== task.project) {
      const existingProject = Array.from(this.projectsList.values())
        .find(p => p.name === updateData.project);
      
      if (!existingProject) {
        await this.createProject({ name: updateData.project });
      }
    }
    
    return updatedTask;
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasksList.delete(id);
  }

  // Project methods
  async getProjects(): Promise<Project[]> {
    return Array.from(this.projectsList.values());
  }

  async getProject(id: number): Promise<Project | undefined> {
    return this.projectsList.get(id);
  }

  async createProject(project: InsertProject): Promise<Project> {
    const id = this.projectCurrentId++;
    const newProject: Project = { ...project, id };
    this.projectsList.set(id, newProject);
    return newProject;
  }

  // Report methods
  async getReports(): Promise<Report[]> {
    return Array.from(this.reportsList.values());
  }

  async getReport(id: number): Promise<Report | undefined> {
    return this.reportsList.get(id);
  }

  async createReport(report: InsertReport): Promise<Report> {
    const id = this.reportCurrentId++;
    const newReport: Report = { ...report, id };
    this.reportsList.set(id, newReport);
    return newReport;
  }

  // Chat methods
  async getChatMessages(limit = 50): Promise<ChatMessage[]> {
    const messages = Array.from(this.chatMessagesList.values());
    
    // Sort by timestamp (oldest first)
    messages.sort((a, b) => {
      const aTime = a.timestamp ? a.timestamp.getTime() : 0;
      const bTime = b.timestamp ? b.timestamp.getTime() : 0;
      return aTime - bTime;
    });
    
    // Return limited number of messages
    return messages.slice(-limit);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const id = this.chatMessageCurrentId++;
    const newMessage: ChatMessage = { 
      ...message, 
      id, 
      timestamp: new Date() 
    };
    
    this.chatMessagesList.set(id, newMessage);
    return newMessage;
  }
}

// Create and export storage instance
export const storage = new MemStorage();
