"use client";

import { useEffect, useState } from "react";
import { useTheme } from "../../lib/theme-context";
import { ACCENT_META } from "../../lib/theme-context";
import type { ThemeMode, AccentColor } from "../../lib/theme-context";
import { useReminderStore } from "../../lib/reminder-store";
import { loadProfile, saveProfile } from "../../lib/profile";
import type { StudentProfile, AssistantTone } from "../../lib/profile";
import { useClasses } from "../../lib/stores/classStore";
import { ScheduleSetupInput } from "../../components/ScheduleSetupInput";
import { ScheduleCard } from "../../components/ScheduleCard";
import { detectApCourse } from "../../lib/ap-detection";
import type { ClassMeetingTime, SchoolClass, Weekday } from "../../types";

// ── Tab system ────────────────────────────────────────────────────────────────

type Tab = "appearance" | "notifications" | "profile" | "schedule";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "appearance",    label: "Appearance",    icon: "◑" },
  { id: "notifications", label: "Notifications", icon: "◎" },
  { id: "profile",       label: "Profile",       icon: "◉" },
  { id: "schedule",      label: "Schedule",      icon: "◷" },
];

// ── Schedule tab constants ─────────────────────────────────────────────────────

const COLOR_SWATCHES: { label: string; value: string }[] = [
  { label: "Green",    value: "#d4edd9" },
  { label: "Blue",     value: "#d4e6f7" },
  { label: "Amber",    value: "#fdefd3" },
  { label: "Rose",     value: "#fde0e0" },
  { label: "Lavender", value: "#ebe0fd" },
  { label: "Slate",    value: "#dde3e8" },
];

const WEEKDAYS: { label: string; value: Weekday }[] = [
  { label: "Mon", value: "monday" },
  { label: "Tue", value: "tuesday" },
  { label: "Wed", value: "wednesday" },
  { label: "Thu", value: "thursday" },
  { label: "Fri", value: "friday" },
  { label: "Sat", value: "saturday" },
  { label: "Sun", value: "sunday" },
];

type ScheduleLabel = "A" | "B" | "";
type DayTime = { start: string; end: string };

// ── Mode picker card ──────────────────────────────────────────────────────────

