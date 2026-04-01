"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClassColorField } from "../../components/ClassColorField";
import { DEFAULT_CLASS_COLOR } from "../../lib/class-colors";
import type { Weekday } from "../../types";

type Step = 1 | 2 | "done";

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
  const [classColor, setClassColor] = useState(DEFAULT_CLASS_COLOR);

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
            color: classColor,
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

    setStep("done");
    setTimeout(() => router.replace("/dashboard"), 1200);
  }

  function toggleDay(day: Weekday) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  const inputClass =
    "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/30";

  return (
    <div className="flex min-h-dvh flex-col bg-background px-6 py-12">
      <div className="mx-auto w-full max-w-md">

        {/* Brand mark */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-hero shadow-card-md">
            <svg width="28" height="28" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="256" cy="256" r="164" fill="#59D889" />
              <circle cx="256" cy="256" r="118" fill="#102216" />
              <path d="M187 257.5C187 219.116 216.116 190 254.5 190C286.319 190 308.063 207.498 318.533 231.578L286.664 244.179C281.749 232.771 270.503 225 255.383 225C236.781 225 223 239.276 223 257.5C223 275.227 236.283 290 256.375 290C270.377 290 281.749 282.229 286.789 270.57L318.782 282.922C307.938 307.749 285.073 325 254.5 325C216.116 325 187 295.884 187 257.5Z" fill="#F5F7F5" />
              <path d="M273 189H307V325H273V189Z" fill="#F5F7F5" />
            </svg>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Command Center
          </p>
        </div>

        {/* Progress bar — hidden on done screen */}
        {step !== "done" && (
          <div className="mb-8 flex items-center gap-2">
            <div
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                step >= 1 ? "bg-accent-green-foreground" : "bg-border"
              }`}
            />
            <div
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                step >= 2 ? "bg-accent-green-foreground" : "bg-border"
              }`}
            />
          </div>
        )}

        {/* Done state */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-green/60">
              <svg className="h-7 w-7 text-accent-green-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                You&apos;re all set{name ? `, ${name.trim().split(" ")[0]}` : ""}
              </p>
              <p className="mt-1 text-sm text-muted">Taking you to your dashboard…</p>
            </div>
          </div>
        )}

        {/* Step 1: Name */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                What should I call you?
              </h1>
              <p className="mt-2 text-sm text-muted">
                Your assistant will use this to personalize its responses.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
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
              className="w-full rounded-full bg-accent-green-foreground px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              Continue
            </button>
          </form>
        )}

        {/* Step 2: First class */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Add your first class
              </h1>
              <p className="mt-2 text-sm text-muted">
                Helps the assistant understand your schedule. You can always add more later.
              </p>
            </div>

            <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card">
              {/* Class name */}
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground">
                  Class name
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
                  Days
                </span>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleDay(d.key)}
                      className={`rounded-full border px-4 py-2.5 text-sm font-medium transition select-none min-h-[44px] flex items-center ${
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

              <ClassColorField
                value={classColor}
                onChange={setClassColor}
                helperText="Pick a color now or change it later in settings."
              />
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
                className="flex-1 rounded-full bg-accent-green-foreground px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Get started
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
