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
    
    const taskData = {
      description: data.description,
      annotations: data.annotations || null,
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
      setOpen(true);
    };
    
    window.addEventListener('editTask', handleEditTask);
    
    return () => {
      window.removeEventListener('editTask', handleEditTask);
    };
  }, [form]);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[525px]">
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
            
            <FormField
              control={form.control}
              name="annotations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Details (optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add additional details..." 
                      className="resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
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
                onClick={() => setOpen(false)}
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
