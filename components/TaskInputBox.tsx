"use client";

import { useState } from "react";
import type { StudentTask } from "../types";

type TaskInputBoxProps = {
  onTaskAdded?: (task: StudentTask) => void;
};

// TODO: Replace with Supabase-backed task persistence once auth is set up
export function TaskInputBox({ onTaskAdded }: TaskInputBoxProps) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "adding" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || status === "adding") return;

    setStatus("adding");
    setError(null);

    try {
      const res = await fetch("/api/ai/parse-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
      });

      const json = (await res.json()) as { data?: Partial<StudentTask>; error?: string };

      if (!res.ok) {
        throw new Error(json.error ?? "Something went wrong. Try again.");
      }

      const partial = json.data ?? {};
      const now = new Date().toISOString();
      const task: StudentTask = {
        id: crypto.randomUUID(),
        title: partial.title ?? trimmed,
        description: partial.description,
        classId: partial.classId,
        dueAt: partial.dueAt,
        type: partial.type,
        reminderAt: partial.reminderAt,
        status: "todo",
        source: "ai-parsed",
        createdAt: now,
        updatedAt: now,
      };

      onTaskAdded?.(task);
      setValue("");
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setStatus("error");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. Bio test next Friday, History essay due tomorrow at 11pm"
        rows={2}
        disabled={status === "adding"}
        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/30 disabled:opacity-50"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={status === "adding" || !value.trim()}
          className="rounded-full bg-accent-green-foreground px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {status === "adding" ? "Adding..." : "Add task"}
        </button>

        {status === "success" && (
          <span className="text-sm font-medium text-accent-green-foreground">Task added!</span>
        )}
      </div>

      {status === "error" && error && (
        <p className="rounded-xl border border-accent-rose/40 bg-accent-rose/10 px-4 py-2.5 text-sm text-accent-rose-foreground">
          {error}
        </p>
      )}
    </form>
  );
}
