"use client";

import { useState } from "react";
import { loadProfile, saveProfile } from "../lib/profile";
import type { MainGoal } from "../lib/profile";

type Step = 1 | 2;

const GOAL_OPTIONS: { value: MainGoal; label: string; description: string; icon: string }[] = [
  { value: "organized", label: "Stay organized",  description: "Keep on top of deadlines and your schedule", icon: "📋" },
  { value: "study",     label: "Study better",    description: "Understand material more deeply",             icon: "📖" },
  { value: "both",      label: "Both",            description: "All-around academic edge",                   icon: "✦"  },
];

export function OnboardingModal({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [mainGoal, setMainGoal] = useState<MainGoal | null>(null);
  const [focusClass, setFocusClass] = useState("");
  const [nameError, setNameError] = useState(false);
  const [goalError, setGoalError] = useState(false);

  function handleStep1Next() {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setStep(2);
  }

  function handleFinish() {
    if (!mainGoal) {
      setGoalError(true);
      return;
    }
    setGoalError(false);

    const existing = loadProfile();
    saveProfile({
      ...existing,
      displayName: name.trim(),
      gradeLevel: gradeLevel.trim() || undefined,
      mainGoal,
      focusClass: focusClass.trim() || undefined,
      onboardingComplete: true,
    });

    onComplete();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl border border-border overflow-hidden">

        {/* Progress bar */}
        <div className="h-1 bg-border">
          <div
            className="h-full bg-sidebar-accent transition-all duration-500"
            style={{ width: step === 1 ? "50%" : "100%" }}
          />
        </div>

        <div className="px-7 py-8">
          {/* Header */}
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-sidebar-accent/20">
                <span className="text-[10px] font-bold text-sidebar-accent">S</span>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                Student Command Center
              </span>
            </div>

            {step === 1 ? (
              <>
                <h1 className="text-xl font-bold text-foreground">Let&apos;s set you up.</h1>
                <p className="mt-1.5 text-sm text-muted">Takes about 30 seconds. You can change everything later in settings.</p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold text-foreground">What&apos;s your main goal?</h1>
                <p className="mt-1.5 text-sm text-muted">This helps your assistant focus on what matters most to you.</p>
              </>
            )}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              {/* Name field */}
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="onb-name">
                  What should we call you? <span className="text-rose-500">*</span>
                </label>
                <input
                  id="onb-name"
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(false); }}
                  onKeyDown={(e) => e.key === "Enter" && handleStep1Next()}
                  placeholder="Your first name"
                  className={`w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted/40 outline-none transition focus:ring-2 focus:ring-sidebar-accent/20 ${
                    nameError ? "border-rose-400 focus:border-rose-400" : "border-border focus:border-sidebar-accent"
                  }`}
                />
                {nameError && (
                  <p className="mt-1.5 text-xs text-rose-500">Your name is required.</p>
                )}
              </div>

              {/* Grade level */}
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="onb-grade">
                  Grade or school level <span className="text-muted/50">(optional)</span>
                </label>
                <input
                  id="onb-grade"
                  type="text"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleStep1Next()}
                  placeholder="e.g. 11th grade, Junior, Freshman"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted/40 outline-none transition focus:border-sidebar-accent focus:ring-2 focus:ring-sidebar-accent/20"
                />
              </div>

              <button
                type="button"
                onClick={handleStep1Next}
                className="w-full rounded-xl bg-sidebar py-2.5 text-sm font-semibold text-white transition hover:opacity-90 mt-2"
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {/* Goal picker */}
              <div className="space-y-2">
                {GOAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setMainGoal(opt.value); setGoalError(false); }}
                    className={`flex w-full items-center gap-4 rounded-xl border-2 px-4 py-3.5 text-left transition-all ${
                      mainGoal === opt.value
                        ? "border-sidebar-accent bg-sidebar-accent/10"
                        : "border-border bg-background hover:border-border hover:bg-surface"
                    }`}
                  >
                    <span className="text-xl leading-none">{opt.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">{opt.label}</span>
                      <span className="block text-xs text-muted">{opt.description}</span>
                    </span>
                    {mainGoal === opt.value && (
                      <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[9px] font-bold text-[#0f2117]">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
                {goalError && (
                  <p className="text-xs text-rose-500">Please pick a goal to continue.</p>
                )}
              </div>

              {/* Focus class */}
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="onb-focus">
                  Hardest or most important class right now <span className="text-muted/50">(optional)</span>
                </label>
                <input
                  id="onb-focus"
                  type="text"
                  value={focusClass}
                  onChange={(e) => setFocusClass(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFinish()}
                  placeholder="e.g. AP Chemistry, Calculus"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted/40 outline-none transition focus:border-sidebar-accent focus:ring-2 focus:ring-sidebar-accent/20"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-muted transition hover:text-foreground"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  className="flex-1 rounded-xl bg-sidebar py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Take me in
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
