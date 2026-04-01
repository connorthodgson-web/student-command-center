"use client";

import { useState } from "react";
import type { SchoolClass, TutoringContext, TutoringMode } from "../types";

const TUTORING_MODES: {
  mode: TutoringMode;
  label: string;
  description: string;
  badge: string;
}[] = [
  {
    mode: "explain",
    label: "Explain It",
    description: "Concepts broken down clearly",
    badge: "EX",
  },
  {
    mode: "step_by_step",
    label: "Step by Step",
    description: "Walk through problems together",
    badge: "ST",
  },
  {
    mode: "quiz",
    label: "Quiz Me",
    description: "Test what you know",
    badge: "QZ",
  },
  {
    mode: "review",
    label: "Quick Review",
    description: "Summarize key ideas and weak spots",
    badge: "RV",
  },
  {
    mode: "study_plan",
    label: "Study Plan",
    description: "Build a realistic study schedule",
    badge: "PL",
  },
  {
    mode: "homework_help",
    label: "Homework Help",
    description: "Get unstuck on specific problems",
    badge: "HW",
  },
];

type SetupAttachment = {
  localId: string;
  file: File;
  status: "uploading" | "ready" | "failed";
  attachmentId?: string;
};

export interface TutoringSetupResult {
  context: TutoringContext;
  firstMessage: string;
}

interface TutoringSetupPanelProps {
  classes: SchoolClass[];
  onStart: (result: TutoringSetupResult) => void;
  onCancel: () => void;
  initialMode?: TutoringMode;
  initialClassId?: string;
  initialTopic?: string;
}

