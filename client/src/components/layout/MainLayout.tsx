import { useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { TaskFilter } from "@shared/schema";
import Terminal from "../terminal/Terminal";

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayoutContext = React.createContext<{
  terminalVisible: boolean;
  toggleTerminal: () => void;
  sidebarVisible: boolean;
  toggleSidebar: () => void;
  currentFilter: TaskFilter;
  setCurrentFilter: (filter: TaskFilter) => void;
}>({
  terminalVisible: false,
  toggleTerminal: () => {},
  sidebarVisible: true,
  toggleSidebar: () => {},
  currentFilter: {},
  setCurrentFilter: () => {},
});

export default function MainLayout({ children }: MainLayoutProps) {
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(window.innerWidth >= 1024);
  const [currentFilter, setCurrentFilter] = useState<TaskFilter>({});

  const toggleTerminal = () => setTerminalVisible(!terminalVisible);
  const toggleSidebar = () => setSidebarVisible(!sidebarVisible);

  return (
    <MainLayoutContext.Provider
      value={{
        terminalVisible,
        toggleTerminal,
        sidebarVisible,
        toggleSidebar,
        currentFilter,
        setCurrentFilter,
      }}
    >
      <div className="flex flex-col h-screen">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex-grow overflow-hidden flex flex-col">
            {terminalVisible && <Terminal />}
            {children}
          </div>
        </div>
      </div>
    </MainLayoutContext.Provider>
  );
}
