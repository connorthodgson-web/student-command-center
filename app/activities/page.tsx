"use client";

import { useEffect, useRef, useState } from "react";
import {
  type Activity,
  type ParsedActivity,
  formatActivityDays,
  formatActivityTime,
  getTodayActivities,
  loadActivities,
  parseActivityInput,
  saveActivities,
} from "../../lib/activities";
import {
  type LifeConstraint,
  extractDateFromText,
  loadConstraints,
  saveConstraints,
} from "../../lib/constraints";
import type { Weekday } from "../../types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const WEEKDAYS: { label: string; value: Weekday }[] = [
  { label: "Mon", value: "monday" },
  { label: "Tue", value: "tuesday" },
  { label: "Wed", value: "wednesday" },
  { label: "Thu", value: "thursday" },
  { label: "Fri", value: "friday" },
  { label: "Sat", value: "saturday" },
  { label: "Sun", value: "sunday" },
];

function formatConstraintDate(constraint: LifeConstraint): string {
  if (!constraint.date) return "";
  const d = new Date(constraint.date + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ── Example placeholders ───────────────────────────────────────────────────────

const ACTIVITY_EXAMPLES = [
  "Basketball practice Tue and Thu 7:30-9",
  "Work Mon/Wed/Fri 4-8pm",
  "Gym Tue and Fri 5:30-7",
];

const CONSTRAINT_EXAMPLES = [
  "Dentist tomorrow at 3pm",
  "Busy Saturday morning",
  "Game Friday night",
];

// ── Activity card ──────────────────────────────────────────────────────────────

function ActivityCard({
  activity,
  onDelete,
  onEdit,
}: {
  activity: Activity;
  onDelete: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-start justify-between rounded-2xl border border-border bg-card px-4 py-3.5 shadow-card-sm">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight">{activity.title}</p>
        <p className="mt-1 text-xs text-muted">
          {formatActivityDays(activity.daysOfWeek)} · {formatActivityTime(activity.startTime, activity.endTime)}
        </p>
        {activity.location && (
          <p className="mt-0.5 text-xs text-muted">{activity.location}</p>
        )}
        {activity.notes && (
          <p className="mt-1 text-xs text-muted/70 italic">{activity.notes}</p>
        )}
      </div>
      <div className="ml-3 flex shrink-0 items-center gap-1">
        {onEdit && (
          <button
            onClick={onEdit}
            className="rounded-lg p-2 text-muted/50 transition-colors hover:bg-surface hover:text-foreground"
            aria-label="Edit activity"
            title="Edit activity"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
        <button
          onClick={onDelete}
          className="rounded-lg p-2 text-muted/50 transition-colors hover:bg-surface hover:text-red-400"
          aria-label="Delete activity"
          title="Delete activity"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Constraint item ────────────────────────────────────────────────────────────

function ConstraintItem({
  constraint,
  onDelete,
}: {
  constraint: LifeConstraint;
  onDelete: () => void;
}) {
  const dateLabel = formatConstraintDate(constraint);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-tight">{constraint.text}</p>
        {dateLabel && (
          <p className="mt-0.5 text-[11px] text-muted">{dateLabel}</p>
        )}
      </div>
      <button
        onClick={onDelete}
        className="shrink-0 rounded-lg p-2 text-muted/50 transition-colors hover:bg-surface hover:text-red-400"
        aria-label="Remove"
        title="Remove"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── Manual activity form ───────────────────────────────────────────────────────

function ManualActivityForm({
  onSave,
  onCancel,
}: {
  onSave: (a: Omit<Activity, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [selectedDays, setSelectedDays] = useState<Weekday[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: Weekday) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = () => {
    if (!title.trim()) { setError("Activity name is required."); return; }
    if (selectedDays.length === 0) { setError("Select at least one day."); return; }
    if (!startTime || !endTime) { setError("Start and end time are required."); return; }
    if (startTime >= endTime) { setError("Start time must be before end time."); return; }
    setError(null);
    onSave({ title: title.trim(), daysOfWeek: selectedDays, startTime, endTime, location: location.trim() || undefined, notes: notes.trim() || undefined });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <p className="text-sm font-semibold text-foreground">Add activity manually</p>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Activity name *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Basketball practice"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-sidebar-accent focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-muted">Days *</label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDay(d.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                selectedDays.includes(d.value)
                  ? "bg-sidebar-accent text-[#0f2117]"
                  : "border border-border bg-surface text-muted hover:border-sidebar-accent/50"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Start time *</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-sidebar-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">End time *</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-sidebar-accent focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Location (optional)</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Gym, School, Home"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-sidebar-accent focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Bring gear, coach's number"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-sidebar-accent focus:outline-none"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          className="flex-1 rounded-xl bg-sidebar-accent px-4 py-2 text-sm font-semibold text-[#0f2117] transition-opacity hover:opacity-90"
        >
          Save activity
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl border border-border px-4 py-2 text-sm text-muted transition-colors hover:bg-surface"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [constraints, setConstraints] = useState<LifeConstraint[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Natural-language input for activities
  const [nlInput, setNlInput] = useState("");
  const [nlError, setNlError] = useState<string | null>(null);
  const [nlParsed, setNlParsed] = useState<ParsedActivity | null>(null);
  const nlInputRef = useRef<HTMLInputElement>(null);

  // Manual form toggle
  const [manualOpen, setManualOpen] = useState(false);

  // Constraint input
  const [constraintInput, setConstraintInput] = useState("");

  // Load from localStorage on mount
  useEffect(() => {
    setActivities(loadActivities());
    setConstraints(loadConstraints());
    setHydrated(true);
  }, []);

  // ── Activity handlers ────────────────────────────────────────────────────────

  const handleNlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = parseActivityInput(nlInput);
    if (!result.success) {
      setNlError(result.error);
      setNlParsed(null);
      return;
    }
    setNlError(null);
    setNlParsed(result.data);
  };

  const confirmNlActivity = () => {
    if (!nlParsed) return;
    const newActivity: Activity = {
      id: genId(),
      ...nlParsed,
      createdAt: new Date().toISOString(),
    };
    const updated = [...activities, newActivity];
    setActivities(updated);
    saveActivities(updated);
    setNlInput("");
    setNlParsed(null);
    setNlError(null);
  };

  const addManualActivity = (data: Omit<Activity, "id" | "createdAt">) => {
    const newActivity: Activity = { id: genId(), ...data, createdAt: new Date().toISOString() };
    const updated = [...activities, newActivity];
    setActivities(updated);
    saveActivities(updated);
    setManualOpen(false);
  };

  const deleteActivity = (id: string) => {
    const updated = activities.filter((a) => a.id !== id);
    setActivities(updated);
    saveActivities(updated);
  };

  // Pre-fill the NL input with an activity's details for easy correction, then delete the original
  const editActivity = (activity: Activity) => {
    const dayStr = activity.daysOfWeek
      .map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3))
      .join("/");
    const timeStr = `${activity.startTime}–${activity.endTime}`;
    const text = [activity.title, dayStr, timeStr, activity.location].filter(Boolean).join(" ");
    deleteActivity(activity.id);
    setNlInput(text);
    setNlParsed(null);
    setNlError(null);
    setManualOpen(false);
    nlInputRef.current?.focus();
  };

  // ── Constraint handlers ──────────────────────────────────────────────────────

  const handleAddConstraint = (e: React.FormEvent) => {
    e.preventDefault();
    const text = constraintInput.trim();
    if (!text) return;
    const date = extractDateFromText(text);
    const newConstraint: LifeConstraint = {
      id: genId(),
      text,
      date,
      createdAt: new Date().toISOString(),
    };
    const updated = [newConstraint, ...constraints];
    setConstraints(updated);
    saveConstraints(updated);
    setConstraintInput("");
  };

  const deleteConstraint = (id: string) => {
    const updated = constraints.filter((c) => c.id !== id);
    setConstraints(updated);
    saveConstraints(updated);
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="h-8 w-32 animate-pulse rounded-lg bg-surface" />
          <div className="h-4 w-64 animate-pulse rounded-lg bg-surface" />
          <div className="mt-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const todayActivities = getTodayActivities(activities);

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-2xl space-y-10">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Activities</h1>
          <p className="mt-1 text-sm text-muted">
            Recurring commitments outside school — the assistant uses these to understand your week.
          </p>
          {todayActivities.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {todayActivities.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-sidebar-accent/15 px-3 py-1 text-xs font-medium text-sidebar-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-sidebar-accent" />
                  {a.title} · {formatActivityTime(a.startTime, a.endTime)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Recurring Activities ─────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Recurring activities</h2>
            {!manualOpen && (
              <button
                onClick={() => setManualOpen(true)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface hover:text-foreground"
              >
                + Add manually
              </button>
            )}
          </div>

          {/* Natural-language quick add */}
          <form onSubmit={handleNlSubmit} className="space-y-2">
            <div className="flex gap-2">
              <input
                ref={nlInputRef}
                type="text"
                value={nlInput}
                onChange={(e) => { setNlInput(e.target.value); setNlError(null); setNlParsed(null); }}
                placeholder='e.g. "Basketball Tue/Thu 7:30–9" or "Work Mon/Wed 4–8pm"'
                className="flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:border-sidebar-accent focus:outline-none"
              />
              <button
                type="submit"
                disabled={!nlInput.trim()}
                className="rounded-xl bg-sidebar-accent px-4 py-2.5 text-sm font-semibold text-[#0f2117] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Parse
              </button>
            </div>

            {nlError && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{nlError}</p>
            )}

            {nlParsed && (
              <div className="rounded-xl border border-sidebar-accent/30 bg-sidebar-accent/10 px-4 py-3 space-y-2">
                <p className="text-xs font-medium text-sidebar-accent">Looks good?</p>
                <div className="text-sm text-foreground space-y-0.5">
                  <p><span className="text-muted">Name:</span> {nlParsed.title}</p>
                  <p><span className="text-muted">Days:</span> {formatActivityDays(nlParsed.daysOfWeek)}</p>
                  <p><span className="text-muted">Time:</span> {formatActivityTime(nlParsed.startTime, nlParsed.endTime)}</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={confirmNlActivity}
                    className="rounded-lg bg-sidebar-accent px-3 py-1.5 text-xs font-semibold text-[#0f2117] transition-opacity hover:opacity-90"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNlParsed(null); setNlInput(""); }}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Manual form */}
          {manualOpen && (
            <ManualActivityForm
              onSave={addManualActivity}
              onCancel={() => setManualOpen(false)}
            />
          )}

          {/* Activity list */}
          {activities.length > 0 ? (
            <div className="space-y-2">
              {activities.map((a) => (
                <ActivityCard
                  key={a.id}
                  activity={a}
                  onEdit={() => editActivity(a)}
                  onDelete={() => deleteActivity(a.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center">
              <p className="text-sm font-medium text-muted">No activities yet</p>
              <p className="mt-1 text-xs text-muted/70">Try adding one above. Examples:</p>
              <ul className="mt-3 space-y-1">
                {ACTIVITY_EXAMPLES.map((ex) => (
                  <li key={ex}>
                    <button
                      onClick={() => { setNlInput(ex); nlInputRef.current?.focus(); }}
                      className="text-xs text-sidebar-accent/80 hover:text-sidebar-accent underline-offset-2 hover:underline transition-colors"
                    >
                      "{ex}"
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ── Life Constraints ─────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Life constraints</h2>
            <p className="mt-0.5 text-xs text-muted">One-off or flexible commitments — the assistant factors these into planning.</p>
          </div>

          <form onSubmit={handleAddConstraint} className="flex gap-2">
            <input
              type="text"
              value={constraintInput}
              onChange={(e) => setConstraintInput(e.target.value)}
              placeholder='e.g. "Dentist tomorrow at 3" or "Busy Saturday morning"'
              className="flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:border-sidebar-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={!constraintInput.trim()}
              className="rounded-xl bg-sidebar-accent px-4 py-2.5 text-sm font-semibold text-[#0f2117] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Add
            </button>
          </form>

          {constraints.length > 0 ? (
            <div className="space-y-2">
              {constraints.map((c) => (
                <ConstraintItem key={c.id} constraint={c} onDelete={() => deleteConstraint(c.id)} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-6 text-center">
              <p className="text-sm font-medium text-muted">No constraints yet</p>
              <p className="mt-1 text-xs text-muted/70">Examples:</p>
              <ul className="mt-2 space-y-1">
                {CONSTRAINT_EXAMPLES.map((ex) => (
                  <li key={ex}>
                    <button
                      onClick={() => setConstraintInput(ex)}
                      className="text-xs text-sidebar-accent/80 hover:text-sidebar-accent underline-offset-2 hover:underline transition-colors"
                    >
                      "{ex}"
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
