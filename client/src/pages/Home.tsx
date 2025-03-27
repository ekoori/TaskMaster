import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import TaskList from "@/components/tasks/TaskList";
import ChatInterface from "@/components/chat/ChatInterface";
import TaskModal from "@/components/tasks/TaskModal";

export default function Home() {
  return (
    <MainLayout>
      <div className="p-4 flex-grow flex flex-col md:flex-row gap-4 overflow-hidden">
        <TaskList />
        <ChatInterface />
      </div>
      <TaskModal />
    </MainLayout>
  );
}
