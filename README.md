# TaskMaster - Taskwarrior Web Interface with AI

TaskMaster is a modern task management web application that integrates with Taskwarrior, providing an intelligent, interactive interface with AI-powered productivity enhancement tools.

## Features

- **Modern Web Interface** - Clean, responsive UI for managing your Taskwarrior tasks
- **AI Assistant** - OpenAI-powered assistant to help manage tasks through natural language
- **Real-time Task Management** - Create, update, filter, and complete tasks with a modern UI
- **Interactive Terminal** - In-browser terminal for direct Taskwarrior command execution
- **Task Filtering** - Advanced filtering capabilities by project, tag, status, and priority
- **Reports** - Create and view custom Taskwarrior reports
- **Dependency Management** - Track and manage dependencies between tasks

## Technologies

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Node.js, Express, Drizzle ORM
- **AI Integration**: OpenAI API
- **Task Management**: Taskwarrior

## Prerequisites

Before you install TaskMaster, make sure you have:

1. Node.js (v18 or newer)
2. npm or yarn
3. Taskwarrior installed on your system
4. OpenAI API key (for AI assistant features)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/taskmaster.git
cd taskmaster
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory with the following variables:

```
# OpenAI API key (needed for AI assistant)
OPENAI_API_KEY=your_openai_api_key
```


### 4. Configure Taskwarrior

Make sure Taskwarrior is properly installed on your system. The application will use a separate configuration stored in the project's `data/taskwarrior` directory.

## Running the Application

### Development Mode

```bash
npm run dev
```

This starts both the frontend and backend on http://localhost:5000.

### Production Build

```bash
npm run build
npm start
```

## Usage Guide

### Task Management

- **Viewing Tasks**: The main dashboard shows all tasks, organized by filter or project
- **Creating Tasks**: Click the "Add Task" button to create a new task
- **Updating Tasks**: Click on a task to edit its details
- **Completing Tasks**: Use the checkbox to mark tasks as complete

### AI Assistant

The AI assistant can help with:

- Adding tasks using natural language
- Finding and filtering tasks
- Setting priorities and due dates
- Getting suggestions for task organization

Example prompts:
- "Add a task to buy groceries tomorrow"
- "Show me all my high priority tasks"
- "What should I work on next?"

### Terminal Interface

For advanced users, the built-in terminal provides direct access to Taskwarrior commands:

- Use regular Taskwarrior syntax
- Results are displayed directly in the UI
- Changes made through terminal are immediately reflected in the web interface

## Extending TaskMaster

You can extend TaskMaster by:

- Creating custom reports and filters
- Adding new hooks in the `data/taskwarrior/hooks` directory
- Extending the AI capabilities with additional prompts and tools

## Troubleshooting

### Common Issues

- **OpenAI API Errors**: Check your API key is valid and has not expired
- **Taskwarrior Not Found**: Ensure Taskwarrior is properly installed and available in your system's PATH

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.