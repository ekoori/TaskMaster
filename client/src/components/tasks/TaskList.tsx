import { useState, useContext, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TaskItem from "./TaskItem";
import { MainLayoutContext } from "../layout/MainLayout";
import { TaskFilter, TaskWithMetadata } from "@shared/schema";

export default function TaskList() {
  const { currentFilter } = useContext(MainLayoutContext);
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState("priority");
  const [queryFilter, setQueryFilter] = useState<string>("");

  // Build query filter string based on currentFilter
  useEffect(() => {
    let filterParts: string[] = [];
    
    if (currentFilter.status) {
      filterParts.push(`status:${currentFilter.status}`);
    }
    
    if (currentFilter.project) {
      filterParts.push(`project:${currentFilter.project}`);
    }
    
    if (currentFilter.tag) {
      filterParts.push(`+${currentFilter.tag}`);
    }
    
    if (currentFilter.priority) {
      filterParts.push(`priority:${currentFilter.priority}`);
    }
    
    setQueryFilter(filterParts.join(" "));
  }, [currentFilter]);

  // Fetch tasks with more frequent updates and query invalidation
  const { data: tasks = [] as TaskWithMetadata[], isLoading, isError } = useQuery<TaskWithMetadata[]>({
    queryKey: ['/api/tasks', queryFilter],
    refetchInterval: 3000, // Refetch more frequently (every 3 seconds)
    refetchOnWindowFocus: true,
    staleTime: 1000, // Consider data stale after 1 second
  });

  // Filter tasks by search text
  const filteredTasks = tasks.filter((task: TaskWithMetadata) => {
    if (searchText === "") return true;
    
    return (
      task.description.toLowerCase().includes(searchText.toLowerCase()) ||
      (task.annotations && task.annotations.toLowerCase().includes(searchText.toLowerCase()))
    );
  });

  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a: TaskWithMetadata, b: TaskWithMetadata) => {
    switch (sortBy) {
      case "priority":
        // Priority order: H > M > L > null
        const priorityOrder: Record<string, number> = { H: 3, M: 2, L: 1 };
        const bPriority = b.priority as string | undefined;
        const aPriority = a.priority as string | undefined;
        return (priorityOrder[bPriority || ''] || 0) - (priorityOrder[aPriority || ''] || 0);
        
      case "dueDate":
        // Sort by due date (null values at the end)
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return new Date(a.due).getTime() - new Date(b.due).getTime();
        
      case "project":
        // Sort by project name alphabetically
        const projA = a.project || "zzz"; // Put empty projects at the end
        const projB = b.project || "zzz";
        return projA.localeCompare(projB);
        
      default:
        return 0;
    }
  });

  // Determine what title to show
  const getTitle = () => {
    if (currentFilter.report) {
      return currentFilter.report;
    }
    
    if (currentFilter.project) {
      return `Project: ${currentFilter.project}`;
    }
    
    if (currentFilter.tag) {
      return `Tag: ${currentFilter.tag}`;
    }
    
    return "All Tasks";
  };

  return (
    <div className="flex-grow overflow-auto md:pr-4 mb-4 md:mb-0">
      {/* Task Controls */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between">
        <h2 className="text-2xl font-medium mb-2 sm:mb-0">{getTitle()}</h2>
        <div className="flex items-center">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search tasks..."
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <Search className="absolute left-3 top-2 text-gray-400 h-5 w-5" />
          </div>
          <div className="ml-2">
            <Select
              value={sortBy}
              onValueChange={setSortBy}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Sort by Priority</SelectItem>
                <SelectItem value="dueDate">Sort by Due Date</SelectItem>
                <SelectItem value="project">Sort by Project</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="py-10 text-center text-gray-500">
          Loading tasks...
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="py-10 text-center text-red-500">
          Error loading tasks. Please try again.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && sortedTasks.length === 0 && (
        <div className="py-10 text-center text-gray-500">
          No tasks found. Add a new task to get started.
        </div>
      )}

      {/* Task Cards */}
      <div className="space-y-4">
        {sortedTasks.map((task: TaskWithMetadata) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
