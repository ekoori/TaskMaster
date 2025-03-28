import React, { useContext, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Folder, ClipboardList, CheckCircle, Clock, List, Tag, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MainLayoutContext } from "./MainLayout";
import { TaskFilter } from "@shared/schema";

export default function Sidebar() {
  const { sidebarVisible, setCurrentFilter, currentFilter } = useContext(MainLayoutContext);
  const queryClient = useQueryClient();
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  
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
  
  // Toggle project expansion
  const toggleProjectExpand = (path: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };
  
  // Build hierarchical project tree
  const renderProjectTree = (allProjects: ProjectItem[]) => {
    // Build tree structure from flat list with dot notation
    const projectTree: Record<string, any> = {};
    
    // Sort projects by name for consistent ordering
    const sortedProjects = [...allProjects].sort((a, b) => 
      a.name.localeCompare(b.name)
    );
    
    // First pass - build the tree structure
    sortedProjects.forEach(project => {
      const segments = project.name.split('.');
      let currentLevel = projectTree;
      
      segments.forEach((segment, index) => {
        if (!currentLevel[segment]) {
          currentLevel[segment] = {
            projects: {},
            fullPath: segments.slice(0, index + 1).join('.'),
            name: segment, 
            id: project.id
          };
        }
        
        currentLevel = currentLevel[segment].projects;
      });
    });
    
    // Recursively render the project tree
    const renderLevel = (nodes: Record<string, any>, level = 0, parentPath = '') => {
      return (
        <ul className={level > 0 ? "pl-4" : ""}>
          {Object.keys(nodes).map((key) => {
            const node = nodes[key];
            const hasChildren = Object.keys(node.projects).length > 0;
            const fullPath = node.fullPath;
            const isExpanded = expandedProjects[fullPath] !== false; // Default to expanded
            
            return (
              <li key={fullPath} className="mb-1">
                <div className="flex items-center">
                  {hasChildren && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleProjectExpand(fullPath);
                      }}
                      className="w-5 h-5 inline-flex items-center justify-center text-gray-500 mr-1"
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  )}
                  {!hasChildren && <span className="w-5 h-5 mr-1"></span>}
                  
                  <a 
                    href="#" 
                    className={cn(
                      "flex items-center py-1 px-2 rounded hover:bg-gray-100 text-gray-700 hover:text-primary transition-colors flex-grow",
                      currentFilter.project === fullPath && "bg-gray-100 text-primary"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      handleProjectClick(fullPath);
                    }}
                  >
                    <Folder className="mr-2 text-neutral-500" size={16} />
                    <span>{node.name}</span>
                  </a>
                </div>
                
                {hasChildren && isExpanded && (
                  renderLevel(node.projects, level + 1, fullPath)
                )}
              </li>
            );
          })}
        </ul>
      );
    };
    
    return renderLevel(projectTree);
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
        {renderProjectTree(projects)}
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
