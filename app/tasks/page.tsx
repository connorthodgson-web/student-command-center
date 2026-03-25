// UI redesign pass
"use client";

import { useState } from "react";
import { SectionHeader } from "../../components/SectionHeader";
import { TaskCapture } from "../../components/TaskCapture";
import { TaskCard } from "../../components/TaskCard";
import { useClasses } from "../../lib/stores/classStore";
import { useTaskStore } from "../../lib/task-store";
import { sortTasksByDueDate } from "../../lib/tasks";

type ViewMode = "timeline" | "by-class";

export default function TasksPage() {
  const { classes } = useClasses();
  const { tasks, removingIds, addTask, completeTask, deleteTask } = useTaskStore();
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
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
        }
      />

      {/* Task capture */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">Add a Task</h2>
        <p className="mt-1 text-sm text-muted">
          Type naturally — &quot;Bio test Friday&quot; or &quot;English essay due tomorrow at 11pm&quot;.
        </p>
        <div className="mt-4">
          <TaskCapture onTaskAdded={addTask} />
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
          {sortedTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                {tasks.length === 0 ? "No tasks yet." : "All caught up!"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {tasks.length === 0
                  ? "Add your first task above — try \"Bio test Friday\" or \"Essay due tomorrow\"."
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
