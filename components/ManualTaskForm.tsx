"use client";

import { useState } from "react";
import type { StudentTask, TaskType } from "../types";
import { useClasses } from "../lib/stores/classStore";

type ManualTaskFormProps = {
  onTaskAdded: (task: StudentTask) => void;
};

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: "assignment", label: "Assignment" },
  { value: "test", label: "Test" },
  { value: "quiz", label: "Quiz" },
  { value: "reading", label: "Reading" },
  { value: "project", label: "Project" },
  { value: "study", label: "Study" },
];

export function ManualTaskForm({ onTaskAdded }: ManualTaskFormProps) {
  const { classes } = useClasses();
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [type, setType] = useState<TaskType | "">("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    const now = new Date().toISOString();
    const task: StudentTask = {
      id: crypto.randomUUID(),
      title: trimmed,
      classId: classId || undefined,
      dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      type: type || undefined,
      status: "todo",
      source: "manual",
      createdAt: now,
      updatedAt: now,
    };

    onTaskAdded(task);
    setTitle("");
    setClassId("");
    setDueAt("");
    setType("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Task title <span className="text-accent-rose-foreground">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Read chapter 4, Study for midterm…"
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40"
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Class */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Class (optional)</label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40"
          >
            <option value="">No class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Due date */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Due date (optional)</label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Type (optional)</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TaskType | "")}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40"
          >
            <option value="">No type</option>
            {TASK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={!title.trim()}
        className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
      >
        Add task
      </button>
    </form>
  );
}
