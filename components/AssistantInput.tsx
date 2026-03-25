"use client";

import { useState } from "react";
import { formatDueDate } from "../lib/datetime";
import { useCalendar } from "../lib/stores/calendarStore";
import { useScheduleConfig } from "../lib/stores/scheduleConfig";
import { getAbOverrideForDate, getTodayDateString } from "../lib/schedule";
import type {
  ChatMessage,
  ReminderPreference,
  SchoolClass,
  StudentTask,
  Weekday,
} from "../types";

const WEEKDAYS: { label: string; value: Weekday }[] = [
  { label: "Mon", value: "monday" },
  { label: "Tue", value: "tuesday" },
  { label: "Wed", value: "wednesday" },
  { label: "Thu", value: "thursday" },
  { label: "Fri", value: "friday" },
  { label: "Sat", value: "saturday" },
  { label: "Sun", value: "sunday" },
];

type InputStatus =
  | "idle"
  | "loading"
  | "task-preview"
  | "schedule-preview"
  | "chat-reply"
  | "error";

type AssistantInputProps = {
  tasks: StudentTask[];
  classes: SchoolClass[];
  reminderPreferences: ReminderPreference;
  onTaskConfirmed: (task: StudentTask) => void;
  onSchedulesConfirmed: (classes: Array<Omit<SchoolClass, "id">>) => Promise<void> | void;
};

type AssistantResponse =
  | { intent: "add_task"; task: Partial<StudentTask> }
  | { intent: "setup_schedule"; classes: Array<Omit<SchoolClass, "id">> }
  | { intent: "chat"; reply: ChatMessage };

