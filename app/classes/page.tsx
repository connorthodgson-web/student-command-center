"use client";

import { useEffect, useRef, useState } from "react";
import { ScheduleCard } from "../../components/ScheduleCard";
import { ScheduleSetupInput } from "../../components/ScheduleSetupInput";
import { SectionHeader } from "../../components/SectionHeader";
import { useClasses } from "../../lib/stores/classStore";
import { formatTimeRange } from "../../lib/schedule";
import { detectApCourse } from "../../lib/ap-detection";
import { getApTemplate } from "../../lib/ap-course-templates";
import type { ClassMeetingTime, SchoolClass, Weekday } from "../../types";

type ClassesView = "cards" | "schedule";

type ScheduleLabel = "A" | "B" | "";

const COLOR_SWATCHES: { label: string; value: string }[] = [
  { label: "Green", value: "#d4edd9" },
  { label: "Blue", value: "#d4e6f7" },
  { label: "Amber", value: "#fdefd3" },
  { label: "Rose", value: "#fde0e0" },
  { label: "Lavender", value: "#ebe0fd" },
  { label: "Slate", value: "#dde3e8" },
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

type DayTime = { start: string; end: string };

export default function ClassesPage() {
  const { classes, loading, addClass, addClasses, updateClass, deleteClass } = useClasses();

  const [view, setView] = useState<ClassesView>("schedule");
  const [setupVisible, setSetupVisible] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const hasInitializedSetup = useRef(false);

  // Class Knowledge modal
  const [knowledgeClass, setKnowledgeClass] = useState<SchoolClass | null>(null);

  // Editing state — when set, the manual form saves an update instead of a new class
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
  const [color, setColor] = useState(COLOR_SWATCHES[0].value);
  const [scheduleLabel, setScheduleLabel] = useState<ScheduleLabel>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || hasInitializedSetup.current) return;
    setSetupVisible(classes.length === 0);
    hasInitializedSetup.current = true;
  }, [loading, classes.length]);

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

  const handleManualCancel = () => {
    resetForm();
    setFormOpen(false);
  };

  const handleSchedulesConfirmed = async (
    newClasses: Array<Omit<SchoolClass, "id">>
  ) => {
    await addClasses(newClasses);
    setSetupVisible(false);
  };

  const inputClass =
    "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40";

  const hasClasses = classes.length > 0;
  const showActionBar = !loading && !setupVisible && !formOpen;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <SectionHeader
        title="Classes"
        description="Describe your schedule in plain English and the assistant will set it up for you."
      />

      {loading && (
        <div className="rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted shadow-sm">
          Loading your classes...
        </div>
      )}

      {!loading && setupVisible && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div>
            <p className="text-base font-semibold text-foreground">
              Describe your full schedule
            </p>
            <p className="mt-1 text-sm text-muted">
              Paste or type your classes in plain English - include times, days, and A/B rotation if your school uses it.
              The assistant will parse everything and let you review before saving.
            </p>
          </div>

          <ScheduleSetupInput
            existingClasses={classes}
            onConfirmed={handleSchedulesConfirmed}
            onCancel={hasClasses ? () => setSetupVisible(false) : undefined}
          />
        </section>
      )}

      {showActionBar && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setSetupVisible(true)}
              className="rounded-full bg-accent-green-foreground px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              + Build from description
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition hover:bg-surface hover:text-foreground"
            >
              Add single class manually
            </button>
          </div>
          {hasClasses && (
            <div className="flex rounded-full border border-border bg-card p-0.5">
              {(["schedule", "cards"] as ClassesView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    view === v
                      ? "bg-foreground text-white"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {v === "schedule" ? "Schedule" : "Cards"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && formOpen && (
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
                )}

                {usePerDayTimes && (
                  <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      Times per day
                    </p>
                    {days.map((day) => {
                      const dayLabel = WEEKDAYS.find((w) => w.value === day)?.label ?? day;
                      return (
                        <div key={day} className="flex items-center gap-3">
                          <span className="w-9 shrink-0 text-sm font-medium text-foreground">
                            {dayLabel}
                          </span>
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
                onClick={handleManualCancel}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {!loading && hasClasses && view === "cards" && (
        <div className="grid gap-4 md:grid-cols-2">
          {classes.map((schoolClass) => (
            <ScheduleCard
              key={schoolClass.id}
              schoolClass={schoolClass}
              onEdit={() => loadClassIntoForm(schoolClass)}
              onDelete={() => void deleteClass(schoolClass.id)}
              onKnowledge={() => setKnowledgeClass(schoolClass)}
            />
          ))}
        </div>
      )}

      {!loading && hasClasses && view === "schedule" && (
        <DayTypeScheduleView classes={classes} onKnowledge={setKnowledgeClass} />
      )}

      {!loading && !hasClasses && !setupVisible && (
        <div className="space-y-4 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted">
            No classes yet. Describe your schedule above and the assistant will set it all up for you.
          </p>
          <button
            type="button"
            onClick={() => setSetupVisible(true)}
            className="rounded-full bg-accent-green-foreground px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Describe my schedule
          </button>
        </div>
      )}

      {knowledgeClass && (
        <ClassKnowledgeModal
          schoolClass={knowledgeClass}
          onSave={async (updates) => {
            await updateClass(knowledgeClass.id, updates);
            setKnowledgeClass(null);
          }}
          onClose={() => setKnowledgeClass(null)}
        />
      )}
    </main>
  );
}

// ─── Timeline helpers ─────────────────────────────────────────────────────────

function parseTimeMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  return (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0);
}

function getClassDisplayTime(
  cls: SchoolClass
): { startMin: number; endMin: number } | null {
  if (cls.startTime && cls.endTime) {
    return {
      startMin: parseTimeMinutes(cls.startTime),
      endMin: parseTimeMinutes(cls.endTime),
    };
  }
  if (cls.meetings && cls.meetings.length > 0) {
    const first = cls.meetings[0];
    return {
      startMin: parseTimeMinutes(first.startTime),
      endMin: parseTimeMinutes(first.endTime),
    };
  }
  return null;
}

function hourLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}${suffix}`;
}

const PX_PER_MIN = 1.2; // 72px per hour — readable without being too tall
const TOP_PAD = 20; // px above first hour line

// ─── Schedule timeline ────────────────────────────────────────────────────────

function ScheduleTimeline({
  classes,
  onKnowledge,
}: {
  classes: SchoolClass[];
  onKnowledge?: (cls: SchoolClass) => void;
}) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  type TimedEntry = { cls: SchoolClass; time: { startMin: number; endMin: number } };

  const timedEntries: TimedEntry[] = classes
    .map((cls) => {
      const time = getClassDisplayTime(cls);
      return time ? { cls, time } : null;
    })
    .filter((e): e is TimedEntry => e !== null)
    .sort((a, b) => a.time.startMin - b.time.startMin);

  const untimedClasses = classes.filter((cls) => !getClassDisplayTime(cls));

  if (timedEntries.length === 0) {
    return (
      <div className="divide-y divide-border/50 px-5">
        {untimedClasses.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No classes yet.</p>
        ) : (
          untimedClasses.map((cls) => (
            <UntimedClassRow key={cls.id} cls={cls} onKnowledge={onKnowledge} />
          ))
        )}
      </div>
    );
  }

  const allMins = timedEntries.flatMap((e) => [e.time.startMin, e.time.endMin]);
  const dayStartMin = Math.floor(Math.min(...allMins) / 60) * 60;
  const dayEndMin = Math.ceil(Math.max(...allMins) / 60) * 60;
  const totalMinutes = dayEndMin - dayStartMin;
  const containerHeight = totalMinutes * PX_PER_MIN + TOP_PAD + 28;

  const hourMarkers: number[] = [];
  for (let m = dayStartMin; m <= dayEndMin; m += 60) {
    hourMarkers.push(m);
  }
  const nowInRange = nowMinutes >= dayStartMin && nowMinutes <= dayEndMin;

  return (
    <div className="px-5 py-4">
      <div className="flex">
        {/* Time axis */}
        <div className="relative w-12 shrink-0 select-none" style={{ height: containerHeight }}>
          {hourMarkers.map((min) => (
            <div
              key={min}
              className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted"
              style={{ top: (min - dayStartMin) * PX_PER_MIN + TOP_PAD }}
            >
              {hourLabel(min)}
            </div>
          ))}
        </div>

        {/* Grid + blocks */}
        <div className="relative flex-1" style={{ height: containerHeight }}>
          {/* Hour grid lines */}
          {hourMarkers.map((min) => (
            <div
              key={min}
              className="absolute inset-x-0 border-t border-border/40"
              style={{ top: (min - dayStartMin) * PX_PER_MIN + TOP_PAD }}
            />
          ))}

          {/* "Now" indicator line */}
          {nowInRange && (
            <div
              className="absolute inset-x-0 z-10 flex items-center"
              style={{ top: (nowMinutes - dayStartMin) * PX_PER_MIN + TOP_PAD }}
            >
              <div className="h-2 w-2 shrink-0 -ml-1 rounded-full bg-accent-green-foreground" />
              <div className="flex-1 border-t-2 border-accent-green-foreground/50" />
            </div>
          )}

          {/* Class blocks */}
          {timedEntries.map(({ cls, time }) => {
            const top = (time.startMin - dayStartMin) * PX_PER_MIN + TOP_PAD;
            const rawHeight = (time.endMin - time.startMin) * PX_PER_MIN;
            const height = Math.max(rawHeight - 4, 28);
            const duration = time.endMin - time.startMin;
            const dotColor = cls.color ?? "#d4edd9";

            const startStr =
              cls.startTime || (cls.meetings?.[0]?.startTime ?? "");
            const endStr = cls.endTime || (cls.meetings?.[0]?.endTime ?? "");

            return (
              <div
                key={cls.id}
                className="group absolute left-0 right-0 overflow-hidden rounded-xl border-l-4 transition-shadow hover:shadow-sm"
                style={{
                  top: top + 2,
                  height,
                  backgroundColor: `${dotColor}30`,
                  borderLeftColor: dotColor,
                }}
              >
                <div className="flex h-full items-start justify-between gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs font-semibold leading-tight text-foreground">
                        {cls.name}
                      </span>
                      {cls.scheduleLabel && (
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                            cls.scheduleLabel === "A"
                              ? "bg-accent-blue text-accent-blue-foreground"
                              : "bg-accent-purple text-accent-purple-foreground"
                          }`}
                        >
                          {cls.scheduleLabel}
                        </span>
                      )}
                      {cls.isApCourse && (
                        <span className="shrink-0 rounded-full bg-accent-amber px-1.5 py-0.5 text-[9px] font-bold text-accent-amber-foreground">
                          AP
                        </span>
                      )}
                    </div>
                    {duration >= 45 && (cls.teacherName || cls.room) && (
                      <p className="mt-0.5 truncate text-[10px] text-muted">
                        {[cls.teacherName, cls.room].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {duration >= 30 && startStr && (
                      <p className="mt-0.5 text-[10px] tabular-nums text-muted">
                        {formatTimeRange(startStr, endStr)}
                      </p>
                    )}
                  </div>
                  {onKnowledge && (
                    <button
                      type="button"
                      onClick={() => onKnowledge(cls)}
                      title="Class knowledge"
                      className={`shrink-0 rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/10 ${
                        cls.syllabusText || cls.classNotes || cls.isApCourse
                          ? "text-accent-green-foreground"
                          : "text-muted"
                      }`}
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Untimed classes below timeline */}
      {untimedClasses.length > 0 && (
        <div className="mt-6 border-t border-border/40 pt-4">
          <p className="mb-3 text-[10px] uppercase tracking-widest text-muted">No time set</p>
          <div className="divide-y divide-border/50">
            {untimedClasses.map((cls) => (
              <UntimedClassRow key={cls.id} cls={cls} onKnowledge={onKnowledge} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Simple row for classes that have no time — used below the timeline
function UntimedClassRow({
  cls,
  onKnowledge,
}: {
  cls: SchoolClass;
  onKnowledge?: (cls: SchoolClass) => void;
}) {
  const hasKnowledge = !!(cls.syllabusText || cls.classNotes || cls.isApCourse);
  return (
    <div className="flex items-center gap-3 py-3">
      <div
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: cls.color ?? "#d4edd9" }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-foreground">{cls.name}</span>
          {cls.isApCourse && (
            <span className="rounded-full bg-accent-amber px-2 py-0.5 text-[10px] font-semibold text-accent-amber-foreground">
              AP
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted italic">
          {[cls.teacherName, cls.room].filter(Boolean).join(" · ") || "Time not set"}
        </p>
      </div>
      {onKnowledge && (
        <button
          type="button"
          onClick={() => onKnowledge(cls)}
          title="Class knowledge"
          className={`shrink-0 rounded-full p-1 transition-colors hover:bg-surface ${
            hasKnowledge ? "text-accent-green-foreground" : "text-muted hover:text-foreground"
          }`}
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Day-type schedule view ──────────────────────────────────────────────────

const DAY_LABEL_STYLE: Record<string, { bg: string; text: string }> = {
  A: { bg: "bg-accent-blue", text: "text-accent-blue-foreground" },
  B: { bg: "bg-accent-purple", text: "text-accent-purple-foreground" },
};

function getDayLabelStyle(label: string) {
  return DAY_LABEL_STYLE[label] ?? { bg: "bg-surface", text: "text-muted" };
}

function sortByStartTime(a: SchoolClass, b: SchoolClass): number {
  const aMin = getClassDisplayTime(a)?.startMin ?? 0;
  const bMin = getClassDisplayTime(b)?.startMin ?? 0;
  return aMin - bMin;
}

type DayLabel = NonNullable<SchoolClass["scheduleLabel"]>;

function DayTypeScheduleView({
  classes,
  onKnowledge,
}: {
  classes: SchoolClass[];
  onKnowledge?: (cls: SchoolClass) => void;
}) {
  const dayLabels: DayLabel[] = Array.from(
    new Set(
      classes
        .map((c) => c.scheduleLabel)
        .filter((l): l is DayLabel => l !== undefined)
    )
  ).sort();

  const everyday = [...classes.filter((c) => !c.scheduleLabel)].sort(sortByStartTime);
  const hasRotation = dayLabels.length > 0;

  const [activeTab, setActiveTab] = useState<DayLabel | "">(dayLabels[0] ?? "");
  const effectiveTab: DayLabel | "" = (dayLabels as string[]).includes(activeTab)
    ? activeTab
    : dayLabels[0] ?? "";

  if (!hasRotation) {
    return (
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">Schedule</h2>
          <span className="ml-auto text-xs text-muted">
            {everyday.length} {everyday.length === 1 ? "class" : "classes"}
          </span>
        </div>
        <ScheduleTimeline classes={everyday} onKnowledge={onKnowledge} />
      </div>
    );
  }

  // Rotation exists — tab-based view
  const rotationClasses = [...classes.filter((c) => effectiveTab && c.scheduleLabel === effectiveTab)].sort(sortByStartTime);
  const tabClasses = [...rotationClasses, ...everyday].sort(sortByStartTime);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-border">
        {dayLabels.map((label) => {
          const count = classes.filter((c) => c.scheduleLabel === label).length;
          const isActive = label === effectiveTab;
          const { bg, text } = getDayLabelStyle(label);
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActiveTab(label as DayLabel)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${bg} ${text}`}
              >
                {label}
              </span>
              {label} Day
              <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-muted tabular-nums">
                {count + everyday.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tabClasses.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-muted">No classes on {effectiveTab} Day yet.</p>
          <p className="mt-1 text-xs text-muted">
            Add classes and label them &ldquo;{effectiveTab}-Day&rdquo; to see them here.
          </p>
        </div>
      ) : (
        <ScheduleTimeline classes={tabClasses} onKnowledge={onKnowledge} />
      )}
    </div>
  );
}

// ─── Class Knowledge Modal ───────────────────────────────────────────────────

type ClassKnowledgeModalProps = {
  schoolClass: SchoolClass;
  onSave: (updates: Partial<Omit<SchoolClass, "id">>) => Promise<void>;
  onClose: () => void;
};

function ClassKnowledgeModal({ schoolClass, onSave, onClose }: ClassKnowledgeModalProps) {
  const [syllabusText, setSyllabusText] = useState(schoolClass.syllabusText ?? "");
  const [classNotes, setClassNotes] = useState(schoolClass.classNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apTemplate = schoolClass.isApCourse && schoolClass.apCourseKey
    ? getApTemplate(schoolClass.apCourseKey)
    : null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        syllabusText: syllabusText.trim() || undefined,
        classNotes: classNotes.trim() || undefined,
      });
    } catch {
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  const textareaClass =
    "w-full resize-none rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground truncate">{schoolClass.name}</h2>
              {schoolClass.isApCourse && (
                <span className="inline-flex items-center rounded-full bg-accent-amber px-2 py-0.5 text-[10px] font-semibold text-accent-amber-foreground shrink-0">
                  AP
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted">
              Class Knowledge — helps the assistant give smarter, class-specific answers
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1 text-muted transition-colors hover:bg-surface hover:text-foreground"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* AP template info */}
        {apTemplate && (
          <div className="mx-6 mt-4 rounded-xl border border-accent-amber/40 bg-accent-amber/10 px-4 py-3">
            <p className="text-xs font-semibold text-accent-amber-foreground">{apTemplate.officialName}</p>
            <p className="mt-0.5 text-xs text-muted">{apTemplate.description}</p>
            <p className="mt-1.5 text-xs text-muted">
              <span className="font-medium text-foreground">Key topics:</span>{" "}
              {apTemplate.units.slice(0, 4).join(", ")}{apTemplate.units.length > 4 ? "…" : ""}
            </p>
          </div>
        )}

        {schoolClass.isApCourse && !apTemplate && (
          <div className="mx-6 mt-4 rounded-xl border border-accent-amber/40 bg-accent-amber/10 px-4 py-3">
            <p className="text-xs text-muted">
              AP course detected. No built-in template available — add your syllabus below for the best assistant experience.
            </p>
          </div>
        )}

        {/* Fields */}
        <div className="space-y-4 px-6 py-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              Syllabus / course overview
              <span className="ml-1.5 text-xs font-normal text-muted">(optional)</span>
            </span>
            <textarea
              value={syllabusText}
              onChange={(e) => setSyllabusText(e.target.value)}
              placeholder="Paste key parts of your syllabus — topics covered, grading breakdown, important policies…"
              rows={4}
              className={textareaClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              Your notes about this class
              <span className="ml-1.5 text-xs font-normal text-muted">(optional)</span>
            </span>
            <textarea
              value={classNotes}
              onChange={(e) => setClassNotes(e.target.value)}
              placeholder="Anything the assistant should know — study tips, how the teacher grades, what topics are hardest…"
              rows={3}
              className={textareaClass}
            />
          </label>

          {error && (
            <p className="rounded-xl border border-accent-rose bg-accent-rose px-4 py-2.5 text-sm text-accent-rose-foreground">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <p className="text-xs text-muted">
            This info is only used to help the assistant answer questions about this class.
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-accent-green-foreground px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
