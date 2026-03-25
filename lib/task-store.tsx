"use client";

// TODO: Replace this in-memory store with Supabase-backed persistence once auth is wired up.

import { createContext, useContext, useState } from "react";
import { mockTasks } from "./mock-data";
import type { StudentTask } from "../types";

type TaskStoreContextValue = {
  tasks: StudentTask[];
  addTask: (task: StudentTask) => void;
  completeTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
};

const TaskStoreContext = createContext<TaskStoreContextValue | null>(null);

export function TaskStoreProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<StudentTask[]>(mockTasks);

  const addTask = (task: StudentTask) => {
    setTasks((prev) => [task, ...prev]);
  };

  const completeTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: "done" as const, updatedAt: new Date().toISOString() }
          : t
      )
    );
  };

  const deleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  return (
    <TaskStoreContext.Provider value={{ tasks, addTask, completeTask, deleteTask }}>
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
