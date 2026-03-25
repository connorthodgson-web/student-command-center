"use client";

import { useState } from "react";
import type { SchoolClass, Weekday } from "../types";

const WEEKDAYS: { label: string; value: Weekday }[] = [
  { label: "Mon", value: "monday" },
  { label: "Tue", value: "tuesday" },
  { label: "Wed", value: "wednesday" },
  { label: "Thu", value: "thursday" },
  { label: "Fri", value: "friday" },
  { label: "Sat", value: "saturday" },
  { label: "Sun", value: "sunday" },
];

type Status = "idle" | "loading" | "preview" | "error";

type Props = {
  existingClasses: SchoolClass[];
  onConfirmed: (classes: Array<Omit<SchoolClass, "id">>) => Promise<void> | void;
  onCancel?: () => void;
};

type AssistantResponse =
  | { intent: "setup_schedule"; classes: Array<Omit<SchoolClass, "id">> }
  | { intent: string; error?: string };

export function ScheduleSetupInput({ existingClasses, onConfirmed, onCancel }: Props) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [editableSchedule, setEditableSchedule] = useState<Array<Omit<SchoolClass, "id">> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    setStatus("loading");
    setEditableSchedule(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          tasks: [],
          classes: existingClasses,
          reminderPreferences: {
            id: "",
            dailySummaryEnabled: false,
            tonightSummaryEnabled: false,
            dueSoonRemindersEnabled: false,
          },
          todayDayType: null,
        }),
      });

      const json = (await res.json()) as AssistantResponse;

      if (!res.ok) {
        throw new Error(("error" in json ? json.error : undefined) ?? "Something went wrong.");
      }

      if (json.intent === "setup_schedule") {
        const parsed = (json as Extract<AssistantResponse, { intent: "setup_schedule" }>).classes;
        if (parsed.length === 0) {
          setErrorMessage(
            'Couldn\'t find any classes in that description. Try something like: "AP Chem Mon/Wed/Fri 9-9:50, English Lit A-Day 10-11, History Tue/Thu 2-3:15."'
          );
          setStatus("error");
        } else {
          setEditableSchedule(parsed);
          setStatus("preview");
        }
      } else {
        setErrorMessage(
          'Try describing your full class schedule, for example: "AP Chem Mon/Wed/Fri 9-9:50, English Lit A-Day 10-11, History Tue/Thu 2-3:15."'
        );
        setStatus("error");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  };

  const updateClass = (i: number, patch: Partial<Omit<SchoolClass, "id">>) => {
    setEditableSchedule((prev) =>
      prev?.map((cls, idx) => (idx === i ? { ...cls, ...patch } : cls)) ?? null
    );
  };

  const toggleDay = (i: number, day: Weekday) => {
    const cls = editableSchedule?.[i];
    if (!cls) return;
    const days = cls.days.includes(day)
      ? cls.days.filter((d) => d !== day)
      : [...cls.days, day];
    updateClass(i, { days });
  };

  const removeClass = (i: number) => {
    setEditableSchedule((prev) => prev?.filter((_, idx) => idx !== i) ?? null);
  };

  const handleConfirm = async () => {
    if (!editableSchedule) return;
    setErrorMessage(null);
    setIsSaving(true);

    try {
      await onConfirmed(editableSchedule);
      setEditableSchedule(null);
      setInput("");
      setStatus("idle");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save classes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    setEditableSchedule(null);
    setStatus("idle");
    setErrorMessage(null);
  };

  if (status !== "preview") {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit(e as unknown as React.FormEvent);
            }
          }}
          placeholder={`Describe your full schedule in plain English.\n\nExample: "AP Chem Mon/Wed/Fri 9-9:50, English Lit A-Day 10-11:15, History Tue/Thu 2-3:15, PE every day 12-12:45"`}
          rows={4}
          disabled={status === "loading"}
          className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3.5 text-sm text-foreground placeholder:text-muted outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40 disabled:opacity-60"
        />

        {status === "error" && errorMessage && (
          <p className="rounded-xl border border-accent-rose bg-accent-rose px-4 py-2.5 text-sm text-accent-rose-foreground">
            {errorMessage}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={status === "loading" || !input.trim()}
            className="rounded-full bg-accent-green-foreground px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {status === "loading" ? "Parsing schedule..." : "Build schedule"}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-muted transition hover:text-foreground"
            >
              Cancel
            </button>
          )}
          <p className="ml-auto hidden text-xs text-muted sm:block">
            Enter to submit · Shift+Enter for new line
          </p>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {editableSchedule!.length} {editableSchedule!.length === 1 ? "class" : "classes"} found
          {" "}review and edit
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Make any corrections before saving. Click days or rotation to toggle them.
        </p>
      </div>

      <div className="space-y-3">
        {editableSchedule!.map((cls, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-border bg-surface px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: cls.color ?? "#d4edd9" }}
              />
              <input
                type="text"
                value={cls.name}
                onChange={(e) => updateClass(i, { name: e.target.value })}
                className="flex-1 rounded-lg border border-border bg-card px-2.5 py-1 text-sm font-semibold text-foreground outline-none focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40"
                placeholder="Class name"
              />
              <button
                type="button"
                onClick={() => removeClass(i)}
                className="shrink-0 text-xs text-muted transition hover:text-accent-rose-foreground"
                title="Remove class"
              >
                ×
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="w-8 shrink-0">Time</span>
              <input
                type="text"
                value={cls.startTime}
                onChange={(e) => updateClass(i, { startTime: e.target.value })}
                className="w-16 rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-accent-green-foreground/50"
                placeholder="09:00"
              />
              <span>-</span>
              <input
                type="text"
                value={cls.endTime}
                onChange={(e) => updateClass(i, { endTime: e.target.value })}
                className="w-16 rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-accent-green-foreground/50"
                placeholder="09:50"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {WEEKDAYS.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleDay(i, value)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                    cls.days.includes(value)
                      ? "border border-accent-green-foreground/30 bg-accent-green text-accent-green-foreground"
                      : "border border-border text-muted hover:bg-card hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="w-14 shrink-0">Rotation</span>
              {(["A", "B", null] as const).map((label) => (
                <button
                  key={String(label)}
                  type="button"
                  onClick={() => updateClass(i, { scheduleLabel: label ?? undefined })}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                    cls.scheduleLabel === (label ?? undefined)
                      ? label === "A"
                        ? "border border-accent-blue-foreground/30 bg-accent-blue text-accent-blue-foreground"
                        : label === "B"
                          ? "border border-accent-purple-foreground/30 bg-accent-purple text-accent-purple-foreground"
                          : "border border-border bg-card text-foreground"
                      : "border border-border text-muted hover:bg-card hover:text-foreground"
                  }`}
                >
                  {label === null ? "None" : `${label}-Day`}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {errorMessage && (
        <p className="rounded-xl border border-accent-rose bg-accent-rose px-4 py-2.5 text-sm text-accent-rose-foreground">
          {errorMessage}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={!editableSchedule || editableSchedule.length === 0 || isSaving}
          className="rounded-full bg-accent-green-foreground px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {isSaving ? "Saving..." : "Add"} {editableSchedule!.length}{" "}
          {editableSchedule!.length === 1 ? "class" : "classes"}
        </button>
        <button
          type="button"
          onClick={handleBack}
          disabled={isSaving}
          className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface"
        >
          Back
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="text-sm text-muted transition hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
