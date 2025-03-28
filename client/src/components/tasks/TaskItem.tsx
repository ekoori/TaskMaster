import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Edit, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { TaskWithMetadata } from "@shared/schema";

// Priority color mapping
const priorityColors: Record<string, string> = {
  H: "border-red-500",
  M: "border-amber-500",
  L: "border-blue-500",
  "": "border-gray-300",
  completed: "border-gray-300"
};

// Format relative due date
const formatDueDate = (dueDate: string | Date) => {
  if (!dueDate) return null;
  
  const date = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  
  if (isToday(date)) {
    return "Due today";
  }
  
  if (isTomorrow(date)) {
    return "Due tomorrow";
  }
  
  if (isPast(date)) {
    return `Overdue (${format(date, "MMM d")})`;
  }
  
  return `Due ${format(date, "MMM d")}`;
};

interface TaskItemProps {
  task: TaskWithMetadata;
}

export default function TaskItem({ task }: TaskItemProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCompleting, setIsCompleting] = useState(false);
  
  // States for collapsibles
  const [annotationsOpen, setAnnotationsOpen] = useState(false);
  const [dependenciesOpen, setDependenciesOpen] = useState(false);
  
  // Get all tasks from query client for displaying dependencies
  const allTasks = queryClient.getQueryData<TaskWithMetadata[]>(['/api/tasks']) || [];
  
  // Mutation to toggle task complete
  const toggleCompleteMutation = useMutation({
    mutationFn: async (taskId: string) => {
      setIsCompleting(true);
      const newStatus = task.status === "completed" ? "pending" : "completed";
      return apiRequest("PATCH", `/api/tasks/${taskId}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: task.status === "completed" ? "Task marked as pending" : "Task completed",
        description: task.description,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update task",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsCompleting(false);
    }
  });
  
  // Mutation to delete task
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => {
      return apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: "Task deleted",
        description: task.description,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete task",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Handle task edit
  const handleEdit = () => {
    window.dispatchEvent(new CustomEvent('editTask', { detail: task }));
  };
  
  // Handle task delete with confirmation
  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${task.description}"?`)) {
      deleteTaskMutation.mutate(task.id);
    }
  };
  
  // Get the border color based on priority
  const getBorderColor = () => {
    if (task.status === "completed") {
      return priorityColors.completed;
    }
    
    const priority = task.priority as string | undefined;
    // Use type assertion to handle the string index
    return priorityColors[priority || ""];
  };
  
  // Use react-query directly to ensure we have the latest data
  const { data: allTasksData = [] } = useQuery({ 
    queryKey: ['/api/tasks'], 
    enabled: true,
    staleTime: 0 // Always fetch fresh data
  });
  
  // Find dependent tasks
  const getDependentTasks = () => {
    console.log("Task with depends:", task.description, task.depends);
    
    // Use tasks from the query directly instead of queryClient.getQueryData
    const currentAllTasks = allTasksData as TaskWithMetadata[];
    
    if (!task.depends || task.depends.length === 0) {
      console.log("No dependencies for task:", task.description);
      return [];
    }
    
    const foundTasks = task.depends
      .map(depId => {
        const foundTask = currentAllTasks.find(t => t.id === depId);
        if (!foundTask) {
          console.log("Could not find dependency with ID:", depId);
        }
        return foundTask;
      })
      .filter(Boolean) as TaskWithMetadata[];
    
    console.log("Found dependent tasks:", foundTasks.length, foundTasks.map(t => t.description));
    return foundTasks;
  };
  
  // Get dependent tasks
  const dependentTasks = getDependentTasks();
  
  // Format annotations into array
  const annotationsList = task.annotations ? 
    task.annotations.split('\n').filter(Boolean) : [];
  
  return (
    <div 
      className={cn(
        "bg-white rounded-lg shadow-md p-4 border-l-4",
        getBorderColor(),
        task.status === "completed" && "opacity-70"
      )}
    >
      <div className="flex justify-between items-start">
        <div className="flex-grow">
          <div className="flex items-center mb-2">
            <Checkbox 
              className="w-5 h-5 mr-3 cursor-pointer"
              checked={task.status === "completed"}
              onCheckedChange={() => toggleCompleteMutation.mutate(task.id)}
              disabled={isCompleting}
            />
            <h3 
              className={cn(
                "text-lg font-medium",
                task.status === "completed" && "line-through text-gray-500"
              )}
            >
              {task.description}
            </h3>
          </div>
          <div className="ml-8">
            <div className="flex flex-wrap gap-2 mb-2">
              {/* Priority Badge */}
              {task.priority && (
                <span className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                  task.status === "completed" 
                    ? "bg-gray-100 text-gray-800" 
                    : task.priority === "H" 
                    ? "bg-red-100 text-red-800"
                    : task.priority === "M"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-blue-100 text-blue-800"
                )}>
                  <span className="mr-1 text-xs">⚑</span>
                  {task.priority === "H" ? "High" : task.priority === "M" ? "Medium" : "Low"}
                </span>
              )}
              
              {/* Project Badge */}
              {task.project && (
                <span className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                  task.status === "completed" 
                    ? "bg-gray-100 text-gray-800" 
                    : "bg-purple-100 text-purple-800"
                )}>
                  <span className="mr-1 text-xs">📁</span>
                  {task.project}
                </span>
              )}
              
              {/* Due Date Badge */}
              {task.due && (
                <span className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                  task.status === "completed" 
                    ? "bg-gray-100 text-gray-800" 
                    : isPast(new Date(task.due)) && task.status !== "completed"
                    ? "bg-red-100 text-red-800"
                    : "bg-amber-100 text-amber-800"
                )}>
                  <span className="mr-1 text-xs">⏱</span>
                  {formatDueDate(task.due)}
                </span>
              )}
              
              {/* Tags Badges */}
              {task.tagsList && task.tagsList.map((tag: string) => (
                <span key={tag} className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                  task.status === "completed" 
                    ? "bg-gray-100 text-gray-800" 
                    : "bg-green-100 text-green-800"
                )}>
                  <span className="mr-1 text-xs">🏷</span>
                  {tag}
                </span>
              ))}
              
              {/* Completed Badge */}
              {task.status === "completed" && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  <span className="mr-1 text-xs">✓</span>
                  Completed
                </span>
              )}
            </div>
            
            {/* Collapsible Annotations Section */}
            {annotationsList.length > 0 && (
              <div className="mb-2 border rounded-md overflow-hidden">
                <div 
                  className="border-b px-3 py-2 flex justify-between items-center bg-gray-50 cursor-pointer"
                  onClick={() => setAnnotationsOpen(!annotationsOpen)}
                >
                  <div className="flex items-center text-sm font-medium text-gray-700">
                    {annotationsOpen ? 
                      <ChevronDown className="h-4 w-4 mr-1" /> : 
                      <ChevronRight className="h-4 w-4 mr-1" />
                    }
                    Comments ({annotationsList.length})
                  </div>
                </div>
                
                {annotationsOpen && (
                  <div className="p-2">
                    <div className="space-y-2">
                      {annotationsList.map((comment, idx) => (
                        <div 
                          key={idx} 
                          className={cn(
                            "text-sm text-gray-700 p-1.5 border-l-2 border-gray-300 pl-2 bg-gray-50 rounded",
                            task.status === "completed" && "text-gray-500"
                          )}
                        >
                          {comment}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Collapsible Dependencies Section */}
            {dependentTasks.length > 0 && (
              <div className="mb-2 border rounded-md overflow-hidden">
                <div 
                  className="border-b px-3 py-2 flex justify-between items-center bg-gray-50 cursor-pointer"
                  onClick={() => setDependenciesOpen(!dependenciesOpen)}
                >
                  <div className="flex items-center text-sm font-medium text-gray-700">
                    {dependenciesOpen ? 
                      <ChevronDown className="h-4 w-4 mr-1" /> : 
                      <ChevronRight className="h-4 w-4 mr-1" />
                    }
                    Dependencies ({dependentTasks.length})
                  </div>
                </div>
                
                {dependenciesOpen && (
                  <div className="p-2">
                    <div className="space-y-3">
                      {dependentTasks.map((depTask) => (
                        <div 
                          key={depTask.id}
                          className="embedded-task p-2 border rounded shadow-sm"
                        >
                          <div className="flex items-start">
                            <div className="flex items-center">
                              <div className={cn(
                                "w-2 h-2 rounded-full mr-2",
                                depTask.status === "completed" ? "bg-green-500" : 
                                depTask.priority === "H" ? "bg-red-500" : 
                                depTask.priority === "M" ? "bg-amber-500" : 
                                depTask.priority === "L" ? "bg-blue-500" : "bg-gray-300"
                              )}></div>
                              <span className="text-xs bg-gray-200 px-1 rounded mr-2 text-gray-700">{depTask.id.substring(0, 8)}</span>
                            </div>
                            <span className={cn(
                              "text-sm font-medium flex-grow",
                              depTask.status === "completed" && "line-through text-gray-500"
                            )}>
                              {depTask.description}
                            </span>
                            {depTask.status === "completed" && (
                              <span className="ml-1 text-green-600 text-xs">✓</span>
                            )}
                          </div>
                          
                          {/* Mini version of badges */}
                          {(depTask.priority || depTask.project || depTask.due || depTask.tagsList?.length > 0) && (
                            <div className="flex flex-wrap gap-1 mt-1 ml-4">
                              {depTask.priority && (
                                <span className="text-xs px-1 py-0.5 rounded bg-gray-100 text-gray-600">
                                  {depTask.priority === "H" ? "High" : depTask.priority === "M" ? "Med" : "Low"}
                                </span>
                              )}
                              
                              {depTask.project && (
                                <span className="text-xs px-1 py-0.5 rounded bg-gray-100 text-gray-600">
                                  {depTask.project}
                                </span>
                              )}
                              
                              {depTask.due && (
                                <span className="text-xs px-1 py-0.5 rounded bg-gray-100 text-gray-600">
                                  {formatDueDate(depTask.due)}
                                </span>
                              )}
                              
                              {depTask.tagsList && depTask.tagsList.length > 0 && (
                                <span className="text-xs px-1 py-0.5 rounded bg-gray-100 text-gray-600">
                                  {depTask.tagsList.join(', ')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex">
          <button 
            className="text-gray-500 hover:text-primary focus:outline-none"
            onClick={handleEdit}
          >
            <Edit className="h-5 w-5" />
          </button>
          <button 
            className="ml-2 text-gray-500 hover:text-red-500 focus:outline-none"
            onClick={handleDelete}
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}