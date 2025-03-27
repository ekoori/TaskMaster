import { useContext } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, Code, Menu } from "lucide-react";
import { MainLayoutContext } from "./MainLayout";

export default function Header() {
  const { toggleTerminal, toggleSidebar } = useContext(MainLayoutContext);
  
  return (
    <header className="bg-primary shadow-md z-10">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            className="mr-2 text-white lg:hidden" 
            onClick={toggleSidebar}
          >
            <Menu />
          </Button>
          <h1 className="text-white text-xl font-medium">TaskMaster</h1>
        </div>
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            onClick={toggleTerminal}
            className="text-white" 
          >
            <Code className="mr-2 h-4 w-4" />
            <span className="hidden md:inline">Terminal</span>
          </Button>
          <Button 
            variant="secondary"
            onClick={() => window.dispatchEvent(new CustomEvent('openAddTaskModal'))}
            className="ml-4" 
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            <span className="hidden md:inline">Add Task</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
