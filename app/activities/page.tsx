"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { usePlanningStore } from "../../lib/stores/planningStore";
import {
  formatActivityDays,
  formatActivityTime,
  parseActivityInput,
  type ParsedActivity,
} from "../../lib/activities";
import type { PlanningItem, Weekday } from "../../types";

const WEEKDAYS: { label: string; value: Weekday }[] = [
  { label: "Mon", value: "monday" },
  { label: "Tue", value: "tuesday" },
  { label: "Wed", value: "wednesday" },
  { label: "Thu", value: "thursday" },
  { label: "Fri", value: "friday" },
  { label: "Sat", value: "saturday" },
  { label: "Sun", value: "sunday" },
];

const ACTIVITY_EXAMPLES = [
  "Basketball practice Tue and Thu 7:30-9",
  "Work Mon/Wed/Fri 4-8pm",
  "Gym Tue and Fri 5:30-7",
];

const EVENT_EXAMPLES = [
  { title: "Dentist Appointment", date: "", startTime: "15:00", endTime: "16:00" },
  { title: "Debate Tournament", date: "", startTime: "", endTime: "" },
];

function sortWeekdays(days: Weekday[]) {
  const order: Weekday[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  return [...days].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

function formatEventSubtitle(item: PlanningItem) {
  if (item.isAllDay) return `${item.date} · All day`;
  if (item.startTime && item.endTime) return `${item.date} · ${item.startTime}-${item.endTime}`;
  if (item.startTime) return `${item.date} · ${item.startTime}`;
  return item.date ?? "Date not set";
}

function PlanningCard({
  item,
  subtitle,
  onDelete,
}: {
  item: PlanningItem;
  subtitle: string;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-card-sm">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{item.title}</p>
        <p className="mt-1 text-xs text-muted">{subtitle}</p>
        {item.location ? <p className="mt-0.5 text-xs text-muted">{item.location}</p> : null}
        {item.notes ? <p className="mt-1 text-xs italic text-muted/70">{item.notes}</p> : null}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg p-2 text-muted/50 transition-colors hover:bg-surface hover:text-red-400"
        title="Delete"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function ActivitiesPage() {
  const { items, loading, addItem, removeItem } = usePlanningStore();
  const [nlInput, setNlInput] = useState("");
  const [nlParsed, setNlParsed] = useState<ParsedActivity | null>(null);
  const [nlError, setNlError] = useState<string | null>(null);
  const [activityLocation, setActivityLocation] = useState("");
  const [activityNotes, setActivityNotes] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualDays, setManualDays] = useState<Weekday[]>([]);
  const [manualStartTime, setManualStartTime] = useState("");
  const [manualEndTime, setManualEndTime] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventStartTime, setEventStartTime] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [eventAllDay, setEventAllDay] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const recurringActivities = useMemo(
    () =>
      items
        .filter((item) => item.kind === "recurring_activity")
        .sort((a, b) => a.title.localeCompare(b.title)),
    [items],
  );

  const oneOffEvents = useMemo(
    () =>
      items
        .filter((item) => item.kind === "one_off_event")
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
    [items],
  );

  const handleParseActivity = (event: React.FormEvent) => {
    event.preventDefault();
    const result = parseActivityInput(nlInput);
    if (!result.success) {
      setNlParsed(null);
      setNlError(result.error);
      return;
    }

    setNlParsed(result.data);
    setNlError(null);
  };

  const saveParsedActivity = async () => {
    if (!nlParsed) return;

    setSaving(true);
    try {
      await addItem({
        kind: "recurring_activity",
        title: nlParsed.title,
        daysOfWeek: sortWeekdays(nlParsed.daysOfWeek),
        startTime: nlParsed.startTime,
        endTime: nlParsed.endTime,
        location: activityLocation.trim() || undefined,
        notes: activityNotes.trim() || undefined,
        enabled: true,
      });
      setNlInput("");
      setNlParsed(null);
      setNlError(null);
      setActivityLocation("");
      setActivityNotes("");
    } finally {
      setSaving(false);
    }
  };

  const toggleManualDay = (day: Weekday) => {
    setManualDays((current) =>
      current.includes(day) ? current.filter((entry) => entry !== day) : [...current, day],
    );
    setManualError(null);
  };

  const saveManualActivity = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!manualTitle.trim()) {
      setManualError("Activity title is required.");
      return;
    }
    if (manualDays.length === 0) {
      setManualError("Choose at least one weekday.");
      return;
    }
    if (!manualStartTime || !manualEndTime) {
      setManualError("Add a start and end time.");
      return;
    }
    if (manualStartTime >= manualEndTime) {
      setManualError("Start time must be before end time.");
      return;
    }

    setManualError(null);
    setSaving(true);
    try {
      await addItem({
        kind: "recurring_activity",
        title: manualTitle.trim(),
        daysOfWeek: sortWeekdays(manualDays),
        startTime: manualStartTime,
        endTime: manualEndTime,
        location: manualLocation.trim() || undefined,
        notes: manualNotes.trim() || undefined,
        enabled: true,
      });
      setManualTitle("");
      setManualDays([]);
      setManualStartTime("");
      setManualEndTime("");
      setManualLocation("");
      setManualNotes("");
    } finally {
      setSaving(false);
    }
  };

  const saveEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!eventTitle.trim()) {
      setEventError("Event title is required.");
      return;
    }
    if (!eventDate) {
      setEventError("Event date is required.");
      return;
    }
    if (!eventAllDay && eventStartTime && eventEndTime && eventStartTime >= eventEndTime) {
      setEventError("Start time must be before end time.");
      return;
    }

    setEventError(null);
    setSaving(true);
    try {
      await addItem({
        kind: "one_off_event",
        title: eventTitle.trim(),
        date: eventDate,
        startTime: eventAllDay ? undefined : eventStartTime || undefined,
        endTime: eventAllDay ? undefined : eventEndTime || undefined,
        location: eventLocation.trim() || undefined,
        notes: eventNotes.trim() || undefined,
        isAllDay: eventAllDay,
        enabled: true,
      });
      setEventTitle("");
      setEventDate("");
      setEventStartTime("");
      setEventEndTime("");
      setEventLocation("");
      setEventNotes("");
      setEventAllDay(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Activities & Events</h1>
            <p className="mt-1 text-sm text-muted">
              Save the recurring things that shape your week and the one-off events the assistant
              should plan around.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">This page</p>
              <p className="mt-1 text-xs text-muted">
                Practices, shifts, appointments, rehearsals, and anything else that takes up time.
              </p>
            </div>
            <Link href="/calendar" className="rounded-2xl border border-border bg-card p-4 transition hover:bg-surface">
              <p className="text-sm font-semibold text-foreground">School calendar</p>
              <p className="mt-1 text-xs text-muted">
                Use Calendar for holidays, no-school days, and special school schedules.
              </p>
            </Link>
            <Link href="/automations" className="rounded-2xl border border-border bg-card p-4 transition hover:bg-surface">
              <p className="text-sm font-semibold text-foreground">Automations</p>
              <p className="mt-1 text-xs text-muted">
                Use Automations if you want reminders or summaries about these commitments.
              </p>
            </Link>
          </div>
        </header>

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Recurring activities</h2>
            <p className="mt-0.5 text-xs text-muted">
              Clubs, sports, work, volunteering, gym, or anything that repeats weekly.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <form onSubmit={handleParseActivity} className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <div>
                <p className="text-sm font-semibold text-foreground">Quick parse</p>
                <p className="mt-1 text-xs text-muted">
                  Type it in plain English and confirm what gets parsed.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={nlInput}
                  onChange={(event) => {
                    setNlInput(event.target.value);
                    setNlError(null);
                    setNlParsed(null);
                  }}
                  placeholder='e.g. "Basketball Tue/Thu 7:30-9"'
                  className="flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:border-sidebar-accent focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!nlInput.trim() || saving}
                  className="rounded-xl bg-sidebar-accent px-4 py-2.5 text-sm font-semibold text-[#0f2117] transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  Parse
                </button>
              </div>

              {nlError ? (
                <p className="rounded-lg bg-accent-rose/10 px-3 py-2 text-xs text-accent-rose-foreground">{nlError}</p>
              ) : null}

              {nlParsed ? (
                <div className="space-y-3 rounded-xl border border-sidebar-accent/30 bg-sidebar-accent/10 px-4 py-3">
                  <div className="text-sm text-foreground">
                    <p><span className="text-muted">Name:</span> {nlParsed.title}</p>
                    <p><span className="text-muted">Days:</span> {formatActivityDays(nlParsed.daysOfWeek)}</p>
                    <p><span className="text-muted">Time:</span> {formatActivityTime(nlParsed.startTime, nlParsed.endTime)}</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      value={activityLocation}
                      onChange={(event) => setActivityLocation(event.target.value)}
                      placeholder="Location (optional)"
                      className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-sidebar-accent focus:outline-none"
                    />
                    <input
                      type="text"
                      value={activityNotes}
                      onChange={(event) => setActivityNotes(event.target.value)}
                      placeholder="Notes (optional)"
                      className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-sidebar-accent focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveParsedActivity()}
                      disabled={saving}
                      className="rounded-lg bg-sidebar-accent px-3 py-1.5 text-xs font-semibold text-[#0f2117] transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      Save activity
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNlParsed(null);
                        setActivityLocation("");
                        setActivityNotes("");
                      }}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {ACTIVITY_EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setNlInput(example);
                      inputRef.current?.focus();
                    }}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[11px] text-muted transition-colors hover:text-foreground"
                  >
                    &ldquo;{example}&rdquo;
                  </button>
                ))}
              </div>
            </form>

            <form onSubmit={saveManualActivity} className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <div>
                <p className="text-sm font-semibold text-foreground">Manual entry</p>
                <p className="mt-1 text-xs text-muted">
                  Use this if you want a straightforward form instead of natural language.
                </p>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Activity title</span>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(event) => {
                    setManualTitle(event.target.value);
                    setManualError(null);
                  }}
                  placeholder="e.g. Robotics club"
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-sidebar-accent focus:outline-none"
                />
              </label>

              <div>
                <span className="mb-2 block text-xs font-medium text-muted">Days</span>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleManualDay(value)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        manualDays.includes(value)
                          ? "border-sidebar-accent/40 bg-sidebar-accent/15 text-foreground"
                          : "border-border bg-surface text-muted hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Start time</span>
                  <input
                    type="time"
                    value={manualStartTime}
                    onChange={(event) => setManualStartTime(event.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-sidebar-accent focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">End time</span>
                  <input
                    type="time"
                    value={manualEndTime}
                    onChange={(event) => setManualEndTime(event.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-sidebar-accent focus:outline-none"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={manualLocation}
                  onChange={(event) => setManualLocation(event.target.value)}
                  placeholder="Location (optional)"
                  className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-sidebar-accent focus:outline-none"
                />
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(event) => setManualNotes(event.target.value)}
                  placeholder="Notes (optional)"
                  className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-sidebar-accent focus:outline-none"
                />
              </div>

              {manualError ? (
                <p className="rounded-lg bg-accent-rose/10 px-3 py-2 text-xs text-accent-rose-foreground">{manualError}</p>
              ) : null}

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-sidebar-accent px-4 py-2 text-sm font-semibold text-[#0f2117] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Save activity
              </button>
            </form>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted">
              Loading activities...
            </div>
          ) : recurringActivities.length > 0 ? (
            <div className="space-y-2">
              {recurringActivities.map((item) => (
                <PlanningCard
                  key={item.id}
                  item={item}
                  subtitle={`${formatActivityDays(item.daysOfWeek ?? [])} · ${formatActivityTime(
                    item.startTime ?? "00:00",
                    item.endTime ?? "00:00",
                  )}`}
                  onDelete={() => void removeItem(item.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No recurring activities yet</p>
              <p className="mt-1 text-xs text-muted">Use the form above to add sports, clubs, or anything else that repeats weekly.</p>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">One-off events</h2>
            <p className="mt-0.5 text-xs text-muted">
              Appointments, games, rehearsals, meetings, family plans, or any dated commitment.
            </p>
          </div>

          <form onSubmit={saveEvent} className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Event title</span>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(event) => setEventTitle(event.target.value)}
                  placeholder="e.g. Dentist appointment"
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-sidebar-accent focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Date</span>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(event) => setEventDate(event.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-sidebar-accent focus:outline-none"
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={eventAllDay}
                onChange={(event) => setEventAllDay(event.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              All-day event
            </label>

            {!eventAllDay ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Start time</span>
                  <input
                    type="time"
                    value={eventStartTime}
                    onChange={(event) => setEventStartTime(event.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-sidebar-accent focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">End time</span>
                  <input
                    type="time"
                    value={eventEndTime}
                    onChange={(event) => setEventEndTime(event.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-sidebar-accent focus:outline-none"
                  />
                </label>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="text"
                value={eventLocation}
                onChange={(event) => setEventLocation(event.target.value)}
                placeholder="Location (optional)"
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-sidebar-accent focus:outline-none"
              />
              <input
                type="text"
                value={eventNotes}
                onChange={(event) => setEventNotes(event.target.value)}
                placeholder="Notes (optional)"
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-sidebar-accent focus:outline-none"
              />
            </div>

            {eventError ? (
              <p className="rounded-lg bg-accent-rose/10 px-3 py-2 text-xs text-accent-rose-foreground">{eventError}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-sidebar-accent px-4 py-2 text-sm font-semibold text-[#0f2117] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Save event
              </button>
              {EVENT_EXAMPLES.map((example) => (
                <button
                  key={example.title}
                  type="button"
                  onClick={() => {
                    setEventTitle(example.title);
                    setEventDate("");
                    setEventStartTime(example.startTime);
                    setEventEndTime(example.endTime);
                    setEventAllDay(!example.startTime);
                  }}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[11px] text-muted transition-colors hover:text-foreground"
                >
                  {example.title}
                </button>
              ))}
            </div>
          </form>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted">
              Loading events...
            </div>
          ) : oneOffEvents.length > 0 ? (
            <div className="space-y-2">
              {oneOffEvents.map((item) => (
                <PlanningCard
                  key={item.id}
                  item={item}
                  subtitle={formatEventSubtitle(item)}
                  onDelete={() => void removeItem(item.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No events yet</p>
              <p className="mt-1 text-xs text-muted">Add appointments, games, or any dated commitment above.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
