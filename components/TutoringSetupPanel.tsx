"use client";

import { useState } from "react";
import type { SchoolClass, TutoringContext, TutoringMode } from "../types";

const TUTORING_MODES: {
  mode: TutoringMode;
  label: string;
  description: string;
  emoji: string;
}[] = [
  {
    mode: "explain",
    label: "Explain It",
    description: "Concepts broken down clearly",
    emoji: "💡",
  },
  {
    mode: "step_by_step",
    label: "Step by Step",
    description: "Walk through problems together",
    emoji: "🪜",
  },
  {
    mode: "quiz",
    label: "Quiz Me",
    description: "Test what you know",
    emoji: "🎯",
  },
  {
    mode: "review",
    label: "Quick Review",
    description: "Summarize key ideas & weak spots",
    emoji: "📖",
  },
  {
    mode: "study_plan",
    label: "Study Plan",
    description: "Build a realistic study schedule",
    emoji: "📅",
  },
  {
    mode: "homework_help",
    label: "Homework Help",
    description: "Get unstuck on specific problems",
    emoji: "✏️",
  },
];

export interface TutoringSetupResult {
  context: TutoringContext;
  firstMessage: string;
}

interface TutoringSetupPanelProps {
  classes: SchoolClass[];
  onStart: (result: TutoringSetupResult) => void;
  onCancel: () => void;
}

export function TutoringSetupPanel({
  classes,
  onStart,
  onCancel,
}: TutoringSetupPanelProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<TutoringMode | null>(null);
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("");

  const handleStart = () => {
    if (!selectedMode) return;

    const context: TutoringContext = {
      mode: selectedMode,
      classId: selectedClassId || undefined,
      topic: topic.trim() || undefined,
      goal: goal.trim() || undefined,
    };

    const modeLabel =
      TUTORING_MODES.find((m) => m.mode === selectedMode)?.label ?? selectedMode;
    const className = selectedClassId
      ? classes.find((c) => c.id === selectedClassId)?.name
      : null;

    const parts: string[] = [`I want to start a ${modeLabel} tutoring session`];
    if (className) parts.push(` for ${className}`);
    if (topic.trim()) parts.push(`. Topic: ${topic.trim()}`);
    if (goal.trim()) parts.push(`. Goal: ${goal.trim()}`);
    if (!topic.trim() && !goal.trim()) parts.push(". Let's get started.");

    onStart({ context, firstMessage: parts.join("") });
  };

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">🎓</span>
            <h2 className="text-base font-semibold text-foreground">
              Start a Tutoring Session
            </h2>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            Choose a learning mode — your assistant adapts its teaching style.
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

      {/* Class selector */}
      {classes.length > 0 && (
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted">
            Class (optional)
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-sidebar-accent/50 focus:ring-2 focus:ring-sidebar-accent/20"
          >
            <option value="">General — no specific class</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Mode grid */}
      <div>
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-muted">
          How do you want to learn?
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TUTORING_MODES.map(({ mode, label, description, emoji }) => {
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
                <div className="mb-1 text-base leading-none">{emoji}</div>
                <div className="text-xs font-semibold text-foreground">{label}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-muted">
                  {description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Topic + goal — shown when mode is selected */}
      {selectedMode && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted">
              Topic (optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
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
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Prep for Friday's test"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted/50 focus:border-sidebar-accent/50 focus:ring-2 focus:ring-sidebar-accent/20"
            />
          </div>
        </div>
      )}

      {/* Actions */}
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
          disabled={!selectedMode}
          className="rounded-xl bg-hero px-5 py-2 text-sm font-semibold text-white transition hover:bg-hero-mid active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start Session →
        </button>
      </div>
    </div>
  );
}
