"use client";

import { useEffect, useRef, useState } from "react";
import { ScheduleCard } from "../../components/ScheduleCard";
import { ScheduleSetupInput } from "../../components/ScheduleSetupInput";
import { SectionHeader } from "../../components/SectionHeader";
import { useClasses } from "../../lib/stores/classStore";
import type { ClassMeetingTime, SchoolClass, Weekday } from "../../types";

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
  const { classes, loading, addClass, addClasses, deleteClass } = useClasses();

  const [setupVisible, setSetupVisible] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const hasInitializedSetup = useRef(false);

  const [name, setName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [days, setDays] = useState<Weekday[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [usePerDayTimes, setUsePerDayTimes] = useState(false);
  const [dayTimes, setDayTimes] = useState<Partial<Record<Weekday, DayTime>>>({});
  const [room, setRoom] = useState("");
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
    setDays([]);
    setStartTime("");
    setEndTime("");
    setUsePerDayTimes(false);
    setDayTimes({});
    setRoom("");
    setColor(COLOR_SWATCHES[0].value);
    setScheduleLabel("");
    setValidationError(null);
    setMutationError(null);
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
      await addClass({
        name: name.trim(),
        teacherName: teacherName.trim() || undefined,
        days,
        startTime: canonicalStart,
        endTime: canonicalEnd,
        meetings,
        room: room.trim() || undefined,
        color,
        scheduleLabel: scheduleLabel || undefined,
      });

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
      )}

      {!loading && formOpen && (
        <section className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-foreground">Add a single class</h2>
            <p className="mt-0.5 text-sm text-muted">
              Fill in what you know - everything except the class name is optional.
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
                Add Class
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

      {!loading && hasClasses ? (
        <div className="grid gap-4 md:grid-cols-2">
          {classes.map((schoolClass) => (
            <ScheduleCard
              key={schoolClass.id}
              schoolClass={schoolClass}
              onDelete={() => void deleteClass(schoolClass.id)}
            />
          ))}
        </div>
      ) : (
        !loading &&
        !setupVisible && (
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
        )
      )}
    </main>
  );
}
