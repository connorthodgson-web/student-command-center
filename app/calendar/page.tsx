"use client";

import { useState } from "react";
import { useCalendar } from "../../lib/stores/calendarStore";
import { getTodayDateString } from "../../lib/schedule";
import type { SchoolCalendarEntry, SchoolDayCategory } from "../../types";

type AbOption = "A" | "B" | "";

const CATEGORIES: {
  value: SchoolDayCategory;
  label: string;
  description: string;
  color: string;
  activeColor: string;
}[] = [
  {
    value: "no_school",
    label: "No School",
    description: "School is closed",
    color: "border-border bg-card text-muted hover:bg-surface",
    activeColor: "border-accent-rose-foreground/40 bg-accent-rose text-accent-rose-foreground font-semibold",
  },
  {
    value: "holiday",
    label: "Holiday",
    description: "Official holiday or break",
    color: "border-border bg-card text-muted hover:bg-surface",
    activeColor: "border-accent-amber-foreground/40 bg-accent-amber text-accent-amber-foreground font-semibold",
  },
  {
    value: "teacher_workday",
    label: "Teacher Workday",
    description: "Staff in, no students",
    color: "border-border bg-card text-muted hover:bg-surface",
    activeColor: "border-accent-blue-foreground/40 bg-accent-blue text-accent-blue-foreground font-semibold",
  },
  {
    value: "special",
    label: "Special Schedule",
    description: "Modified day",
    color: "border-border bg-card text-muted hover:bg-surface",
    activeColor: "border-accent-purple-foreground/40 bg-accent-purple text-accent-purple-foreground font-semibold",
  },
];

const CATEGORY_BADGE: Record<
  SchoolDayCategory,
  { label: string; className: string }
> = {
  no_school: { label: "No School", className: "bg-accent-rose text-accent-rose-foreground" },
  holiday: { label: "Holiday", className: "bg-accent-amber text-accent-amber-foreground" },
  teacher_workday: { label: "Teacher Workday", className: "bg-accent-blue text-accent-blue-foreground" },
  special: { label: "Special Schedule", className: "bg-accent-purple text-accent-purple-foreground" },
};

