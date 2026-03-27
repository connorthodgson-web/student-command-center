"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Weekday } from "../../types";

type Step = 1 | 2;

const DAYS: { key: Weekday; label: string }[] = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
];

// TODO: Replace localStorage with Supabase user profile once auth is set up
export const ONBOARDING_KEY = "scc-onboarding";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [selectedDays, setSelectedDays] = useState<Weekday[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setStep(2);
  }

  function handleStep2Submit(e: React.FormEvent) {
    e.preventDefault();
    complete();
  }

  function handleSkip() {
    complete();
  }

  function complete() {
    // TODO: Save to Supabase user profile once auth is set up
    const classes = className.trim()
      ? [
          {
            id: `class-onboarding-${Date.now()}`,
            name: className.trim(),
            days: selectedDays,
            startTime: startTime || "08:00",
            endTime: endTime || "09:00",
            color: "#d4edd9",
          },
        ]
      : [];

    const data = {
      name: name.trim(),
      classes,
      onboardingComplete: true,
    };

    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(data));

    // Also save the first class into the classes store key so it shows up in /classes
    if (classes.length > 0) {
      try {
        const existingRaw = localStorage.getItem("scc-classes");
        const existing = existingRaw ? JSON.parse(existingRaw) : [];
        const merged = [...classes, ...existing];
        localStorage.setItem("scc-classes", JSON.stringify(merged));
      } catch {
        // ignore storage errors
      }
    }

    router.replace("/dashboard");
  }

  function toggleDay(day: Weekday) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  const inputClass =
    "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/30";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        {/* Progress bar */}
        <div className="mb-8 flex items-center gap-2">
          <div
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              step >= 1 ? "bg-accent-green-foreground" : "bg-border"
            }`}
          />
          <div
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              step >= 2 ? "bg-accent-green-foreground" : "bg-border"
            }`}
          />
        </div>

        {/* Step 1: Name */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Welcome! What&apos;s your name?
              </h1>
              <p className="mt-2 text-sm text-muted">
                Your assistant will use this to greet you personally.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-foreground">
                  Your name
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex"
                  autoFocus
                  className={inputClass}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full rounded-full bg-accent-green-foreground px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Continue →
            </button>
          </form>
        )}

        {/* Step 2: First class */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Add your first class
              </h1>
              <p className="mt-2 text-sm text-muted">
                This helps the assistant understand your schedule. You can add
                more later.
              </p>
            </div>

            <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
              {/* Class name */}
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground">
                  Class name{" "}
                  <span className="text-xs font-normal text-muted">(required)</span>
                </span>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g. AP Biology"
                  autoFocus
                  className={inputClass}
                />
              </label>

              {/* Days */}
              <div>
                <span className="mb-2 block text-sm font-medium text-foreground">
                  Days{" "}
                  <span className="text-xs font-normal text-muted">(optional)</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleDay(d.key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition select-none ${
                        selectedDays.includes(d.key)
                          ? "border-accent-green-foreground/50 bg-accent-green text-accent-green-foreground"
                          : "border-border bg-card text-muted hover:bg-surface"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-foreground">
                    Start time
                  </span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-foreground">
                    End time
                  </span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSkip}
                className="flex-1 rounded-full border border-border px-6 py-3 text-sm font-medium text-muted transition hover:bg-surface hover:text-foreground"
              >
                Skip for now
              </button>
              <button
                type="submit"
                disabled={!className.trim()}
                className="flex-1 rounded-full bg-accent-green-foreground px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Finish →
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
