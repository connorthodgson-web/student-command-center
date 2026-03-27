"use client";

import { useState } from "react";
import type { StudentTask } from "../types";
import { useClasses } from "../lib/stores/classStore";
import { formatDueDate } from "../lib/datetime";

type ParseStatus = "idle" | "parsing" | "preview" | "error";

type TaskCaptureProps = {
  onTaskAdded: (task: {
    title: string;
    description?: string;
    classId?: string;
    dueAt?: string;
    type?: StudentTask["type"];
    reminderAt?: string;
    source?: StudentTask["source"];
  }) => Promise<unknown>;
};

export function TaskCapture({ onTaskAdded }: TaskCaptureProps) {
  // TODO: Replace with Supabase-backed class persistence in a future sprint
  const { classes } = useClasses();
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ParseStatus>("idle");
  const [preview, setPreview] = useState<Partial<StudentTask> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    setStatus("parsing");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/ai/parse-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
      });

      const json = await res.json() as { data?: Partial<StudentTask>; error?: string };

      if (!res.ok) {
        throw new Error(json.error ?? "Parsing failed. Please try again.");
      }

      setPreview(json.data ?? null);
      setStatus("preview");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;

    try {
      await onTaskAdded({
        title: preview.title ?? input,
        description: preview.description,
        classId: preview.classId,
        dueAt: preview.dueAt,
        type: preview.type,
        reminderAt: preview.reminderAt,
        source: "ai-parsed",
      });
      setInput("");
      setPreview(null);
      setStatus("idle");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save task.");
      setStatus("error");
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setStatus("idle");
    // Keep the input text so the student can re-word if needed
  };

  const handleRetry = () => {
    setStatus("idle");
    setErrorMessage(null);
  };

  // Resolve the class name from classId for the preview display
  const previewClass = preview?.classId
    ? classes.find((c) => c.id === preview.classId)
    : null;

  return (
    <div className="space-y-4">
      {/* Input form — always visible unless showing a parsed preview */}
      {status !== "preview" && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-foreground">
              Tell the assistant what you need to do
            </span>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="I have a Great Gatsby essay due Friday at 11:59 PM for English"
              className="min-h-28 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40"
              disabled={status === "parsing"}
            />
          </label>

          <p className="text-sm leading-6 text-muted">
            Examples: &quot;Bio test next Friday.&quot; &quot;Math worksheet due tomorrow.&quot; &quot;Remind me to study chemistry tonight.&quot;
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={status === "parsing" || !input.trim()}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {status === "parsing" ? "Parsing…" : "Capture task"}
            </button>
          </div>

          {/* Error state — shown inline below the button */}
          {status === "error" && errorMessage && (
            <div className="rounded-xl border border-accent-rose bg-accent-rose px-4 py-3">
              <p className="text-sm text-accent-rose-foreground">{errorMessage}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="mt-2 text-sm font-medium text-accent-rose-foreground underline"
              >
                Try again
              </button>
            </div>
          )}
        </form>
      )}

      {/* Parsed preview — shown instead of the form while the student confirms */}
      {status === "preview" && preview && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <p className="text-sm font-semibold text-foreground">Review before saving</p>
          <p className="text-xs text-muted -mt-2">
            This is what the assistant understood from your input. Confirm to add it, or cancel to re-word.
          </p>

          {/* Labeled field summary */}
          <dl className="space-y-2 rounded-xl border border-border bg-background p-4 text-sm">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 font-medium text-muted">Title</dt>
              <dd className="text-foreground font-semibold">{preview.title ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 font-medium text-muted">Class</dt>
              <dd className="text-foreground">
                {previewClass ? previewClass.name : <span className="text-muted">No class matched</span>}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 font-medium text-muted">Due</dt>
              <dd className="text-foreground">
                {preview.dueAt
                  ? `Due ${formatDueDate(preview.dueAt)}`
                  : <span className="text-muted">No due date found</span>}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 font-medium text-muted">Type</dt>
              <dd className="capitalize text-foreground">
                {preview.type ?? <span className="text-muted">Not specified</span>}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 font-medium text-muted">Reminder</dt>
              <dd className="text-foreground">
                {preview.reminderAt
                  ? formatDueDate(preview.reminderAt)
                  : <span className="text-muted">No reminder set</span>}
              </dd>
            </div>
          </dl>

          {/* Amber notice when no due date was found */}
          {!preview.dueAt && (
            <div className="rounded-xl border border-accent-amber bg-accent-amber px-4 py-3">
              <p className="text-sm text-accent-amber-foreground">
                No due date was found — you can add one manually after confirming, or cancel and re-word your input with a date.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={() => void handleConfirm()}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              Add this task
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