function formatDisplayDate(dateStr: string): string {
  // Parse as local date to avoid UTC offset issues
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CalendarPage() {
  const { entries, addEntry, removeEntry } = useCalendar();

  const today = getTodayDateString();

  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<SchoolDayCategory | "">("");
  const [label, setLabel] = useState("");
  const [abOverride, setAbOverride] = useState<AbOption>("");
  const [showAbOverride, setShowAbOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upcomingEntries = entries.filter((e) => e.date >= today);
  const pastEntries = entries.filter((e) => e.date < today);

  const handleAdd = () => {
    if (!date) {
      setError("Please select a date.");
      return;
    }
    if (!category) {
      setError("Please choose a day type.");
      return;
    }
    setError(null);
    addEntry({
      date,
      category,
      label: label.trim() || undefined,
      abOverride: abOverride || undefined,
    });
    // Reset form
    setDate(today);
    setCategory("");
    setLabel("");
    setAbOverride("");
    setShowAbOverride(false);
  };

  return (
    <main className="flex min-h-screen flex-col">
      {/* ── Dark hero ──────────────────────────────────────────── */}
      <div className="bg-hero px-8 py-10 md:py-12">
        <div className="mx-auto max-w-4xl">
          <p className="text-[13px] font-medium text-sidebar-text">Personalize your assistant</p>
          <h1 className="mt-1.5 text-[2rem] font-bold tracking-tight text-white leading-tight">
            School Calendar
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/50">
            Mark days school isn&apos;t in session or has a different schedule. Your assistant uses
            this to give smarter answers and show the right classes.
          </p>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-8 py-8">

        {/* ── Add entry form ──────────────────────────────────── */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">Add a special day</h2>
          <p className="mt-0.5 text-sm text-muted">
            Select a date and tell the assistant what kind of day it is.
          </p>

          <div className="mt-5 space-y-5">
            {/* Date */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40"
              />
            </div>

            {/* Category */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Day type</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`rounded-full border px-4 py-1.5 text-sm transition select-none ${
                      category === cat.value ? cat.activeColor : cat.color
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              {category && (
                <p className="mt-1.5 text-xs text-muted">
                  {CATEGORIES.find((c) => c.value === category)?.description}
                </p>
              )}
            </div>

            {/* Optional label */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Label{" "}
                <span className="text-xs font-normal text-muted">(optional)</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Spring Break, Parent-Teacher Conferences"
                className="w-full max-w-sm rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40"
              />
            </div>

            {/* A/B override — only relevant for special/modified days */}
            <div>
              <button
                type="button"
                onClick={() => setShowAbOverride((v) => !v)}
                className="text-sm text-muted underline underline-offset-2 hover:text-foreground transition-colors"
              >
                {showAbOverride ? "Hide A/B override ↑" : "Set A/B day override (optional) ↓"}
              </button>

              {showAbOverride && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted">
                    If your school uses A/B rotation and this day has a specific rotation, choose
                    it here. The assistant will use this instead of the manual selector.
                  </p>
                  <div className="flex gap-2">
                    {(["", "A", "B"] as AbOption[]).map((opt) => (
                      <button
                        key={opt === "" ? "none" : opt}
                        type="button"
                        onClick={() => setAbOverride(opt)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition select-none ${
                          abOverride === opt
                            ? opt === "A"
                              ? "border-accent-blue-foreground/40 bg-accent-blue font-semibold text-accent-blue-foreground"
                              : opt === "B"
                              ? "border-accent-purple-foreground/40 bg-accent-purple font-semibold text-accent-purple-foreground"
                              : "border-accent-green-foreground/40 bg-accent-green font-semibold text-accent-green-foreground"
                            : "border-border bg-card text-muted hover:bg-surface"
                        }`}
                      >
                        {opt === "" ? "No override" : `${opt}-Day`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <p className="rounded-xl border border-accent-rose bg-accent-rose px-4 py-2.5 text-sm text-accent-rose-foreground">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleAdd}
              disabled={!date || !category}
              className="rounded-full bg-accent-green-foreground px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Add to calendar
            </button>
          </div>
        </section>

        {/* ── Upcoming special days ────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
            Upcoming Special Days
          </h2>

          {upcomingEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-8 text-center">
              <p className="text-sm text-muted">
                No upcoming special days yet.{" "}
                <span className="text-foreground/60">
                  Add holidays, no-school days, or schedule overrides above.
                </span>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingEntries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  isToday={entry.date === today}
                  onDelete={() => removeEntry(entry.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Past special days ────────────────────────────────── */}
        {pastEntries.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
              Past
            </h2>
            <div className="space-y-2 opacity-60">
              {[...pastEntries].reverse().map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  isToday={false}
                  onDelete={() => removeEntry(entry.id)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function EntryRow({
  entry,
  isToday,
  onDelete,
}: {
  entry: SchoolCalendarEntry;
  isToday: boolean;
  onDelete: () => void;
}) {
  const badge = CATEGORY_BADGE[entry.category];

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      {/* Date */}
      <div className="min-w-[130px] shrink-0">
        <p className="text-sm font-medium text-foreground">
          {formatDisplayDate(entry.date)}
          {isToday && (
            <span className="ml-2 rounded-full bg-sidebar px-2 py-0.5 text-[10px] font-semibold text-white">
              today
            </span>
          )}
        </p>
      </div>

      {/* Category badge */}
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>

      {/* Label */}
      {entry.label && (
        <p className="flex-1 truncate text-sm text-muted">{entry.label}</p>
      )}
      {!entry.label && <div className="flex-1" />}

      {/* A/B override badge */}
      {entry.abOverride && (
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            entry.abOverride === "A"
              ? "bg-accent-blue text-accent-blue-foreground"
              : "bg-accent-purple text-accent-purple-foreground"
          }`}
        >
          {entry.abOverride}-Day
        </span>
      )}

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        title="Remove this entry"
        className="shrink-0 rounded-full px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface hover:text-accent-rose-foreground"
      >
        Remove
      </button>
    </div>
  );
}
