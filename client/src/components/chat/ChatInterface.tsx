import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function ChatInterface() {
  const [isOpen, setIsOpen] = useState(true);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Fetch chat messages
  const { data: chatMessages = [] } = useQuery({
    queryKey: ['/api/chat'],
  });
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);
  
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (content: string) => {
      setIsSubmitting(true);
      return apiRequest("POST", "/api/chat", { content, role: "user" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat'] });
      setMessage("");
    },
    onError: (error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });
  
  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isSubmitting) {
      sendMessageMutation.mutate(message);
    }
  };
  
  if (!isOpen) {
    return (
      <Button 
        className="fixed bottom-4 right-4 rounded-full shadow-lg"
        onClick={() => setIsOpen(true)}
      >
        Chat with AI
      </Button>
    );
  }
  
  return (
    <div className="w-full md:w-80 flex-shrink-0 flex flex-col bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 h-full">
      <div className="p-3 bg-primary text-white font-medium flex items-center justify-between">
        <span>Task Assistant (AI)</span>
        <button 
          className="text-white focus:outline-none"
          onClick={() => setIsOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      <div className="flex-grow overflow-y-auto p-4 hide-scrollbar" style={{ maxHeight: "500px" }}>
        {/* Empty state */}
        {chatMessages.length === 0 && (
          <div className="flex justify-center items-center h-full text-gray-500 text-center">
            <div>
              <p>No messages yet.</p>
              <p className="text-sm mt-2">Ask a question about your tasks!</p>
            </div>
          </div>
        )}
        
        {/* Chat messages */}
        {chatMessages.map((msg: any) => (
          <div 
            key={msg.id} 
            className={`flex mb-4 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white flex-shrink-0">
                <span className="text-sm">AI</span>
              </div>
            )}
            
            <div 
              className={`${
                msg.role === "user" 
                  ? "mr-2 p-3 bg-primary text-white rounded-lg rounded-tr-none" 
                  : "ml-2 p-3 bg-gray-100 rounded-lg rounded-tl-none"
              } max-w-[85%]`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
            
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-white flex-shrink-0">
                <span className="text-sm">You</span>
              </div>
            )}
          </div>
        ))}
        
        {/* Show typing indicator when submitting */}
        {isSubmitting && (
          <div className="flex mb-4">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white flex-shrink-0">
              <span className="text-sm">AI</span>
            </div>
            <div className="ml-2 p-3 bg-gray-100 rounded-lg rounded-tl-none max-w-[85%]">
              <div className="flex space-x-1">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
            </div>
          </div>
        )}
        
        {/* Invisible element to scroll to */}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-3 border-t border-gray-200">
        <form className="flex items-center" onSubmit={handleSubmit}>
          <Input
            type="text"
            placeholder="Ask about your tasks..."
            className="flex-grow"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSubmitting}
          />
          <Button 
            type="submit" 
            className="ml-2" 
            disabled={isSubmitting || !message.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
