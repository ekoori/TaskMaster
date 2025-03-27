import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import TaskList from "@/components/tasks/TaskList";
import ChatInterface from "@/components/chat/ChatInterface";
import TaskModal from "@/components/tasks/TaskModal";

export default function Home() {
  return React.createElement(
    MainLayout,
    null,
    React.createElement(
      "div",
      { className: "p-4 flex-grow flex flex-col md:flex-row gap-4 overflow-hidden" },
      React.createElement(TaskList, null),
      React.createElement(ChatInterface, null)
    ),
    React.createElement(TaskModal, null)
  );
}
