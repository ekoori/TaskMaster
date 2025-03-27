import React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";

function Router() {
  return React.createElement(
    Switch,
    null,
    React.createElement(Route, { path: "/", component: Home }),
    // Fallback to 404
    React.createElement(Route, { component: NotFound })
  );
}

function App() {
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(Router, null),
    React.createElement(Toaster, null)
  );
}

export default App;
