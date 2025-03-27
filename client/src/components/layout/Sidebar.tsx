import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { Folder, ClipboardList, CheckCircle, Clock, List, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { MainLayoutContext } from "./MainLayout";
import { TaskFilter } from "@shared/schema";

export default function Sidebar() {
  const { sidebarVisible, setCurrentFilter, currentFilter } = useContext(MainLayoutContext);
  
  // Fetch reports
  const { data: reports = [] } = useQuery({
    queryKey: ['/api/reports'],
  });
  
  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects'],
  });
  
  // Fetch tags
  const { data: tags = [] } = useQuery({
    queryKey: ['/api/tags'],
  });
  
  const handleReportClick = (filter: string, reportName: string) => {
    setCurrentFilter({ report: reportName, ...JSON.parse(filter) });
  };
  
  const handleProjectClick = (project: string) => {
    setCurrentFilter({ ...currentFilter, project });
  };
  
  const handleTagClick = (tag: string) => {
    setCurrentFilter({ ...currentFilter, tag });
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
          {reports.map((report: any) => (
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
          {projects.map((project: any) => (
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
          {tags.map((tag: any) => (
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
