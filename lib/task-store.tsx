"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./auth-context";
import type { StudentTask } from "../types";

type TaskCreateInput = {
  title: string;
  description?: string;
  classId?: string;
  dueAt?: string;
  type?: StudentTask["type"];
  reminderAt?: string;
  source?: StudentTask["source"];
  status?: StudentTask["status"];
};

type TaskUpdateInput = Partial<TaskCreateInput>;

type TaskStoreContextValue = {
  tasks: StudentTask[];
  removingIds: Set<string>;
  loading: boolean;
  addTask: (task: TaskCreateInput) => Promise<StudentTask>;
  updateTask: (taskId: string, updates: TaskUpdateInput) => Promise<StudentTask>;
  completeTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
};

const TaskStoreContext = createContext<TaskStoreContextValue | null>(null);

export function TaskStoreProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const loadTasks = useCallback(async () => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/tasks", { cache: "no-store" });
      const json = (await response.json()) as { data?: StudentTask[]; error?: string };

      if (!response.ok) {
        throw new Error(json.error ?? "Failed to load tasks.");
      }

      setTasks(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void loadTasks();
  }, [authLoading, loadTasks]);

  const addTask = useCallback(async (task: TaskCreateInput) => {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task }),
    });
    const json = (await response.json()) as { data?: StudentTask; error?: string };

    if (!response.ok || !json.data) {
      throw new Error(json.error ?? "Failed to save task.");
    }

    setTasks((prev) => [json.data as StudentTask, ...prev]);
    return json.data;
  }, []);

  const updateTask = useCallback(async (taskId: string, updates: TaskUpdateInput) => {
    const response = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, updates }),
    });
    const json = (await response.json()) as { data?: StudentTask; error?: string };

    if (!response.ok || !json.data) {
      throw new Error(json.error ?? "Failed to update task.");
    }

    setTasks((prev) => prev.map((task) => (task.id === taskId ? json.data! : task)));
    return json.data;
  }, []);

  const completeTask = useCallback(async (taskId: string) => {
    const completedTask = await updateTask(taskId, { status: "done" });
    setRemovingIds((prev) => new Set(prev).add(taskId));

    window.setTimeout(() => {
      setTasks((prev) => prev.filter((task) => task.id !== completedTask.id));
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }, 650);
  }, [updateTask]);

  const deleteTask = useCallback(async (taskId: string) => {
    const response = await fetch("/api/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId }),
    });
    const json = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(json.error ?? "Failed to delete task.");
    }

    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  }, []);

  const value = useMemo(
    () => ({ tasks, removingIds, loading, addTask, updateTask, completeTask, deleteTask }),
    [tasks, removingIds, loading, addTask, updateTask, completeTask, deleteTask],
  );

  return <TaskStoreContext.Provider value={value}>{children}</TaskStoreContext.Provider>;
}

export function useTaskStore(): TaskStoreContextValue {
  const ctx = useContext(TaskStoreContext);
  if (!ctx) {
    throw new Error("useTaskStore must be used inside TaskStoreProvider");
  }
  return ctx;
}
