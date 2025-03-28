import { useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Folder, ClipboardList, CheckCircle, Clock, List, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { MainLayoutContext } from "./MainLayout";
import { TaskFilter } from "@shared/schema";

export default function Sidebar() {
  const { sidebarVisible, setCurrentFilter, currentFilter } = useContext(MainLayoutContext);
  const queryClient = useQueryClient();
  
  // Define interface for report, project, and tag items
  interface ReportItem {
    id: number;
    name: string;
    filter: string;
    description?: string;
  }
  
  interface ProjectItem {
    id: number;
    name: string;
  }
  
  interface TagItem {
    id: number;
    name: string;
  }
  
  // Fetch reports with refetch on window focus
  const { data: reports = [] } = useQuery<ReportItem[]>({
    queryKey: ['/api/reports'],
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Refetch every 5 seconds
  });
  
  // Fetch projects with refetch on window focus
  const { data: projects = [] } = useQuery<ProjectItem[]>({
    queryKey: ['/api/projects'],
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Refetch every 5 seconds
  });
  
  // Fetch tags with refetch on window focus
  const { data: tags = [] } = useQuery<TagItem[]>({
    queryKey: ['/api/tags'],
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Refetch every 5 seconds
  });
  
  const handleReportClick = (filter: string, reportName: string) => {
    try {
      // Clear any existing filters first
      const newFilter: TaskFilter = { report: reportName };
      
      console.log(`Applying report filter: ${reportName}`);
      
      setCurrentFilter(newFilter);
      
      // Invalidate tasks query to force refresh with all queryKeys that start with /api/tasks
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey[0];
          return typeof queryKey === 'string' && queryKey.startsWith('/api/tasks');
        }
      });
    } catch (error) {
      console.error("Error setting report filter:", error);
    }
  };
  
  const handleProjectClick = (project: string) => {
    // Reset current filter and set only project
    setCurrentFilter({ project });
    
    console.log(`Applying project filter: ${project}`);
    
    // Invalidate tasks query to force refresh with all queryKeys that start with /api/tasks
    queryClient.invalidateQueries({
      predicate: (query) => {
        const queryKey = query.queryKey[0];
        return typeof queryKey === 'string' && queryKey.startsWith('/api/tasks');
      }
    });
  };
  
  const handleTagClick = (tag: string) => {
    // Reset current filter and set only tag
    setCurrentFilter({ tag });
    
    console.log(`Applying tag filter: ${tag}`);
    
    // Invalidate tasks query to force refresh with all queryKeys that start with /api/tasks
    queryClient.invalidateQueries({
      predicate: (query) => {
        const queryKey = query.queryKey[0];
        return typeof queryKey === 'string' && queryKey.startsWith('/api/tasks');
      }
    });
  };
  
  // Map the lucide icons to report names
  const getReportIcon = (name: string) => {
    switch (name) {
      case "Pending":
        return <ClipboardList className="mr-2 text-neutral-500" />;
      case "Completed":
        return <CheckCircle className="mr-2 text-neutral-500" />;
      case "Due Soon":
        return <Clock className="mr-2 text-neutral-500" />;
      case "All Tasks":
        return <List className="mr-2" />;
      default:
        return <ClipboardList className="mr-2 text-neutral-500" />;
    }
  };
  
  if (!sidebarVisible) {
    return null;
  }
  
  return (
    <div className="w-64 bg-white shadow-lg p-4 flex-shrink-0 h-full lg:block overflow-y-auto transition-all duration-300 ease-in-out">
      <div className="mb-6">
        <h2 className="text-lg font-medium text-neutral-900 mb-3">Reports</h2>
        <ul>
          {reports.map((report: ReportItem) => (
            <li key={report.id} className="mb-2">
              <a 
                href="#" 
                className={cn(
                  "flex items-center p-2 rounded hover:bg-gray-100 text-gray-700 hover:text-primary transition-colors",
                  currentFilter.report === report.name && "bg-gray-100 text-primary"
                )}
                onClick={(e) => {
                  e.preventDefault();
                  handleReportClick(report.filter, report.name);
                }}
              >
                {getReportIcon(report.name)}
                <span>{report.name}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="mb-6">
        <h2 className="text-lg font-medium text-neutral-900 mb-3">Projects</h2>
        <ul>
          {projects.map((project: ProjectItem) => (
            <li key={project.id} className="mb-2">
              <a 
                href="#" 
                className={cn(
                  "flex items-center p-2 rounded hover:bg-gray-100 text-gray-700 hover:text-primary transition-colors",
                  currentFilter.project === project.name && "bg-gray-100 text-primary"
                )}
                onClick={(e) => {
                  e.preventDefault();
                  handleProjectClick(project.name);
                }}
              >
                <Folder className="mr-2 text-neutral-500" />
                <span>{project.name}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      
      <div>
        <h2 className="text-lg font-medium text-neutral-900 mb-3">Tags</h2>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag: TagItem) => (
            <a 
              key={tag.id}
              href="#" 
              className={cn(
                "bg-gray-100 px-3 py-1 rounded-full text-sm text-gray-700 hover:bg-primary hover:text-white transition-colors",
                currentFilter.tag === tag.name && "bg-primary text-white"
              )}
              onClick={(e) => {
                e.preventDefault();
                handleTagClick(tag.name);
              }}
            >
              <span>{tag.name}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