export function TutoringSetupPanel({
  classes,
  onStart,
  onCancel,
  initialMode,
  initialClassId,
  initialTopic,
}: TutoringSetupPanelProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId ?? "");
  const [selectedMode, setSelectedMode] = useState<TutoringMode | null>(initialMode ?? null);
  const [topic, setTopic] = useState(initialTopic ?? "");
  const [goal, setGoal] = useState("");
  const [attachments, setAttachments] = useState<SetupAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleAttachmentUpload = async (files: FileList | null) => {
    if (!files?.length) return;

    setUploadError(null);

    for (const file of Array.from(files)) {
      const localId = `${Date.now()}-${Math.random()}-${file.name}`;
      setAttachments((current) => [...current, { localId, file, status: "uploading" }]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", file.name);
        if (file.type.startsWith("image/")) {
          formData.append("attachmentType", "image");
        }
        if (selectedClassId) {
          formData.append("classId", selectedClassId);
        }

        const response = await fetch("/api/assistant/attachments", {
          method: "POST",
          body: formData,
        });
        const json = (await response.json()) as {
          data?: { id?: string };
          error?: string;
        };

        if (!response.ok || !json.data?.id) {
          throw new Error(json.error ?? "Failed to upload tutoring attachment.");
        }

        setAttachments((current) =>
          current.map((attachment) =>
            attachment.localId === localId
              ? { ...attachment, status: "ready", attachmentId: json.data?.id }
              : attachment,
          ),
        );
      } catch (error) {
        setAttachments((current) =>
          current.map((attachment) =>
            attachment.localId === localId ? { ...attachment, status: "failed" } : attachment,
          ),
        );
        setUploadError(
          error instanceof Error ? error.message : "Failed to upload tutoring attachment.",
        );
      }
    }
  };

  const handleStart = () => {
    if (!selectedMode) return;

    const readyAttachmentIds = attachments
      .map((attachment) => attachment.attachmentId)
      .filter((value): value is string => Boolean(value));

    const context: TutoringContext = {
      mode: selectedMode,
      classId: selectedClassId || undefined,
      attachmentIds: readyAttachmentIds.length > 0 ? readyAttachmentIds : undefined,
      topic: topic.trim() || undefined,
      goal: goal.trim() || undefined,
    };

    const modeLabel =
      TUTORING_MODES.find((modeOption) => modeOption.mode === selectedMode)?.label ?? selectedMode;
    const className = selectedClassId
      ? classes.find((schoolClass) => schoolClass.id === selectedClassId)?.name
      : null;

    const parts: string[] = [`I want to start a ${modeLabel} tutoring session`];
    if (className) parts.push(` for ${className}`);
    if (topic.trim()) parts.push(`. Topic: ${topic.trim()}`);
    if (goal.trim()) parts.push(`. Goal: ${goal.trim()}`);
    if (readyAttachmentIds.length > 0) {
      parts.push(
        `. I uploaded ${readyAttachmentIds.length === 1 ? "a file" : `${readyAttachmentIds.length} files`} for this session`,
      );
    }
    if (!topic.trim() && !goal.trim()) parts.push(". Let's get started.");

    onStart({ context, firstMessage: parts.join("") });
  };

  const isUploading = attachments.some((attachment) => attachment.status === "uploading");

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">AI</span>
            <h2 className="text-base font-semibold text-foreground">
              Start a Tutoring Session
            </h2>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            Choose a learning mode and optionally add a worksheet, screenshot, or study guide up front.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded-xl p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {classes.length > 0 && (
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted">
            Class (optional)
          </label>
          <select
            value={selectedClassId}
            onChange={(event) => setSelectedClassId(event.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-sidebar-accent/50 focus:ring-2 focus:ring-sidebar-accent/20"
          >
            <option value="">General - no specific class</option>
            {classes.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>
                {schoolClass.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-muted">
          How do you want to learn?
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TUTORING_MODES.map(({ mode, label, description, badge }) => {
            const isSelected = selectedMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setSelectedMode(mode)}
                className={`rounded-xl border p-3 text-left transition-all active:scale-[0.97] ${
                  isSelected
                    ? "border-sidebar-accent/50 bg-sidebar-accent/10 ring-1 ring-sidebar-accent/20"
                    : "border-border bg-surface hover:border-sidebar-accent/20 hover:bg-card"
                }`}
              >
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-sidebar-accent">
                  {badge}
                </div>
                <div className="text-xs font-semibold text-foreground">{label}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-muted">
                  {description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedClassId && (() => {
        const cls = classes.find((schoolClass) => schoolClass.id === selectedClassId);
        if (!cls) return null;

        const savedMaterialCount =
          (cls.materials?.length ?? 0) +
          (cls.syllabusText?.trim() ? 1 : 0) +
          (cls.classNotes?.trim() ? 1 : 0);

        if (savedMaterialCount === 0) return null;

        return (
          <div className="flex items-start gap-2 rounded-xl border border-sidebar-accent/20 bg-sidebar-accent/5 px-3 py-2.5">
            <span className="mt-0.5 text-sm leading-none">+</span>
            <p className="text-xs text-foreground/80">
              <span className="font-medium">Course materials available.</span> The assistant will use saved {cls.name} materials when they match your question and say when it is falling back to general help.
            </p>
          </div>
        );
      })()}

      {selectedMode && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted">
              Topic (optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="e.g. Photosynthesis, Chapter 5, WWI"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted/50 focus:border-sidebar-accent/50 focus:ring-2 focus:ring-sidebar-accent/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted">
              Goal (optional)
            </label>
            <input
              type="text"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="e.g. Prep for Friday's test"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted/50 focus:border-sidebar-accent/50 focus:ring-2 focus:ring-sidebar-accent/20"
            />
          </div>
        </div>
      )}

      {selectedMode && (
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted">
                Session Files (optional)
              </label>
              <p className="mt-1 text-xs text-muted">
                Add a worksheet, photo, or study guide now. It will be available as soon as the tutoring session starts.
              </p>
            </div>
            <label
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-medium transition ${
                isUploading
                  ? "cursor-wait border-border text-muted opacity-60"
                  : "border-border text-foreground hover:border-sidebar-accent/30 hover:bg-sidebar-accent/5 hover:text-sidebar-accent"
              }`}
            >
              <input
                type="file"
                className="sr-only"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={(event) => {
                  void handleAttachmentUpload(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
              {isUploading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted/30 border-t-muted" />
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add files
                </>
              )}
            </label>
          </div>

          {attachments.length > 0 && (
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.localId}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                    attachment.status === "ready"
                      ? "border-accent-green/30 bg-accent-green/5"
                      : attachment.status === "failed"
                        ? "border-accent-rose/30 bg-accent-rose/5"
                        : "border-border bg-card"
                  }`}
                >
                  <svg className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                    {attachment.file.name}
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold">
                    {attachment.status === "uploading" && (
                      <span className="flex items-center gap-1.5 text-muted">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted/30 border-t-muted" />
                        Uploading...
                      </span>
                    )}
                    {attachment.status === "ready" && (
                      <span className="flex items-center gap-1 text-accent-green-foreground">
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Ready
                      </span>
                    )}
                    {attachment.status === "failed" && (
                      <span className="text-accent-rose-foreground">Failed</span>
                    )}
                  </span>
                  <button
                    type="button"
                    title="Remove file"
                    onClick={() =>
                      setAttachments((current) =>
                        current.filter((currentAttachment) => currentAttachment.localId !== attachment.localId),
                      )
                    }
                    className="shrink-0 text-muted transition hover:text-foreground"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploadError && (
            <p className="rounded-xl border border-accent-rose/20 bg-accent-rose/5 px-3 py-2 text-xs text-accent-rose-foreground">
              {uploadError}
            </p>
          )}

          {selectedMode === "homework_help" && (
            <div className="flex items-start gap-2 rounded-xl border border-sidebar-accent/20 bg-sidebar-accent/5 px-3 py-2.5">
              <span className="mt-0.5 text-sm leading-none">+</span>
              <p className="text-xs text-foreground/80">
                <span className="font-medium">Tip:</span> Upload your worksheet or problem set above so the assistant can work through it step by step. It falls back to class materials if no file is added.
              </p>
            </div>
          )}

          {attachments.length > 1 && (
            <div className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
              <span className="mt-0.5 text-sm leading-none">+</span>
              <p className="text-xs text-foreground/80">
                If you add multiple files, mention the file name, page, or topic in your question so the assistant can ground the answer to the right material.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted transition hover:bg-surface hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleStart}
          disabled={!selectedMode || isUploading}
          className="rounded-xl bg-hero px-5 py-2 text-sm font-semibold text-white transition hover:bg-hero-mid active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start Session
        </button>
      </div>
    </div>
  );
}
