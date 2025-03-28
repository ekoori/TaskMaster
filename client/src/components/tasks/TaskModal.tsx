import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
    
    // Get the newComment from our state and append it to existing annotations if needed
    const annotations = processAnnotations(data.annotations, newComment);
    
    const taskData = {
      description: data.description,
      annotations,
      project: data.project || null,
      priority,
      tags: tagsArray.length > 0 ? tagsArray : null,
      due,
      depends: dependsArray.length > 0 ? dependsArray : null,
    };
    
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
          <DialogTitle>{isEdit ? "Edit Task" : "Add New Task"}</DialogTitle>
          <DialogDescription>
            {isEdit 
              ? "Update the details of your task." 
              : "Fill in the details to create a new task."}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="What needs to be done?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Annotations - shown as comments */}
            <div className="space-y-3">
              {/* Existing comments field - hidden, only for storage */}
              <FormField
                control={form.control}
                name="annotations"
                render={({ field }) => (
                  <input type="hidden" {...field} />
                )}
              />
              
              {/* Comments section */}
              <div className="space-y-3">
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
                
                {/* New comment input */}
                <div>
                  <label htmlFor="new-comment" className="block text-sm font-medium text-gray-700 mb-1">
                    Add Comment
                  </label>
                  <Textarea 
                    id="new-comment"
                    placeholder="Type a new comment..." 
                    className="resize-none w-full" 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    New comments will be added to the top of the list
                  </p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="project"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <FormControl>
                      <Input placeholder="Project name" {...field} />
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
                      onValueChange={field.onChange} 
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
                      <Input type="date" {...field} />
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
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dependencies (comma separated task IDs)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. 123abc, 456def" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-gray-500">
                    Tasks that must be completed before this one
                  </p>
                </FormItem>
              )}
            />
            
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
              <Button 
                type="submit" 
                disabled={createTaskMutation.isPending || updateTaskMutation.isPending}
              >
                {isEdit ? "Update Task" : "Save Task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
