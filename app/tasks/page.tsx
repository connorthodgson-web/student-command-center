// UI redesign pass
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SectionHeader } from "../../components/SectionHeader";
import { TaskInputBox } from "../../components/TaskInputBox";
import { ManualTaskForm } from "../../components/ManualTaskForm";
import { TaskCard } from "../../components/TaskCard";
import { sortTasksByDueDate } from "../../lib/tasks";
import type { SchoolClass, StudentTask } from "../../types";

type ViewMode = "timeline" | "by-class";
type AddMode = "smart" | "manual";

export default function TasksPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const loading = false;
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("scc-onboarding");
      if (raw) {
        const data = JSON.parse(raw) as { classes?: SchoolClass[] };
        if (Array.isArray(data.classes)) setClasses(data.classes);
      }
    } catch {}
    try {
      const raw = localStorage.getItem("scc-tasks");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setTasks(parsed as StudentTask[]);
      }
    } catch {}
  }, []);

  const saveTasks = useCallback((updated: StudentTask[]) => {
    try {
      localStorage.setItem("scc-tasks", JSON.stringify(updated));
    } catch {}
  }, []);

  const addTask = useCallback(
    async (partial: {
      title: string;
      description?: string;
      classId?: string;
      dueAt?: string;
      type?: StudentTask["type"];
      reminderAt?: string;
      source?: StudentTask["source"];
      status?: StudentTask["status"];
    }): Promise<StudentTask> => {
      const now = new Date().toISOString();
      const task: StudentTask = {
        id: crypto.randomUUID(),
        status: partial.status ?? "todo",
        source: partial.source ?? "manual",
        createdAt: now,
        updatedAt: now,
        ...partial,
      };
      setTasks((prev) => {
        const updated = [...prev, task];
        saveTasks(updated);
        return updated;
      });
      return task;
    },
    [saveTasks],
  );

  const completeTask = useCallback(
    (id: string) => {
      setTasks((prev) => {
        const updated = prev.map((t) =>
          t.id === id ? { ...t, status: "done" as const } : t,
        );
        saveTasks(updated);
        return updated;
      });
    },
    [saveTasks],
  );

  const deleteTask = useCallback(
    (id: string) => {
      setRemovingIds((prev) => new Set([...prev, id]));
      setTimeout(() => {
        setTasks((prev) => {
          const updated = prev.filter((t) => t.id !== id);
          saveTasks(updated);
          return updated;
        });
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 500);
    },
    [saveTasks],
  );
  const [addMode, setAddMode] = useState<AddMode>("smart");
  const [showCompleted, setShowCompleted] = useState(false);

  const allSorted = sortTasksByDueDate(tasks);
  const activeTasks = allSorted.filter((t) => t.status !== "done");
  const completedTasks = allSorted.filter((t) => t.status === "done");
  const sortedTasks = showCompleted ? allSorted : activeTasks;

  // Group tasks by classId for by-class view
  const tasksByClass: { classId: string | null; label: string; color?: string }[] = [
    // One entry per class that has tasks
    ...classes
      .filter((cls) => sortedTasks.some((t) => t.classId === cls.id))
      .map((cls) => ({ classId: cls.id, label: cls.name, color: cls.color })),
    // "General" group for tasks with no classId
    ...(sortedTasks.some((t) => !t.classId)
      ? [{ classId: null, label: "General / No Class", color: undefined }]
      : []),
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <SectionHeader
        title="Tasks"
        description="Capture school work naturally, then review it here."
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/chat?q=${encodeURIComponent("What should I work on today? Walk me through my tasks and help me prioritize.")}`}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted transition hover:border-sidebar-accent/40 hover:bg-sidebar-accent/5 hover:text-foreground"
            >
              <span className="text-[10px] text-sidebar-accent">✦</span>
              Ask assistant
            </Link>
            <div className="flex rounded-xl border border-border bg-surface p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("timeline")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  viewMode === "timeline"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Timeline
              </button>
              <button
                type="button"
                onClick={() => setViewMode("by-class")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  viewMode === "by-class"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                By Class
              </button>
            </div>
          </div>
        }
      />

      {/* Task capture */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Add a Task</h2>
            <p className="mt-1 text-sm text-muted">
              {addMode === "smart"
                ? "Type naturally — \"Bio test Friday\" or \"English essay due tomorrow at 11pm\"."
                : "Fill in the details directly — no AI needed."}
            </p>
          </div>
          {/* Mode toggle */}
          <div className="flex shrink-0 rounded-xl border border-border bg-surface p-0.5">
            <button
              type="button"
              onClick={() => setAddMode("smart")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                addMode === "smart"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Smart
            </button>
            <button
              type="button"
              onClick={() => setAddMode("manual")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                addMode === "manual"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Manual
            </button>
          </div>
        </div>
        <div className="mt-4">
          {addMode === "smart" ? (
            <TaskInputBox onTaskAdded={addTask} />
          ) : (
            <ManualTaskForm onTaskAdded={addTask} />
          )}
        </div>
      </section>

      {/* Task list */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">
            {viewMode === "timeline" ? "All Tasks" : "By Class"}
          </h2>
          {completedTasks.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              {showCompleted ? "Hide completed" : `Show ${completedTasks.length} completed`}
            </button>
          )}
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
              <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-border border-t-sidebar-accent" />
              <p className="text-sm text-muted">Loading your tasks…</p>
            </div>
          ) : sortedTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                {tasks.length === 0 ? "Nothing here yet." : "All caught up!"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {tasks.length === 0
                  ? "Tell the assistant what you have to do above and it will show up here."
                  : "No open tasks right now. Add a new one above when you're ready."}
              </p>
            </div>
          ) : viewMode === "timeline" ? (
            <div className="space-y-3">
              {sortedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  schoolClass={classes.find((c) => c.id === task.classId)}
                  isRemoving={removingIds.has(task.id)}
                  onComplete={task.status !== "done" ? completeTask : undefined}
                  onDelete={deleteTask}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {tasksByClass.map(({ classId, label, color }) => {
                const groupTasks = sortedTasks.filter(
                  (t) => (classId ? t.classId === classId : !t.classId)
                );
                if (groupTasks.length === 0) return null;
                return (
                  <div key={classId ?? "general"}>
                    {/* Class group header */}
                    <div className="mb-3 flex items-center gap-2">
                      {color && (
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      )}
                      <h3 className="text-sm font-semibold text-foreground">{label}</h3>
                      <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">
                        {groupTasks.length}
                      </span>
                      {classId && (
                        <Link
                          href={`/chat?q=${encodeURIComponent(`Help me plan how to tackle my ${label} tasks. What should I prioritize?`)}`}
                          className="ml-auto flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] font-medium text-muted transition hover:border-sidebar-accent/40 hover:text-foreground"
                        >
                          <span className="text-[9px] text-sidebar-accent">✦</span>
                          Ask
                        </Link>
                      )}
                    </div>
                    <div className="space-y-2">
                      {groupTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          schoolClass={classes.find((c) => c.id === task.classId)}
                          isRemoving={removingIds.has(task.id)}
                          onComplete={task.status !== "done" ? completeTask : undefined}
                          onDelete={deleteTask}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
