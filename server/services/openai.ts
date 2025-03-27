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
{EXECUTE_COMMAND: command_here}

DO NOT include "task" at the beginning of your commands. For example:
- If the user asks "Add a task to buy milk", respond with:
  {EXECUTE_COMMAND: add buy milk}
- If the user asks "Show me all pending tasks", respond with:
  {EXECUTE_COMMAND: status:pending list}
- If the user asks "Mark my homework task as done", respond with:
  {EXECUTE_COMMAND: homework done}

TASKWARRIOR SYNTAX GUIDELINES:
1. Date formats: Always use YYYY-MM-DD format (e.g., due:2025-04-01)
2. Relative dates: Use "due:today", "due:tomorrow", "due:sunday", "due:eom" (end of month), "due:eoy" (end of year)
3. For adding durations: "due:today+2d" (2 days from today), "due:now+1w" (1 week from now)
4. Time formats are not supported directly - only use dates, not times
5. Tags: Use +tag format (e.g., +work +important)
6. Priorities: Use priority:H (high), priority:M (medium), or priority:L (low)
7. For complex filters, combine attributes with spaces: "project:Home priority:H +urgent list"
8. For recurring tasks, use "recur:weekly" or "recur:daily" with the add command

COMMON COMMANDS:
- Add task: {EXECUTE_COMMAND: add Buy groceries due:tomorrow +shopping}
- List tasks: {EXECUTE_COMMAND: list} or {EXECUTE_COMMAND: all}
- Filter tasks: {EXECUTE_COMMAND: project:Home list}
- Complete task: {EXECUTE_COMMAND: 1 done} (where 1 is the task ID)
- Delete task: {EXECUTE_COMMAND: 1 delete}
- Modify task: {EXECUTE_COMMAND: 1 modify priority:H}
- Add project: {EXECUTE_COMMAND: add Make dinner project:Home}
- View projects: {EXECUTE_COMMAND: projects}
- View tags: {EXECUTE_COMMAND: tags}

Always provide helpful, concise responses. When users ask you to perform a task action, execute the command directly instead of just suggesting it.
If you're not sure about something, be honest about your limitations.

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
      // Check for potentially invalid time formats before execution
      if (command.includes('due:') || command.includes('wait:') || command.includes('until:') || command.includes('scheduled:')) {
        // Fix common time format issues
        if (command.match(/\d{1,2}:\d{2}/)) {
          console.warn("Detected time value in command, which Taskwarrior doesn't support well:", command);
          command = command.replace(/due:([^:\s]+\s+)?\d{1,2}:\d{2}/, 'due:$1');
          command = command.replace(/wait:([^:\s]+\s+)?\d{1,2}:\d{2}/, 'wait:$1');
          command = command.replace(/until:([^:\s]+\s+)?\d{1,2}:\d{2}/, 'until:$1');
          command = command.replace(/scheduled:([^:\s]+\s+)?\d{1,2}:\d{2}/, 'scheduled:$1');
          console.log("Fixed command:", command);
        }
      }
      
      console.log(`Executing Taskwarrior command: ${command}`);
      const result = await this.taskwarrior.executeCommand(command);
      return result;
    } catch (error: any) {
      console.error("Command execution error:", error);
      
      // Add more specific error messages for common issues
      if (error.message.includes("Invalid date") || error.message.includes("Invalid time")) {
        return `Error executing command: There was an issue with the date/time format. Please use YYYY-MM-DD format for dates or relative formats like 'today', 'tomorrow', or 'due:today+2d'.`;
      }
      
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
For example, if the user says "Show me all my pending tasks", you should respond with just "task status:pending list".

TASKWARRIOR SYNTAX GUIDELINES:
1. Date formats: Always use YYYY-MM-DD format (e.g., due:2025-04-01)
2. Relative dates: Use "due:today", "due:tomorrow", "due:sunday", "due:eom" (end of month), "due:eoy" (end of year)
3. For adding durations: "due:today+2d" (2 days from today), "due:now+1w" (1 week from now)
4. Time formats are not supported directly - only use dates, not times
5. Tags: Use +tag format (e.g., +work +important)
6. Priorities: Use priority:H (high), priority:M (medium), or priority:L (low)
7. For complex filters, combine attributes with spaces: "project:Home priority:H +urgent list"
8. For recurring tasks, use "recur:weekly" or "recur:daily" with the add command

Common taskwarrior patterns:
- Add task: task add Buy groceries due:tomorrow +shopping
- List tasks: task list or task all
- Filter tasks: task project:Home list
- Complete task: task 1 done
- Delete task: task 1 delete
- Modify task: task 1 modify priority:H`
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
