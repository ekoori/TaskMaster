import OpenAI from "openai";
import { ChatMessage } from "@shared/schema";
import { TaskwarriorService } from "./taskwarrior";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const OPENAI_MODEL = "gpt-4o";

class OpenAIService {
  private openai: OpenAI;
  private taskwarrior: TaskwarriorService;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "", // Will be provided through environment variables
    });
    this.taskwarrior = new TaskwarriorService();
  }
  
  // Generate system message for the AI
  private generateSystemMessage(): string {
    return `You are an AI task management assistant that helps users with their Taskwarrior tasks.
Your job is to help users manage their tasks, answer questions about task statuses, 
suggest optimizations for their workflow, and translate natural language requests into Taskwarrior commands.

IMPORTANT: You can execute Taskwarrior commands directly. To do this, reply in this format:
{EXECUTE_COMMAND: your_command_here}

For example, if the user asks "Add a task to buy milk", you can respond:
{EXECUTE_COMMAND: add buy milk}

Always provide helpful, concise responses. When users ask you to perform a task action, execute the command directly instead of just suggesting it.
If you're not sure about something, be honest about your limitations.

Here are some things you can help with:
- Executing Taskwarrior commands directly
- Explaining Taskwarrior concepts and commands
- Suggesting ways to organize tasks and projects
- Helping prioritize tasks
- Finding specific tasks
- Creating Taskwarrior filter expressions
- Translating natural language to Taskwarrior commands

Always respond in a friendly, helpful manner. After executing a command, explain what you did.`;
  }
  
  // Convert chat history for OpenAI API
  private formatChatHistory(chatHistory: ChatMessage[]): Array<OpenAI.Chat.ChatCompletionMessageParam> {
    // Start with system message
    const messages: Array<OpenAI.Chat.ChatCompletionMessageParam> = [
      { role: "system", content: this.generateSystemMessage() }
    ];
    
    // Add chat history
    chatHistory.forEach(message => {
      if (message.role === "user" || message.role === "assistant") {
        messages.push({
          role: message.role,
          content: message.content
        });
      }
    });
    
    return messages;
  }
  
  // Execute a Taskwarrior command and return the result
  async executeCommand(command: string): Promise<string> {
    try {
      console.log(`Executing Taskwarrior command: ${command}`);
      const result = await this.taskwarrior.executeCommand(command);
      return result;
    } catch (error: any) {
      console.error("Command execution error:", error);
      return `Error executing command: ${error.message}`;
    }
  }

  // Send message to OpenAI and get response
  async sendMessage(message: string, chatHistory: ChatMessage[]): Promise<string> {
    try {
      // Add current message to history
      const updatedHistory = [
        ...chatHistory,
        { id: 0, content: message, role: "user", timestamp: new Date() }
      ];
      
      const formattedMessages = this.formatChatHistory(updatedHistory);
      
      // Get tasks from Taskwarrior to provide context
      const tasks = await this.taskwarrior.getTasks();
      const taskContext = `Current tasks (${tasks.length} total):\n` + 
        tasks.slice(0, 10).map((t: any) => 
          `- ${t.description} (${t.status}, ${t.project || 'No project'}, ${t.priority || 'No priority'}, ${t.due ? 'Due: ' + t.due.toISOString().split('T')[0] : 'No due date'})`
        ).join('\n');
      
      // Add task context as a system message
      formattedMessages.push({ 
        role: "system", 
        content: taskContext
      } as OpenAI.Chat.ChatCompletionSystemMessageParam);
      
      // Call OpenAI API
      const completion = await this.openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 1000,
      });
      
      const response = completion.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
      
      // Check if the response contains a command to execute
      const commandMatch = response.match(/\{EXECUTE_COMMAND: (.*?)\}/);
      if (commandMatch && commandMatch[1]) {
        const command = commandMatch[1].trim();
        const commandResult = await this.executeCommand(command);
        
        // Replace the command syntax with the execution result
        const updatedResponse = response.replace(/\{EXECUTE_COMMAND: .*?\}/, 
          `I executed the command: \`${command}\`\n\nResult:\n\`\`\`\n${commandResult}\n\`\`\``);
        
        return updatedResponse;
      }
      
      return response;
    } catch (error: any) {
      console.error("OpenAI API error:", error);
      return `I encountered an error: ${error.message}. Please try again later.`;
    }
  }

  // Parse natural language into Taskwarrior command
  async parseCommand(text: string): Promise<string> {
    try {
      const messages: Array<OpenAI.Chat.ChatCompletionMessageParam> = [
        {
          role: "system",
          content: `You are a translator from natural language to Taskwarrior commands.
Convert the user's request into the corresponding Taskwarrior command.
Respond with ONLY the Taskwarrior command, nothing else. Do not include any explanations or markdown.
For example, if the user says "Show me all my pending tasks", you should respond with just "task status:pending list".`
        },
        { role: "user", content: text }
      ];
      
      const completion = await this.openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: messages,
        temperature: 0.3,
        max_tokens: 150,
      });
      
      return completion.choices[0].message.content || "";
    } catch (error: any) {
      console.error("OpenAI command parsing error:", error);
      return ""; // Return empty string to indicate failure
    }
  }
}

export default new OpenAIService();
