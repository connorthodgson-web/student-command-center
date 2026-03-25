"use client";

import { useState } from "react";
import type { StudentTask } from "../types";

type TaskInputBoxProps = {
  onSubmitTask?: (value: string) => void;
  // Called with a fully-structured task when the student confirms a capture.
  onTaskConfirmed?: (task: StudentTask) => void;
};

export function TaskInputBox({ onSubmitTask, onTaskConfirmed }: TaskInputBoxProps) {
  const [value, setValue] = useState("");
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return;
    }

    onSubmitTask?.(trimmedValue);

    if (onTaskConfirmed) {
      const now = new Date().toISOString();
      onTaskConfirmed({
        id: crypto.randomUUID(),
        title: trimmedValue,
        status: "todo",
        source: "manual",
        createdAt: now,
        updatedAt: now,
      });
    }

    setLastSubmitted(trimmedValue);
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-foreground">
          Tell the assistant what you need to do
        </span>
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="I have a Great Gatsby essay due March 11 at 11:59 PM."
          className="min-h-28 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        />
      </label>

      <p className="text-sm leading-6 text-slate-600">
        Examples: &quot;Bio test next Friday.&quot; &quot;Math worksheet due tomorrow.&quot; &quot;Remind me to study chemistry tonight.&quot;
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          Capture task
        </button>
        {lastSubmitted ? (
          <span className="text-sm text-slate-600">Last captured: &quot;{lastSubmitted}&quot;</span>
        ) : null}
      </div>
    </form>
  );
}
