"use client";

// TODO: Replace this in-memory store with Supabase-backed persistence once auth is wired up.

import { createContext, useContext, useState } from "react";
import { mockTasks } from "./mock-data";
import type { StudentTask } from "../types";

type TaskStoreContextValue = {
  tasks: StudentTask[];
  addTask: (task: StudentTask) => void;
};

const TaskStoreContext = createContext<TaskStoreContextValue | null>(null);

export function TaskStoreProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<StudentTask[]>(mockTasks);

  const addTask = (task: StudentTask) => {
    setTasks((prev) => [task, ...prev]);
  };

  return (
    <TaskStoreContext.Provider value={{ tasks, addTask }}>
      {children}
    </TaskStoreContext.Provider>
  );
}

export function useTaskStore(): TaskStoreContextValue {
  const ctx = useContext(TaskStoreContext);
  if (!ctx) {
    throw new Error("useTaskStore must be used inside TaskStoreProvider");
  }
  return ctx;
}