export function AssistantInput({
  tasks,
  classes,
  reminderPreferences,
  onTaskConfirmed,
  onSchedulesConfirmed,
}: AssistantInputProps) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<InputStatus>("idle");
  const [taskPreview, setTaskPreview] = useState<Partial<StudentTask> | null>(null);
  const [editableSchedule, setEditableSchedule] = useState<Array<Omit<SchoolClass, "id">> | null>(null);
  const [chatReply, setChatReply] = useState<ChatMessage | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  const { todayDayType } = useScheduleConfig();
  const { entries: calendarEntries } = useCalendar();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    setStatus("loading");
    setTaskPreview(null);
    setChatReply(null);
    setErrorMessage(null);

    try {
      const todayDateStr = getTodayDateString();
      const calendarAbOverride = getAbOverrideForDate(calendarEntries, todayDateStr);
      const effectiveDayType = calendarAbOverride ?? todayDayType;

      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          tasks,
          classes,
          reminderPreferences,
          effectiveDayType,
          calendarEntries,
        }),
      });

      const json = (await res.json()) as AssistantResponse & { error?: string };

      if (!res.ok) {
        throw new Error(json.error ?? "Something went wrong. Please try again.");
      }

      if (json.intent === "setup_schedule") {
        if (json.classes.length === 0) {
          setErrorMessage(
            'Couldn\'t parse any classes from that description. Try being more specific, for example: "English A-day 8-9:15, Math Mon/Wed/Fri 1-1:50."'
          );
          setStatus("error");
        } else {
          setEditableSchedule(json.classes);
          setStatus("schedule-preview");
        }
      } else if (json.intent === "add_task") {
        setTaskPreview(json.task);
        setStatus("task-preview");
      } else {
        setChatReply(json.reply);
        setStatus("chat-reply");
        setInput("");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  };

  const handleConfirmTask = () => {
    if (!taskPreview) return;
    const now = new Date().toISOString();
    const task: StudentTask = {
      id: crypto.randomUUID(),
      title: taskPreview.title ?? input,
      description: taskPreview.description,
      classId: taskPreview.classId,
      dueAt: taskPreview.dueAt,
      type: taskPreview.type,
      reminderAt: taskPreview.reminderAt,
      status: "todo",
      source: "ai-parsed",
      createdAt: now,
      updatedAt: now,
    };
    onTaskConfirmed(task);
    setTaskPreview(null);
    setInput("");
    setStatus("idle");
  };

  const handleCancelTask = () => {
    setTaskPreview(null);
    setStatus("idle");
  };

  const handleConfirmSchedule = async () => {
    if (!editableSchedule) return;
    setErrorMessage(null);
    setIsSavingSchedule(true);

    try {
      await onSchedulesConfirmed(editableSchedule);
      setEditableSchedule(null);
      setInput("");
      setStatus("idle");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save classes.");
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleCancelSchedule = () => {
    setEditableSchedule(null);
    setStatus("idle");
    setErrorMessage(null);
  };

  const updateEditableClass = (i: number, patch: Partial<Omit<SchoolClass, "id">>) => {
    setEditableSchedule((prev) =>
      prev?.map((cls, idx) => (idx === i ? { ...cls, ...patch } : cls)) ?? null
    );
  };

  const toggleEditableDay = (i: number, day: Weekday) => {
    const cls = editableSchedule?.[i];
    if (!cls) return;
    const days = cls.days.includes(day)
      ? cls.days.filter((d) => d !== day)
      : [...cls.days, day];
    updateEditableClass(i, { days });
  };

  const removeEditableClass = (i: number) => {
    setEditableSchedule((prev) => prev?.filter((_, idx) => idx !== i) ?? null);
  };

  const handleDismissReply = () => {
    setChatReply(null);
    setStatus("idle");
  };

  const previewClass = taskPreview?.classId
    ? classes.find((c) => c.id === taskPreview.classId)
    : null;

  const isSubmitting = status === "loading";

  return (
    <div className="space-y-3">
      {status !== "task-preview" && status !== "schedule-preview" && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            placeholder="Add a task, ask about your week, or describe your full schedule to set it up..."
            rows={3}
            disabled={isSubmitting}
            className="w-full resize-none rounded-2xl border border-white/20 bg-white/10 px-4 py-3.5 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white/40 focus:bg-white/15 focus:ring-2 focus:ring-white/10 disabled:opacity-60"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting || !input.trim()}
              className="rounded-full bg-sidebar-accent px-5 py-2.5 text-sm font-semibold text-hero transition hover:opacity-90 disabled:opacity-40"
            >
              {isSubmitting ? "Thinking..." : "Send"}
            </button>
            <p className="text-xs text-white/40">Enter to send · Shift+Enter for new line</p>
            {status === "chat-reply" && (
              <button
                type="button"
                onClick={handleDismissReply}
                className="ml-auto text-xs text-white/50 underline underline-offset-2 hover:text-white/80"
              >
                Dismiss
              </button>
            )}
          </div>
        </form>
      )}

      {status === "chat-reply" && chatReply && (
        <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sidebar-accent/20 text-[9px] text-sidebar-accent">
              ✦
            </span>
            <p className="text-xs font-medium text-white/60">Assistant</p>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">
            {chatReply.content}
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={handleDismissReply}
              className="text-xs text-white/40 underline underline-offset-2 hover:text-white/70"
            >
              Dismiss
            </button>
            <a
              href="/chat"
              className="text-xs text-sidebar-accent/80 underline underline-offset-2 hover:text-sidebar-accent"
            >
              Open full chat →
            </a>
          </div>
        </div>
      )}

      {status === "task-preview" && taskPreview && (
        <div className="space-y-4 rounded-2xl border border-white/15 bg-hero-mid px-5 py-5">
          <div>
            <p className="text-sm font-semibold text-white">Review before saving</p>
            <p className="mt-0.5 text-xs text-white/50">
              Confirm to add it to your tasks, or cancel to re-word.
            </p>
          </div>

          <dl className="space-y-2 rounded-xl border border-white/10 bg-hero px-4 py-3 text-sm">
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 font-medium text-white/50">Title</dt>
              <dd className="font-semibold text-white">{taskPreview.title ?? "—"}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 font-medium text-white/50">Type</dt>
              <dd className="capitalize text-white/80">
                {taskPreview.type ?? <span className="text-white/30">Not specified</span>}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 font-medium text-white/50">Class</dt>
              <dd className="text-white/80">
                {previewClass ? (
                  previewClass.name
                ) : (
                  <span className="text-white/30">No class matched</span>
                )}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 font-medium text-white/50">Due</dt>
              <dd className="text-white/80">
                {taskPreview.dueAt ? (
                  formatDueDate(taskPreview.dueAt)
                ) : (
                  <span className="text-white/30">No due date found</span>
                )}
              </dd>
            </div>
          </dl>

          {!taskPreview.dueAt && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
              <p className="text-sm text-amber-300">
                No due date was found. Add one manually after confirming, or cancel and re-word with a date.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleConfirmTask}
              className="rounded-full bg-sidebar-accent px-5 py-2.5 text-sm font-semibold text-hero transition hover:opacity-90"
            >
              Add task
            </button>
            <button
              type="button"
              onClick={handleCancelTask}
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === "schedule-preview" && editableSchedule && (
        <div className="space-y-4 rounded-2xl border border-white/15 bg-hero-mid px-5 py-5">
          <div>
            <p className="text-sm font-semibold text-white">
              Review your schedule — {editableSchedule.length}{" "}
              {editableSchedule.length === 1 ? "class" : "classes"} found
            </p>
            <p className="mt-0.5 text-xs text-white/50">
              Edit any details, then confirm to add them all at once.
            </p>
          </div>

          <div className="space-y-3">
            {editableSchedule.map((cls, i) => (
              <div
                key={i}
                className="space-y-3 rounded-xl border border-white/10 bg-hero px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: cls.color ?? "#d4edd9" }}
                  />
                  <input
                    type="text"
                    value={cls.name}
                    onChange={(e) => updateEditableClass(i, { name: e.target.value })}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-sm font-semibold text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:bg-white/10"
                    placeholder="Class name"
                  />
                  <button
                    type="button"
                    onClick={() => removeEditableClass(i)}
                    className="shrink-0 text-xs text-white/30 transition hover:text-red-400"
                    title="Remove class"
                  >
                    ×
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-white/50">
                  <span className="shrink-0">Time</span>
                  <input
                    type="text"
                    value={cls.startTime}
                    onChange={(e) => updateEditableClass(i, { startTime: e.target.value })}
                    className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:bg-white/10"
                    placeholder="09:00"
                  />
                  <span>-</span>
                  <input
                    type="text"
                    value={cls.endTime}
                    onChange={(e) => updateEditableClass(i, { endTime: e.target.value })}
                    className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:bg-white/10"
                    placeholder="09:50"
                  />
                </div>

                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleEditableDay(i, value)}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                        cls.days.includes(value)
                          ? "border border-sidebar-accent/40 bg-sidebar-accent/30 text-sidebar-accent"
                          : "border border-white/10 text-white/40 hover:border-white/25 hover:text-white/60"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs text-white/50">
                  <span>Rotation</span>
                  {(["A", "B", null] as const).map((label) => (
                    <button
                      key={String(label)}
                      type="button"
                      onClick={() => updateEditableClass(i, { scheduleLabel: label ?? undefined })}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                        cls.scheduleLabel === (label ?? undefined)
                          ? label === "A"
                            ? "border border-blue-500/40 bg-blue-500/30 text-blue-300"
                            : label === "B"
                              ? "border border-purple-500/40 bg-purple-500/30 text-purple-300"
                              : "border border-white/20 bg-white/10 text-white/70"
                          : "border border-white/10 text-white/40 hover:border-white/25 hover:text-white/60"
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
            <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3">
              <p className="text-sm text-red-300">{errorMessage}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleConfirmSchedule()}
              disabled={editableSchedule.length === 0 || isSavingSchedule}
              className="rounded-full bg-sidebar-accent px-5 py-2.5 text-sm font-semibold text-hero transition hover:opacity-90 disabled:opacity-40"
            >
              {isSavingSchedule ? "Saving..." : "Add"} {editableSchedule.length}{" "}
              {editableSchedule.length === 1 ? "class" : "classes"}
            </button>
            <button
              type="button"
              onClick={handleCancelSchedule}
              disabled={isSavingSchedule}
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === "error" && errorMessage && (
        <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3">
          <p className="text-sm text-red-300">{errorMessage}</p>
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setErrorMessage(null);
            }}
            className="mt-2 text-sm font-medium text-red-300 underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
