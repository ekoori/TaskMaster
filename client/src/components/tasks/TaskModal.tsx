import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TaskWithMetadata } from "@shared/schema";
import { format } from "date-fns";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

// Task form schema
const taskFormSchema = z.object({
  description: z.string().min(1, "Description is required"),
  annotations: z.string().optional(),
  project: z.string().optional(),
  priority: z.string().optional(),
  due: z.string().optional(),
  tags: z.string().optional(),
  depends: z.string().optional(), // Comma-separated list of task IDs
});

export default function TaskModal() {
  const [open, setOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Setup form
  const form = useForm({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      description: "",
      annotations: "",
      project: "",
      priority: "",
      due: "",
      tags: "",
      depends: "",
    },
  });
  
  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: (taskData: any) => {
      return apiRequest("POST", "/api/tasks", taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
      
      toast({
        title: "Task created",
        description: "Your task has been created successfully.",
      });
      
      setOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Failed to create task",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, taskData }: { id: string, taskData: any }) => {
      return apiRequest("PATCH", `/api/tasks/${id}`, taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
      
      toast({
        title: "Task updated",
        description: "Your task has been updated successfully.",
      });
      
      setOpen(false);
      setIsEdit(false);
      setCurrentTaskId(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Failed to update task",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // State to track the new comment being added
  const [newComment, setNewComment] = useState("");
  
  // Keep existing annotations and add a new comment if provided
  const processAnnotations = (existingAnnotations: string | null | undefined, newComment: string) => {
    // Skip if no new comment
    if (!newComment.trim()) {
      return existingAnnotations || null;
    }
    
    // If there's already content, add the new comment at the beginning (preserving newest-first order)
    if (existingAnnotations) {
      return `${newComment.trim()}\n${existingAnnotations}`;
    }
    
    // Just the new comment
    return newComment.trim();
  };
  
  // Handle form submission
  const onSubmit = (data: z.infer<typeof taskFormSchema>) => {
    // Process tags
    const tagsArray = data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    
    // Process dependencies
    const dependsArray = data.depends ? data.depends.split(',').map(d => d.trim()).filter(Boolean) : [];
    
    // Convert "none" priority to empty string or null
    const priority = data.priority === "none" ? "" : data.priority;
    
    // Process due date (convert from string to Date or null)
    const due = data.due ? new Date(data.due) : null;
    
    // Create partial task data for updates
    let taskData: any = {
      description: data.description,
      project: data.project || null,
      priority,
      tags: tagsArray.length > 0 ? tagsArray : null,
      due,
      depends: dependsArray.length > 0 ? dependsArray : null,
    };
    
    // Only add annotations if we're adding a new comment or already have annotations
    if (newComment.trim() || data.annotations) {
      // Get the newComment from our state and append it to existing annotations if needed
      taskData.annotations = processAnnotations(data.annotations, newComment);
    }
    
    if (isEdit && currentTaskId) {
      updateTaskMutation.mutate({ id: currentTaskId, taskData });
    } else {
      createTaskMutation.mutate(taskData);
    }
    
    // Reset new comment
    setNewComment("");
  };
  
  // Listen for add task event
  useEffect(() => {
    const handleOpenAddTaskModal = () => {
      form.reset({
        description: "",
        annotations: "",
        project: "",
        priority: "none",
        due: "",
        tags: "",
        depends: "",
      });
      setIsEdit(false);
      setCurrentTaskId(null);
      setNewComment(""); // Reset new comment field
      setOpen(true);
    };
    
    window.addEventListener('openAddTaskModal', handleOpenAddTaskModal);
    
    return () => {
      window.removeEventListener('openAddTaskModal', handleOpenAddTaskModal);
    };
  }, [form]);
  
  // Listen for edit task event
  useEffect(() => {
    const handleEditTask = (e: Event) => {
      const task = (e as CustomEvent).detail;
      
      if (!task) return;
      
      // Format due date for input if exists
      let dueDate = "";
      if (task.due) {
        const date = new Date(task.due);
        dueDate = format(date, "yyyy-MM-dd");
      }
      
      // Convert empty priority to "none" for the select input
      const priorityValue = task.priority || "none";
      
      form.reset({
        description: task.description || "",
        annotations: task.annotations || "",
        project: task.project || "",
        priority: priorityValue,
        due: dueDate,
        tags: task.tagsList ? task.tagsList.join(", ") : "",
        depends: task.depends ? task.depends.join(", ") : "",
      });
      
      setIsEdit(true);
      setCurrentTaskId(task.id);
      setNewComment(""); // Reset new comment field
      setOpen(true);
    };
    
    window.addEventListener('editTask', handleEditTask);
    
    return () => {
      window.removeEventListener('editTask', handleEditTask);
    };
  }, [form]);
  
  // Parse annotations to display as separate comments in reverse order (newest first)
  const displayAnnotations = (annotations: string | null | undefined) => {
    if (!annotations) return [];
    
    // Split by newlines and reverse order
    return annotations.split('\n').filter(Boolean).reverse();
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Task" : "Add New Task"}{isEdit && currentTaskId && <span className="ml-2 text-sm text-gray-500">ID: {currentTaskId.substring(0, 8)}</span>}</DialogTitle>
          <DialogDescription>
            {isEdit 
              ? "Update the details of your task." 
              : "Fill in the details to create a new task."}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Update Task button at the top */}
            {isEdit && (
              <div className="flex justify-end mb-4">
                <Button 
                  type="submit" 
                  disabled={createTaskMutation.isPending || updateTaskMutation.isPending}
                >
                  Update Task
                </Button>
              </div>
            )}
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="What needs to be done?" 
                      {...field} 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && isEdit && currentTaskId) {
                          e.preventDefault();
                          // Update only the description field
                          updateTaskMutation.mutate({ 
                            id: currentTaskId, 
                            taskData: { description: field.value } 
                          });
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Hide comments from top section - moved to bottom */}
            {/* Existing comments field - hidden, only for storage */}
            <FormField
              control={form.control}
              name="annotations"
              render={({ field }) => (
                <input type="hidden" {...field} />
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="project"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Project name" 
                        {...field} 
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && isEdit && currentTaskId) {
                            e.preventDefault();
                            // Update only the project field
                            updateTaskMutation.mutate({ 
                              id: currentTaskId, 
                              taskData: { project: field.value } 
                            });
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Auto-update when priority changes
                        if (isEdit && currentTaskId) {
                          const priority = value === "none" ? "" : value;
                          updateTaskMutation.mutate({ 
                            id: currentTaskId, 
                            taskData: { priority }
                          });
                        }
                      }}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Priority</SelectItem>
                        <SelectItem value="L">Low</SelectItem>
                        <SelectItem value="M">Medium</SelectItem>
                        <SelectItem value="H">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="due"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && isEdit && currentTaskId) {
                            e.preventDefault();
                            // Update only the due date field
                            updateTaskMutation.mutate({ 
                              id: currentTaskId, 
                              taskData: { due: field.value ? new Date(field.value) : null } 
                            });
                          }
                        }}
                        onChange={(e) => {
                          field.onChange(e);
                          // Auto-update on change for date fields
                          if (isEdit && currentTaskId) {
                            updateTaskMutation.mutate({ 
                              id: currentTaskId, 
                              taskData: { due: e.target.value ? new Date(e.target.value) : null } 
                            });
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags (comma separated)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. urgent, meeting, next" 
                        {...field} 
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && isEdit && currentTaskId) {
                            e.preventDefault();
                            // Process tags into array
                            const tagsArray = field.value ? field.value.split(',').map(t => t.trim()).filter(Boolean) : [];
                            // Update only the tags field
                            updateTaskMutation.mutate({ 
                              id: currentTaskId, 
                              taskData: { tags: tagsArray.length > 0 ? tagsArray : null } 
                            });
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="depends"
              render={({ field }) => {
                // State for tracking the suggestions
                const [dependencySuggestions, setDependencySuggestions] = useState<TaskWithMetadata[]>([]);
                const [selectedDependencies, setSelectedDependencies] = useState<TaskWithMetadata[]>([]);
                const [searchInput, setSearchInput] = useState('');
                
                // Load tasks for suggestions
                const tasks = queryClient.getQueryData<TaskWithMetadata[]>(['/api/tasks']) || [];
                
                // Filtered tasks that don't include the current task
                const filteredTasks = tasks.filter(task => 
                  task.id !== currentTaskId && 
                  task.description.toLowerCase().includes(searchInput.toLowerCase())
                );
                
                // Effect to initialize selected dependencies when editing
                useEffect(() => {
                  if (isEdit && field.value) {
                    const dependencyIds = field.value.split(',').map(id => id.trim()).filter(Boolean);
                    
                    // Find the actual task objects for these IDs
                    const foundDependencies = tasks.filter(task => 
                      dependencyIds.includes(task.id)
                    );
                    
                    setSelectedDependencies(foundDependencies);
                  } else {
                    setSelectedDependencies([]);
                  }
                  
                  // Reset when modal closes
                  return () => {
                    setSelectedDependencies([]);
                    setDependencySuggestions([]);
                    setSearchInput('');
                  };
                }, [field.value, isEdit]);
                
                // Handle input change to filter suggestions
                const handleDependencySearch = (e: React.ChangeEvent<HTMLInputElement>) => {
                  setSearchInput(e.target.value);
                  
                  if (e.target.value.trim()) {
                    setDependencySuggestions(filteredTasks.slice(0, 5));
                  } else {
                    setDependencySuggestions([]);
                  }
                };
                
                // Handle dependency selection
                const handleDependencySelect = (task: TaskWithMetadata) => {
                  // Check if already selected
                  if (!selectedDependencies.some(dep => dep.id === task.id)) {
                    const newDeps = [...selectedDependencies, task];
                    setSelectedDependencies(newDeps);
                    
                    // Update the field value with comma-separated IDs
                    const idsString = newDeps.map(dep => dep.id).join(', ');
                    field.onChange(idsString);
                    
                    // If in edit mode, update the task
                    if (isEdit && currentTaskId) {
                      updateTaskMutation.mutate({
                        id: currentTaskId,
                        taskData: { depends: newDeps.map(dep => dep.id) }
                      });
                    }
                  }
                  
                  // Clear search input and suggestions
                  setSearchInput('');
                  setDependencySuggestions([]);
                };
                
                // Handle dependency removal
                const handleDependencyRemove = (taskId: string) => {
                  const newDeps = selectedDependencies.filter(dep => dep.id !== taskId);
                  setSelectedDependencies(newDeps);
                  
                  // Update the field value with comma-separated IDs
                  const idsString = newDeps.map(dep => dep.id).join(', ');
                  field.onChange(idsString);
                  
                  // If in edit mode, update the task
                  if (isEdit && currentTaskId) {
                    updateTaskMutation.mutate({
                      id: currentTaskId,
                      taskData: { depends: newDeps.length > 0 ? newDeps.map(dep => dep.id) : null }
                    });
                  }
                };
                
                return (
                  <FormItem className="relative">
                    <FormLabel>Dependencies</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Input 
                          placeholder="Search tasks by description..." 
                          value={searchInput}
                          onChange={handleDependencySearch}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setDependencySuggestions([]);
                            }
                          }}
                        />
                        
                        {/* Task suggestions dropdown */}
                        {dependencySuggestions.length > 0 && (
                          <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                            <ul className="py-1">
                              {dependencySuggestions.map(task => (
                                <li 
                                  key={task.id} 
                                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center text-sm"
                                  onClick={() => handleDependencySelect(task)}
                                >
                                  <span className="text-xs text-gray-500 mr-2">{task.id.substring(0, 8)}...</span>
                                  <span className="truncate">{task.description}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Selected dependencies display */}
                        {selectedDependencies.length > 0 && (
                          <div className="space-y-2 mt-2">
                            <div className="text-sm font-medium">Selected Dependencies:</div>
                            <div className="grid gap-2">
                              {selectedDependencies.map(dep => (
                                <div key={dep.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-md border text-sm">
                                  <div className="flex items-center">
                                    <span className="text-xs bg-gray-200 px-1 rounded mr-2">{dep.id.substring(0, 8)}...</span>
                                    <span className="truncate">{dep.description}</span>
                                  </div>
                                  <button 
                                    type="button"
                                    className="text-red-500 hover:text-red-700"
                                    onClick={() => handleDependencyRemove(dep.id)}
                                  >
                                    &times;
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Hidden input to store the actual value */}
                        <input type="hidden" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-gray-500">
                      Tasks that must be completed before this one
                    </p>
                  </FormItem>
                );
              }}
            />
            
            {/* Comments section moved to the bottom */}
            <div className="space-y-3 mt-6 pt-4 border-t">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">
                  {displayAnnotations(form.getValues().annotations).length > 0
                    ? `Comments (${displayAnnotations(form.getValues().annotations).length})` 
                    : "Comments"}
                </h3>
              </div>
              
              {/* Existing comments display */}
              {displayAnnotations(form.getValues().annotations).length > 0 && (
                <div className="space-y-2 max-h-[160px] overflow-y-auto p-2 border rounded-md bg-gray-50">
                  {displayAnnotations(form.getValues().annotations).map((comment, idx) => (
                    <div 
                      key={idx} 
                      className="p-2 bg-white rounded border shadow-sm"
                    >
                      <div className="text-sm text-gray-700">{comment}</div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* New comment input with dedicated submit button */}
              <div>
                <label htmlFor="new-comment" className="block text-sm font-medium text-gray-700 mb-1">
                  Add Comment
                </label>
                <div className="flex gap-2">
                  <Textarea 
                    id="new-comment"
                    placeholder="Type a new comment..." 
                    className="resize-none w-full" 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      // Allow for submitting with Ctrl+Enter or Cmd+Enter
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && newComment.trim()) {
                        e.preventDefault();
                        // Add the comment and update the task
                        const updatedAnnotations = processAnnotations(form.getValues().annotations, newComment);
                        if (isEdit && currentTaskId) {
                          updateTaskMutation.mutate({ 
                            id: currentTaskId, 
                            taskData: { annotations: updatedAnnotations } 
                          });
                          // Reset the comment field
                          setNewComment("");
                        }
                      }
                    }}
                  />
                  <Button 
                    type="button" 
                    disabled={!newComment.trim() || updateTaskMutation.isPending}
                    onClick={() => {
                      if (!newComment.trim() || !isEdit || !currentTaskId) return;
                      
                      // Add the comment and update the task
                      const updatedAnnotations = processAnnotations(form.getValues().annotations, newComment);
                      updateTaskMutation.mutate({ 
                        id: currentTaskId, 
                        taskData: { annotations: updatedAnnotations } 
                      });
                      // Reset the comment field
                      setNewComment("");
                    }}
                  >
                    Add
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  New comments will be added to the top of the list
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setOpen(false);
                  setNewComment("");
                }}
              >
                Cancel
              </Button>
              {!isEdit && (
                <Button 
                  type="submit" 
                  disabled={createTaskMutation.isPending || updateTaskMutation.isPending}
                >
                  Save Task
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}