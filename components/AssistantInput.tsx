"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDueDate } from "../lib/datetime";
import { useBrowserVoiceInput } from "../lib/voice";
import { resolveClassColor } from "../lib/class-colors";
import { useCalendar } from "../lib/stores/calendarStore";
import { useScheduleConfig } from "../lib/stores/scheduleConfig";
import { getScheduleDayOverrideForDate, getTodayDateString } from "../lib/schedule";
import { deriveScheduleLabel, getRotationSelectionValue, rotationSelectionToDays } from "../lib/class-rotation";
import type {
  ChatMessage,
  ReminderPreference,
  RotationDay,
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
  | "error";

type AssistantInputProps = {
  tasks: StudentTask[];
  classes: SchoolClass[];
  reminderPreferences: ReminderPreference;
  onTaskConfirmed: (task: {
    title: string;
    description?: string;
    classId?: string;
    dueAt?: string;
    type?: StudentTask["type"];
    reminderAt?: string;
    source?: StudentTask["source"];
  }) => Promise<unknown>;
  onSchedulesConfirmed: (classes: Array<Omit<SchoolClass, "id">>) => Promise<unknown> | void;
  placeholder?: string;
};

type AssistantResponse =
  | { intent: "add_task"; task: Partial<StudentTask> }
  | { intent: "setup_schedule"; classes: Array<Omit<SchoolClass, "id">> }
  | { intent: "chat"; reply: ChatMessage };

const DEFAULT_PLACEHOLDER =
  "Add a task, ask about your week, or describe your full schedule to set it up...";

export function AssistantInput({
  tasks,
  classes,
  reminderPreferences,
  onTaskConfirmed,
  onSchedulesConfirmed,
  placeholder,
}: AssistantInputProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<InputStatus>("idle");
  const [taskPreview, setTaskPreview] = useState<Partial<StudentTask> | null>(null);
  const [editableSchedule, setEditableSchedule] = useState<Array<Omit<SchoolClass, "id">> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);

  const { todayDayType, scheduleArchitecture, rotationLabels, isRotationSchedule } = useScheduleConfig();
  const { entries: calendarEntries } = useCalendar();
  const {
    state: voiceState,
    error: voiceError,
    isSupported: voiceSupported,
    isListening,
    isTranscribing,
    start: startListening,
    stop: stopListening,
    cancel: cancelListening,
    clearError: clearVoiceError,
  } = useBrowserVoiceInput((transcript) => {
    setLastTranscript(transcript);
    setInput((prev) => (prev ? `${prev.trimEnd()} ${transcript}` : transcript));
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    cancelListening();
    setStatus("loading");
    setTaskPreview(null);
    setErrorMessage(null);
    setLastTranscript(null);

    try {
      const todayDateStr = getTodayDateString();
      const calendarAbOverride = getScheduleDayOverrideForDate(calendarEntries, todayDateStr);
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
          scheduleArchitecture,
        }),
      });

      const json = (await res.json()) as AssistantResponse & { error?: string };

      if (!res.ok) {
        throw new Error(json.error ?? "Something went wrong. Please try again.");
      }

      if (json.intent === "setup_schedule") {
        if (json.classes.length === 0) {
          setErrorMessage(
            `Couldn't parse any classes from that description. Try being more specific, for example: "${
              isRotationSchedule
                ? `English ${rotationLabels[0]}-Day 8-9:15, Math Mon/Wed/Fri 1-1:50`
                : "English Tue/Thu 8-9:15, Math Mon/Wed/Fri 1-1:50"
            }."`,
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
        router.push(`/chat?q=${encodeURIComponent(trimmed)}`);
        setStatus("idle");
        setInput("");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  };

  const handleConfirmTask = async () => {
    if (!taskPreview) return;
    try {
      await onTaskConfirmed({
        title: taskPreview.title ?? input,
        description: taskPreview.description,
        classId: taskPreview.classId,
        dueAt: taskPreview.dueAt,
        type: taskPreview.type,
        reminderAt: taskPreview.reminderAt,
        source: "ai-parsed",
      });
      setTaskPreview(null);
      setInput("");
      setStatus("idle");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save task.");
      setStatus("error");
    }
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

  const scheduleReviewSummary = editableSchedule
    ? summarizeScheduleReview(editableSchedule)
    : null;

  const handleCancelSchedule = () => {
    setEditableSchedule(null);
    setStatus("idle");
    setErrorMessage(null);
  };

  const updateEditableClass = (i: number, patch: Partial<Omit<SchoolClass, "id">>) => {
    setEditableSchedule((prev) =>
      prev?.map((cls, idx) => (idx === i ? { ...cls, ...patch } : cls)) ?? null,
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

  const previewClass = taskPreview?.classId
    ? classes.find((c) => c.id === taskPreview.classId)
    : null;

  const isSubmitting = status === "loading";
  const voiceStatusText = isListening
    ? "Listening. Tap again when you're done."
    : isTranscribing
      ? "Finishing that voice note..."
      : voiceState === "error"
        ? voiceError
        : voiceSupported
          ? "Use the mic for one short voice note, then edit before sending."
          : "Voice input is not supported in this browser.";

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    if (lastTranscript) {
      setLastTranscript(null);
    }
  };

  const handleVoiceToggle = () => {
    if (isListening || isTranscribing) {
      stopListening();
      return;
    }

    setLastTranscript(null);
    clearVoiceError();
    startListening();
  };

  return (
    <div className="space-y-3">
      {status !== "task-preview" && status !== "schedule-preview" && (
        <form onSubmit={handleSubmit} className="space-y-3">
          {lastTranscript && input.trim() && (
            <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
              <p className="text-xs text-white/70">Voice transcript ready. You can edit it before sending.</p>
            </div>
          )}

          {voiceError && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3">
              <p className="text-sm text-red-300">{voiceError}</p>
              <button
                type="button"
                onClick={clearVoiceError}
                className="shrink-0 text-xs font-medium text-red-200 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            placeholder={
              isListening
                ? "Listening..."
                : isTranscribing
                  ? "Finishing your transcript..."
                  : placeholder ?? DEFAULT_PLACEHOLDER
            }
            rows={3}
            disabled={isSubmitting}
            autoCapitalize="sentences"
            autoCorrect="on"
            spellCheck
            className="w-full resize-none rounded-2xl border border-white/20 bg-white/10 px-4 py-3.5 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white/40 focus:bg-white/15 focus:ring-2 focus:ring-white/10 disabled:opacity-60"
          />

          <div className="flex flex-wrap items-center gap-3">
            {voiceSupported && (
              <button
                type="button"
                onClick={handleVoiceToggle}
                disabled={isSubmitting}
                aria-label={isListening ? "Stop recording" : "Start voice note"}
                title={isListening ? "Tap to stop recording" : isTranscribing ? "Processing…" : "Record a voice note"}
                className={`relative flex h-11 w-11 items-center justify-center rounded-full border transition-all disabled:opacity-40 ${
                  isListening
                    ? "border-red-300/50 bg-red-400/25 text-red-100 ring-2 ring-red-400/30"
                    : isTranscribing
                      ? "border-red-300/30 bg-red-400/15 text-red-200"
                      : "border-white/20 text-white/80 hover:bg-white/10"
                }`}
              >
                {isListening && (
                  <span className="absolute inset-0 animate-pulse rounded-full bg-red-400/15" />
                )}
                <svg className="relative h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v5a4 4 0 01-8 0V7a4 4 0 014-4z"
                  />
                </svg>
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !input.trim()}
              className="min-h-[44px] rounded-full bg-sidebar-accent px-5 py-2.5 text-sm font-semibold text-hero transition hover:opacity-90 disabled:opacity-40"
            >
              {isSubmitting ? "Thinking..." : "Send"}
            </button>

            {(isListening || isTranscribing || voiceState === "error") && (
              <p className={`text-xs font-medium ${
                voiceState === "error" ? "text-red-200" : isListening ? "text-red-300" : "text-white/60"
              }`}>
                {voiceStatusText}
              </p>
            )}
          </div>
        </form>
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
              <dd className="font-semibold text-white">{taskPreview.title ?? "-"}</dd>
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
                No due date was found. That&apos;s okay - you can confirm this task as-is or add a date later.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleConfirmTask()}
              className="min-h-[44px] rounded-full bg-sidebar-accent px-5 py-2.5 text-sm font-semibold text-hero transition hover:opacity-90"
            >
              Add task
            </button>
            <button
              type="button"
              onClick={handleCancelTask}
              className="min-h-[44px] rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
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
              Got it - {editableSchedule.length} {editableSchedule.length === 1 ? "class" : "classes"} found
            </p>
            <p className="mt-0.5 text-xs text-white/50">
              Review and fill in any missing details, then confirm to add them all.
            </p>
          </div>

          {scheduleReviewSummary && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
              <p className="text-sm text-amber-200">{scheduleReviewSummary}</p>
            </div>
          )}

          <div className="space-y-3">
            {editableSchedule.map((cls, i) => (
              <div
                key={i}
                className="space-y-3 rounded-xl border border-white/10 bg-hero px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: resolveClassColor(cls.color) }}
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
                    x
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-white/50">
                    <span className="w-12 shrink-0">Teacher</span>
                    <input
                      type="text"
                      value={cls.teacherName ?? ""}
                      onChange={(e) =>
                        updateEditableClass(i, { teacherName: e.target.value || undefined })
                      }
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-white/25 outline-none focus:border-white/30 focus:bg-white/10"
                      placeholder="e.g. Mr. Johnson"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-white/50">
                    <span className="w-8 shrink-0">Room</span>
                    <input
                      type="text"
                      value={cls.room ?? ""}
                      onChange={(e) =>
                        updateEditableClass(i, { room: e.target.value || undefined })
                      }
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-white/25 outline-none focus:border-white/30 focus:bg-white/10"
                      placeholder="e.g. 204"
                    />
                  </div>
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

                {isRotationSchedule && (
                  <div className="flex items-start gap-2 text-xs text-white/50">
                    <span className="pt-1">Rotation</span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          updateEditableClass(i, { rotationDays: undefined, scheduleLabel: undefined })
                        }
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                          getRotationSelectionValue(cls.rotationDays, cls.scheduleLabel).length === 0
                            ? "border border-white/20 bg-white/10 text-white/70"
                            : "border border-white/10 text-white/40 hover:border-white/25 hover:text-white/60"
                        }`}
                      >
                        None
                      </button>
                      {rotationLabels.map((label) => {
                        const selectedRotationDays = getRotationSelectionValue(
                          cls.rotationDays,
                          cls.scheduleLabel,
                        );
                        const selected = selectedRotationDays.includes(label);
                        const nextRotationDays: RotationDay[] = selected
                          ? selectedRotationDays.filter((value) => value !== label)
                          : [...selectedRotationDays, label];

                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              const rotationDays = rotationSelectionToDays(nextRotationDays);
                              updateEditableClass(i, {
                                rotationDays: rotationDays.length > 0 ? rotationDays : undefined,
                                scheduleLabel: deriveScheduleLabel(rotationDays),
                              });
                            }}
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                              selected
                                ? "border border-emerald-500/40 bg-emerald-500/30 text-emerald-300"
                                : "border border-white/10 text-white/40 hover:border-white/25 hover:text-white/60"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
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

function summarizeScheduleReview(classes: Array<Omit<SchoolClass, "id">>) {
  const missingTimeCount = classes.filter((schoolClass) =>
    !schoolClass.startTime.trim() || !schoolClass.endTime.trim(),
  ).length;
  const missingPatternCount = classes.filter((schoolClass) =>
    schoolClass.days.length === 0 && (schoolClass.rotationDays?.length ?? 0) === 0,
  ).length;

  const parts: string[] = [];
  if (missingTimeCount > 0) {
    parts.push(
      `${missingTimeCount} ${missingTimeCount === 1 ? "class is" : "classes are"} missing a reliable time`,
    );
  }
  if (missingPatternCount > 0) {
    parts.push(
      `${missingPatternCount} ${missingPatternCount === 1 ? "class is" : "classes are"} missing meeting days or rotation`,
    );
  }

  if (parts.length === 0) {
    return null;
  }

  return `${parts.join(". ")}. You can still save, but those classes may not show up correctly in today’s schedule until you fill in the missing details.`;
}