function ModeCard({
  id,
  label,
  description,
  icon,
  selected,
  onClick,
}: {
  id: ThemeMode;
  label: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center gap-3 rounded-2xl border-2 p-5 text-center transition-all ${
        selected
          ? "border-sidebar-accent bg-sidebar-accent/10 shadow-card-md"
          : "border-border bg-card hover:border-border hover:bg-surface"
      }`}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-sidebar-accent text-[9px] font-bold text-[#0f2117]">
          ✓
        </span>
      )}
      <div
        className={`flex h-12 w-full items-center justify-center rounded-xl text-2xl transition-colors ${
          selected ? "bg-sidebar-accent/20" : "bg-surface"
        }`}
      >
        {icon}
      </div>
      <div>
        <p className={`text-sm font-semibold ${selected ? "text-foreground" : "text-foreground"}`}>
          {label}
        </p>
        <p className="mt-0.5 text-[11px] text-muted">{description}</p>
      </div>
    </button>
  );
}

// ── Accent swatch ─────────────────────────────────────────────────────────────

function AccentSwatch({
  accent,
  hex,
  label,
  selected,
  onClick,
}: {
  accent: AccentColor;
  hex: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2"
      title={label}
    >
      <span
        className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-all ${
          selected ? "ring-2 ring-offset-2 ring-offset-card scale-110" : "hover:scale-105"
        }`}
        style={
          {
            backgroundColor: hex,
            "--tw-ring-color": selected ? hex : undefined,
          } as React.CSSProperties
        }
      >
        {selected && (
          <svg className="h-4 w-4 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span className={`text-[11px] font-medium ${selected ? "text-foreground" : "text-muted"}`}>
        {label}
      </span>
    </button>
  );
}

// ── Toggle row (reusable) ─────────────────────────────────────────────────────

function ToggleRow({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3.5 text-left transition hover:bg-surface"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{description}</span>
      </span>
      {/* Toggle switch */}
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          enabled ? "bg-sidebar-accent" : "bg-border"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </span>
    </button>
  );
}

// ── Appearance tab ────────────────────────────────────────────────────────────

function AppearanceTab() {
  const { mode, accent, setMode, setAccent } = useTheme();

  const modes: {
    id: ThemeMode;
    label: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "light",
      label: "Light",
      description: "Clean and bright",
      icon: (
        <svg className="h-6 w-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" strokeWidth={2} />
          <path strokeLinecap="round" strokeWidth={2} d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ),
    },
    {
      id: "dark",
      label: "Dark",
      description: "Easy on the eyes",
      icon: (
        <svg className="h-6 w-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      ),
    },
    {
      id: "system",
      label: "System",
      description: "Follows your device",
      icon: (
        <svg className="h-6 w-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth={2} />
          <path strokeLinecap="round" strokeWidth={2} d="M8 21h8M12 17v4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-10">
      {/* Mode picker */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">Appearance mode</h2>
          <p className="mt-1 text-sm text-muted">Choose how the app looks to you.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {modes.map((m) => (
            <ModeCard
              key={m.id}
              id={m.id}
              label={m.label}
              description={m.description}
              icon={m.icon}
              selected={mode === m.id}
              onClick={() => setMode(m.id)}
            />
          ))}
        </div>
      </section>

      {/* Accent color */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">Accent color</h2>
          <p className="mt-1 text-sm text-muted">
            Changes the navigation highlight and interactive accents.
          </p>
        </div>
        <div className="flex flex-wrap gap-6">
          {(Object.entries(ACCENT_META) as [AccentColor, typeof ACCENT_META[AccentColor]][]).map(
            ([key, meta]) => (
              <AccentSwatch
                key={key}
                accent={key}
                hex={meta.hex}
                label={meta.label}
                selected={accent === key}
                onClick={() => setAccent(key)}
              />
            )
          )}
        </div>

        {/* Live preview strip */}
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div
            className="h-8 w-8 shrink-0 rounded-full shadow-sm"
            style={{ backgroundColor: ACCENT_META[accent].hex }}
          />
          <div>
            <p className="text-sm font-medium text-foreground">
              {ACCENT_META[accent].label} theme active
            </p>
            <p className="text-xs text-muted">
              Navigation highlight and interactive elements use this accent.
            </p>
          </div>
        </div>
      </section>

      {/* About this section */}
      <section className="rounded-2xl border border-dashed border-border bg-surface/50 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">About</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your appearance preferences are saved to this browser. They&apos;ll be remembered
          across sessions. Sign-in sync and additional themes are coming in a future update.
        </p>
      </section>
    </div>
  );
}

// ── Notifications tab ─────────────────────────────────────────────────────────

function NotificationsTab() {
  const { preferences, updatePreferences } = useReminderStore();

  const toggle = (key: "dailySummaryEnabled" | "tonightSummaryEnabled" | "dueSoonRemindersEnabled") => {
    updatePreferences({ [key]: !preferences[key] });
  };

  return (
    <div className="space-y-8">
      {/* Summaries group */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">Summaries</h2>
          <p className="mt-1 text-sm text-muted">
            Get a daily or nightly overview of your work and upcoming classes.
          </p>
        </div>
        <div className="space-y-2">
          <ToggleRow
            title="Daily summary"
            description={
              preferences.dailySummaryEnabled
                ? `Enabled at ${preferences.dailySummaryTime ?? "a saved time"}`
                : "Off — toggle to enable a morning overview"
            }
            enabled={preferences.dailySummaryEnabled}
            onToggle={() => toggle("dailySummaryEnabled")}
          />
          <ToggleRow
            title="Tonight summary"
            description={
              preferences.tonightSummaryEnabled
                ? `Enabled at ${preferences.tonightSummaryTime ?? "a saved time"}`
                : "Off — toggle to enable an evening recap"
            }
            enabled={preferences.tonightSummaryEnabled}
            onToggle={() => toggle("tonightSummaryEnabled")}
          />
        </div>
      </section>

      {/* Reminders group */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">Due date reminders</h2>
          <p className="mt-1 text-sm text-muted">
            Get alerted before assignments and tests are due.
          </p>
        </div>
        <div className="space-y-2">
          <ToggleRow
            title="Due soon reminders"
            description={
              preferences.dueSoonRemindersEnabled
                ? `${preferences.dueSoonHoursBefore ?? 0} hours before due dates`
                : "Off — toggle to get reminded before deadlines"
            }
            enabled={preferences.dueSoonRemindersEnabled}
            onToggle={() => toggle("dueSoonRemindersEnabled")}
          />
        </div>
      </section>

      {/* Delivery note */}
      <section className="rounded-2xl border border-dashed border-border bg-surface/50 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">Delivery</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Reminders are delivered in-app. Email and push notification support is coming soon.
          You can also ask the assistant to create custom automations from the{" "}
          <a href="/automations" className="font-medium text-accent-green-foreground underline underline-offset-2">
            Automations
          </a>{" "}
          page.
        </p>
      </section>
    </div>
  );
}

// ── Profile tab ───────────────────────────────────────────────────────────────

const TONE_OPTIONS: { value: AssistantTone; label: string; description: string }[] = [
  { value: "balanced", label: "Balanced", description: "Calm and supportive" },
  { value: "chill",    label: "Chill",    description: "Relaxed and casual" },
  { value: "focused",  label: "Focused",  description: "Direct and efficient" },
];

function ProfileTab() {
  const [profile, setProfile] = useState<StudentProfile>(() => loadProfile());
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<StudentProfile>) => {
    setProfile((p) => ({ ...p, ...patch }));
    setSaved(false);
  };

  const handleSave = () => {
    saveProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Basic info */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">About you</h2>
          <p className="mt-1 text-sm text-muted">
            Help the assistant know a bit about you. All fields are optional.
          </p>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="displayName">
              Display name
            </label>
            <input
              id="displayName"
              type="text"
              value={profile.displayName ?? ""}
              onChange={(e) => update({ displayName: e.target.value || undefined })}
              placeholder="e.g. Connor"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted/50"
            />
          </div>

          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="gradeLevel">
              Grade level
            </label>
            <input
              id="gradeLevel"
              type="text"
              value={profile.gradeLevel ?? ""}
              onChange={(e) => update({ gradeLevel: e.target.value || undefined })}
              placeholder="e.g. 11th, Junior, Sophomore"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted/50"
            />
          </div>

          <div className="rounded-xl border border-border bg-background px-4 py-3.5">
            <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="goals">
              Goals
            </label>
            <textarea
              id="goals"
              value={profile.goals ?? ""}
              onChange={(e) => update({ goals: e.target.value || undefined })}
              placeholder="e.g. Raise my GPA, get better at math, stay on top of deadlines"
              rows={3}
              className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted/50"
            />
          </div>
        </div>
      </section>

      {/* Tone picker */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">Assistant tone</h2>
          <p className="mt-1 text-sm text-muted">Choose how the assistant communicates with you.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {TONE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ assistantTone: opt.value })}
              className={`relative flex flex-col gap-1.5 rounded-2xl border-2 p-4 text-left transition-all ${
                profile.assistantTone === opt.value
                  ? "border-sidebar-accent bg-sidebar-accent/10 shadow-card-md"
                  : "border-border bg-card hover:bg-surface"
              }`}
            >
              {profile.assistantTone === opt.value && (
                <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-sidebar-accent text-[9px] font-bold text-[#0f2117]">
                  ✓
                </span>
              )}
              <span className="text-sm font-semibold text-foreground">{opt.label}</span>
              <span className="text-[11px] text-muted">{opt.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-xl bg-hero px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-hero-mid"
        >
          {saved ? "Saved ✓" : "Save profile"}
        </button>
        <p className="text-xs text-muted">Stored locally in your browser.</p>
      </div>
    </div>
  );
}

// ── Schedule tab ──────────────────────────────────────────────────────────────

function ScheduleTab() {
  const { classes, loading, addClass, addClasses, updateClass, deleteClass } = useClasses();

  const [setupVisible, setSetupVisible] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [days, setDays] = useState<Weekday[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [usePerDayTimes, setUsePerDayTimes] = useState(false);
  const [dayTimes, setDayTimes] = useState<Partial<Record<Weekday, DayTime>>>({});
  const [room, setRoom] = useState("");
  const [notes, setNotes] = useState("");
  const [syllabusText, setSyllabusText] = useState("");
  const [classNotes, setClassNotes] = useState("");
  const [color, setColor] = useState(COLOR_SWATCHES[0].value);
  const [scheduleLabel, setScheduleLabel] = useState<ScheduleLabel>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40";

  const toggleDay = (day: Weekday) => {
    setDays((prev) => {
      if (prev.includes(day)) {
        setDayTimes((dt) => {
          const next = { ...dt };
          delete next[day];
          return next;
        });
        return prev.filter((d) => d !== day);
      }
      setDayTimes((dt) => ({
        ...dt,
        [day]: { start: startTime || "08:00", end: endTime || "09:00" },
      }));
      return [...prev, day];
    });
  };

  const updateDayTime = (day: Weekday, field: "start" | "end", value: string) => {
    setDayTimes((dt) => ({ ...dt, [day]: { ...dt[day], [field]: value } as DayTime }));
  };

  const resetForm = () => {
    setName("");
    setTeacherName("");
    setTeacherEmail("");
    setDays([]);
    setStartTime("");
    setEndTime("");
    setUsePerDayTimes(false);
    setDayTimes({});
    setRoom("");
    setNotes("");
    setSyllabusText("");
    setClassNotes("");
    setColor(COLOR_SWATCHES[0].value);
    setScheduleLabel("");
    setValidationError(null);
    setMutationError(null);
    setEditingClassId(null);
  };

  const loadClassIntoForm = (cls: SchoolClass) => {
    setName(cls.name);
    setTeacherName(cls.teacherName ?? "");
    setTeacherEmail(cls.teacherEmail ?? "");
    setRoom(cls.room ?? "");
    setNotes(cls.notes ?? "");
    setSyllabusText(cls.syllabusText ?? "");
    setClassNotes(cls.classNotes ?? "");
    setColor(cls.color ?? COLOR_SWATCHES[0].value);
    setScheduleLabel((cls.scheduleLabel as ScheduleLabel) ?? "");
    if (cls.meetings && cls.meetings.length > 0) {
      setDays(cls.meetings.map((m) => m.day));
      setUsePerDayTimes(true);
      const dt: Partial<Record<Weekday, DayTime>> = {};
      cls.meetings.forEach((m) => {
        dt[m.day] = { start: m.startTime, end: m.endTime };
      });
      setDayTimes(dt);
      setStartTime(cls.startTime ?? "");
      setEndTime(cls.endTime ?? "");
    } else {
      setDays(cls.days ?? []);
      setStartTime(cls.startTime ?? "");
      setEndTime(cls.endTime ?? "");
      setUsePerDayTimes(false);
      setDayTimes({});
    }
    setValidationError(null);
    setMutationError(null);
    setEditingClassId(cls.id);
    setFormOpen(true);
    setSetupVisible(false);
  };

  const handleManualSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      setValidationError("Class name is required.");
      return;
    }

    if (!usePerDayTimes && startTime && endTime && startTime >= endTime) {
      setValidationError("Start time must be before end time.");
      return;
    }

    setValidationError(null);
    setMutationError(null);

    let meetings: ClassMeetingTime[] | undefined;
    let canonicalStart = startTime;
    let canonicalEnd = endTime;

    if (usePerDayTimes && days.length > 0) {
      meetings = days.map((day) => ({
        day,
        startTime: dayTimes[day]?.start ?? startTime ?? "08:00",
        endTime: dayTimes[day]?.end ?? endTime ?? "09:00",
      }));
      canonicalStart = meetings[0]?.startTime ?? startTime;
      canonicalEnd = meetings[0]?.endTime ?? endTime;
    }

    try {
      const apInfo = detectApCourse(name.trim());
      const classData = {
        name: name.trim(),
        teacherName: teacherName.trim() || undefined,
        teacherEmail: teacherEmail.trim() || undefined,
        days,
        startTime: canonicalStart,
        endTime: canonicalEnd,
        meetings,
        room: room.trim() || undefined,
        notes: notes.trim() || undefined,
        syllabusText: syllabusText.trim() || undefined,
        classNotes: classNotes.trim() || undefined,
        color,
        scheduleLabel: scheduleLabel || undefined,
        isApCourse: apInfo.isApCourse || undefined,
        apCourseKey: apInfo.apCourseKey ?? undefined,
      };

      if (editingClassId) {
        await updateClass(editingClassId, classData);
      } else {
        await addClass(classData);
      }

      resetForm();
      setFormOpen(false);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Failed to save class.");
    }
  };

  const handleSchedulesConfirmed = async (newClasses: Array<Omit<SchoolClass, "id">>) => {
    await addClasses(newClasses);
    setSetupVisible(false);
  };

  const hasClasses = classes.length > 0;

  return (
    <div className="space-y-8">
      {/* AI setup section */}
      {!setupVisible && !formOpen && (
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">Build from description</h2>
            <p className="mt-1 text-sm text-muted">
              Describe your schedule in plain English and the assistant will set it up for you.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSetupVisible(true)}
            className="rounded-full bg-accent-green-foreground px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            + Build from description
          </button>
        </section>
      )}

      {setupVisible && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div>
            <p className="text-base font-semibold text-foreground">Describe your full schedule</p>
            <p className="mt-1 text-sm text-muted">
              Paste or type your classes in plain English — include times, days, and A/B rotation if your school uses it.
            </p>
          </div>
          <ScheduleSetupInput
            existingClasses={classes}
            onConfirmed={handleSchedulesConfirmed}
            onCancel={() => setSetupVisible(false)}
          />
        </section>
      )}

      {/* Existing classes */}
      {!loading && hasClasses && !formOpen && (
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Your classes</h2>
              <p className="mt-1 text-sm text-muted">
                {classes.length} {classes.length === 1 ? "class" : "classes"} saved
              </p>
            </div>
            {!setupVisible && (
              <button
                type="button"
                onClick={() => { resetForm(); setFormOpen(true); }}
                className="shrink-0 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition hover:bg-surface hover:text-foreground"
              >
                Add class manually
              </button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {classes.map((cls) => (
              <ScheduleCard
                key={cls.id}
                schoolClass={cls}
                onEdit={() => loadClassIntoForm(cls)}
                onDelete={() => void deleteClass(cls.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state — no classes */}
      {!loading && !hasClasses && !setupVisible && !formOpen && (
        <section className="rounded-2xl border border-dashed border-border bg-surface/50 p-5">
          <p className="text-sm text-muted">
            No classes yet. Use &ldquo;Build from description&rdquo; above, or add them one at a time.
          </p>
          <button
            type="button"
            onClick={() => { resetForm(); setFormOpen(true); }}
            className="mt-3 text-sm font-medium text-accent-green-foreground transition hover:underline"
          >
            Add class manually
          </button>
        </section>
      )}

      {/* Manual add/edit form */}
      {formOpen && (
        <section className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {editingClassId ? "Edit class" : "Add a single class"}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              Fill in what you know — everything except the class name is optional.
            </p>
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">
                Class name <span className="text-accent-rose-foreground">*</span>
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AP Chemistry"
                className={inputClass}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground">
                  Teacher <span className="text-xs font-normal text-muted">(optional)</span>
                </span>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="e.g. Mr. Alvarez"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground">
                  Teacher email <span className="text-xs font-normal text-muted">(optional)</span>
                </span>
                <input
                  type="email"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  placeholder="e.g. alvarez@school.edu"
                  className={inputClass}
                />
              </label>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-foreground">
                Meeting days <span className="text-xs font-normal text-muted">(optional)</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map(({ label, value }) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                      days.includes(value)
                        ? "border-accent-green-foreground bg-accent-green font-medium text-accent-green-foreground"
                        : "border-border bg-card text-muted hover:bg-surface"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={days.includes(value)}
                      onChange={() => toggleDay(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            {days.length > 0 && (
              <div className="space-y-4">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={usePerDayTimes}
                    onChange={(e) => setUsePerDayTimes(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-accent-green-foreground"
                  />
                  <span className="text-sm text-foreground">
                    Different times on different days
                    <span className="ml-1.5 text-xs text-muted">(e.g. lecture vs. lab)</span>
                  </span>
                </label>

                {!usePerDayTimes && (
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-foreground">Start time</span>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-foreground">End time</span>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className={inputClass}
                      />
                    </label>
                  </div>
                )}

                {usePerDayTimes && (
                  <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Times per day</p>
                    {days.map((day) => {
                      const dayLabel = WEEKDAYS.find((w) => w.value === day)?.label ?? day;
                      return (
                        <div key={day} className="flex items-center gap-3">
                          <span className="w-9 shrink-0 text-sm font-medium text-foreground">{dayLabel}</span>
                          <input
                            type="time"
                            value={dayTimes[day]?.start ?? ""}
                            onChange={(e) => updateDayTime(day, "start", e.target.value)}
                            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40"
                          />
                          <span className="text-sm text-muted">-</span>
                          <input
                            type="time"
                            value={dayTimes[day]?.end ?? ""}
                            onChange={(e) => updateDayTime(day, "end", e.target.value)}
                            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">
                Room <span className="text-xs font-normal text-muted">(optional)</span>
              </span>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g. Room 204"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">
                Notes <span className="text-xs font-normal text-muted">(optional)</span>
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Grading policy, syllabus notes, office hours…"
                rows={2}
                className="w-full resize-none rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40"
              />
            </label>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-foreground">Color</legend>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.value}
                    type="button"
                    title={swatch.label}
                    onClick={() => setColor(swatch.value)}
                    style={{ backgroundColor: swatch.value }}
                    className={`h-8 w-8 rounded-full border-2 transition ${
                      color === swatch.value
                        ? "scale-110 border-foreground"
                        : "border-transparent hover:border-muted"
                    }`}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-foreground">
                Rotating schedule <span className="text-xs font-normal text-muted">(optional)</span>
              </legend>
              <p className="mb-2.5 text-xs text-muted">
                If your school uses A/B day rotation, label this class so the assistant knows which rotation it belongs to.
              </p>
              <div className="flex flex-wrap gap-2">
                {(["", "A", "B"] as ScheduleLabel[]).map((label) => (
                  <label
                    key={label === "" ? "none" : label}
                    className={`flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                      scheduleLabel === label
                        ? label === "A"
                          ? "border-accent-blue-foreground bg-accent-blue font-medium text-accent-blue-foreground"
                          : label === "B"
                            ? "border-accent-purple-foreground bg-accent-purple font-medium text-accent-purple-foreground"
                            : "border-accent-green-foreground bg-accent-green font-medium text-accent-green-foreground"
                        : "border-border bg-card text-muted hover:bg-surface"
                    }`}
                  >
                    <input
                      type="radio"
                      name="scheduleLabel"
                      className="sr-only"
                      checked={scheduleLabel === label}
                      onChange={() => setScheduleLabel(label)}
                    />
                    {label === "" ? "No rotation" : `${label}-Day`}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* ── Class knowledge ────────────────────────────────────────── */}
            <div className="space-y-3 rounded-xl border border-border bg-surface/50 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Class knowledge</p>
                <p className="mt-0.5 text-xs text-muted">
                  Helps the assistant give smarter, class-specific answers. Both fields are optional.
                </p>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">Syllabus / course overview</span>
                <textarea
                  value={syllabusText}
                  onChange={(e) => setSyllabusText(e.target.value)}
                  placeholder="Paste key parts of your syllabus — topics covered, grading breakdown, important policies…"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">Your notes about this class</span>
                <textarea
                  value={classNotes}
                  onChange={(e) => setClassNotes(e.target.value)}
                  placeholder="Anything the assistant should know — how it's graded, what's hardest, study tips…"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40"
                />
              </label>

              {/* ── File attachments (coming soon) ─────────────────────── */}
              <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border px-4 py-3">
                <svg className="h-4 w-4 shrink-0 text-muted/60" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
                <p className="text-xs text-muted/70">
                  File attachments (PDFs, handouts) —{" "}
                  <span className="font-medium text-muted">coming soon</span>
                </p>
              </div>
            </div>

            {validationError && (
              <p className="rounded-xl border border-accent-rose bg-accent-rose px-4 py-2.5 text-sm text-accent-rose-foreground">
                {validationError}
              </p>
            )}

            {mutationError && (
              <p className="rounded-xl border border-accent-rose bg-accent-rose px-4 py-2.5 text-sm text-accent-rose-foreground">
                {mutationError}
              </p>
            )}

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="submit"
                className="rounded-full bg-accent-green-foreground px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
              >
                {editingClassId ? "Save Changes" : "Add Class"}
              </button>
              <button
                type="button"
                onClick={() => { resetForm(); setFormOpen(false); }}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("appearance");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as Tab | null;
    if (tab && TABS.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="border-b border-border bg-card px-6 py-8 md:px-10">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[15px] leading-none opacity-70">⚙</span>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Settings</p>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Preferences
          </h1>
          <p className="mt-1.5 text-sm text-muted leading-relaxed">
            Customize how the app looks and behaves for you.
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border bg-card px-6 md:px-10">
        <div className="mx-auto max-w-2xl">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex shrink-0 items-center gap-2 px-1 py-3.5 mr-6 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <span className="text-base leading-none opacity-70">{tab.icon}</span>
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-sidebar-accent" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-2xl px-6 py-8 md:px-10">
        {activeTab === "appearance"    && <AppearanceTab />}
        {activeTab === "notifications" && <NotificationsTab />}
        {activeTab === "profile"       && <ProfileTab />}
        {activeTab === "schedule"      && <ScheduleTab />}
      </div>
    </div>
  );
}
