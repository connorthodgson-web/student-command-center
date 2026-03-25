"use client";

import Link from "next/link";
import { AssistantInput } from "../../components/AssistantInput";
import { NextTaskCard } from "../../components/NextTaskCard";
import { TaskCard } from "../../components/TaskCard";
import { useClasses } from "../../lib/stores/classStore";
import { useScheduleConfig } from "../../lib/stores/scheduleConfig";
import { useCalendar } from "../../lib/stores/calendarStore";
import { useReminderStore } from "../../lib/reminder-store";
import { useTaskStore } from "../../lib/task-store";
import {
  getClassesForToday,
  getCurrentWeekday,
  getClassTimeForDay,
  formatTimeRange,
  getTodayDateString,
  isNoSchoolDay,
  getAbOverrideForDate,
} from "../../lib/schedule";
import {
  getIncompleteTasks,
  groupTasksByDisplayBucket,
  sortTasksByDueDate,
} from "../../lib/tasks";
import type { TaskDisplayBuckets } from "../../lib/tasks";
import type { SchoolDayCategory } from "../../types";

const BUCKET_LABELS: Record<keyof TaskDisplayBuckets, string> = {
  overdue: "Overdue",
  today: "Due Today",
  upcoming: "Coming Up",
  noDueDate: "No Due Date",
};

const BUCKET_COLORS: Record<keyof TaskDisplayBuckets, string> = {
  overdue: "border-l-accent-rose-foreground bg-accent-rose/30",
  today: "border-l-accent-amber-foreground bg-accent-amber/30",
  upcoming: "border-l-accent-blue-foreground bg-accent-blue/30",
  noDueDate: "border-l-border bg-surface",
};

const BUCKET_LABEL_COLORS: Record<keyof TaskDisplayBuckets, string> = {
  overdue: "text-accent-rose-foreground",
  today: "text-accent-amber-foreground",
  upcoming: "text-accent-blue-foreground",
  noDueDate: "text-muted",
};

const NO_SCHOOL_BANNER: Record<
  SchoolDayCategory,
  { label: string; className: string }
> = {
  no_school: {
    label: "No School Today",
    className: "border-accent-rose/50 bg-accent-rose/20 text-accent-rose-foreground",
  },
  holiday: {
    label: "Holiday",
    className: "border-accent-amber/50 bg-accent-amber/20 text-accent-amber-foreground",
  },
  teacher_workday: {
    label: "Teacher Workday — No Students",
    className: "border-accent-blue/50 bg-accent-blue/20 text-accent-blue-foreground",
  },
  special: {
    label: "Special Schedule Today",
    className: "border-accent-purple/50 bg-accent-purple/20 text-accent-purple-foreground",
  },
};

function formatTodayLong(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function DashboardPage() {
  const { classes, addClasses } = useClasses();
  const { tasks, addTask } = useTaskStore();
  const { preferences: reminderPreferences } = useReminderStore();
  const { todayDayType, setTodayDayType } = useScheduleConfig();
  const { entries: calendarEntries, getEntryForDate } = useCalendar();

  const todayWeekday = getCurrentWeekday();
  const todayDateStr = getTodayDateString();

  // Calendar awareness
  const todayCalendarEntry = getEntryForDate(todayDateStr);
  const calendarAbOverride = getAbOverrideForDate(calendarEntries, todayDateStr);
  const noSchoolToday = isNoSchoolDay(calendarEntries, todayDateStr);

  // Effective day type: calendar override takes priority over manual selection
  const effectiveDayType = calendarAbOverride ?? todayDayType;

  // A/B-aware class filtering, with no-school support
  const todayClasses = noSchoolToday
    ? []
    : getClassesForToday(classes, todayWeekday, effectiveDayType);

  // Whether any class uses A/B rotation (shows the day-type picker if so)
  const hasAbClasses = classes.some((c) => c.scheduleLabel);

  const incompleteTasks = sortTasksByDueDate(getIncompleteTasks(tasks));
  const groupedTasks = groupTasksByDisplayBucket(incompleteTasks);
  const nextTask = incompleteTasks[0];

  const nonEmptyBuckets = (
    Object.entries(groupedTasks) as [keyof TaskDisplayBuckets, (typeof groupedTasks)[keyof TaskDisplayBuckets]][]
  ).filter(([, t]) => t.length > 0);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning." : hour < 17 ? "Good afternoon." : "Good evening.";

  const overdueCount = groupedTasks.overdue.length;
  const tasksWithDates = incompleteTasks.filter((t) => t.dueAt).length;

  return (
    <main className="flex min-h-screen flex-col">
      {/* ── Dark hero: greeting + assistant input ─────────────────── */}
      <div className="bg-hero px-8 py-10 md:py-12">
        <div className="mx-auto max-w-6xl">
          {/* Date + greeting */}
          <p className="text-[13px] font-medium text-sidebar-text">
            {greeting}
            <span className="ml-2 text-white/30">·</span>
            <span className="ml-2">{formatTodayLong()}</span>
          </p>
          <h1 className="mt-1.5 text-[2.25rem] font-bold tracking-tight text-white leading-tight">
            What&apos;s on your mind?
          </h1>

          {/* Status chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            {tasksWithDates > 0 && (
              <span className="inline-flex items-center rounded-full border border-amber-400/25 bg-amber-400/15 px-3 py-1 text-xs font-medium text-amber-300">
                {tasksWithDates} task{tasksWithDates !== 1 ? "s" : ""} with due dates
              </span>
            )}
            {todayClasses.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-blue-400/25 bg-blue-400/15 px-3 py-1 text-xs font-medium text-blue-300">
                {todayClasses.length} {todayClasses.length === 1 ? "class" : "classes"} today
              </span>
            )}
            {overdueCount > 0 && (
              <span className="inline-flex items-center rounded-full border border-red-400/25 bg-red-400/15 px-3 py-1 text-xs font-medium text-red-300">
                {overdueCount} overdue
              </span>
            )}
            {incompleteTasks.length === 0 && (
              <span className="inline-flex items-center rounded-full border border-sidebar-accent/25 bg-sidebar-accent/10 px-3 py-1 text-xs font-medium text-sidebar-accent">
                All clear — no open tasks
              </span>
            )}
          </div>

          {/* Assistant input */}
          <div className="mt-6 max-w-3xl">
            <AssistantInput
              tasks={tasks}
              classes={classes}
              reminderPreferences={reminderPreferences}
              onTaskConfirmed={addTask}
              onSchedulesConfirmed={addClasses}
            />
          </div>
        </div>
      </div>

      {/* ── Light content area ─────────────────────────────────── */}
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-8 py-8">

        {/* Special day banner — shown when today has a calendar entry */}
        {todayCalendarEntry && (
          <section>
            <div
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                NO_SCHOOL_BANNER[todayCalendarEntry.category].className
              }`}
            >
              <div className="flex-1">
                <p className="text-sm font-semibold">
                  {NO_SCHOOL_BANNER[todayCalendarEntry.category].label}
                  {todayCalendarEntry.label ? ` · ${todayCalendarEntry.label}` : ""}
                </p>
                {noSchoolToday && (
                  <p className="mt-0.5 text-xs opacity-75">
                    Your class schedule is hidden for today.
                  </p>
                )}
                {!noSchoolToday && todayCalendarEntry.category === "special" && (
                  <p className="mt-0.5 text-xs opacity-75">
                    Regular classes are shown — check with your school for today&apos;s actual schedule.
                  </p>
                )}
              </div>
              <Link
                href="/calendar"
                className="shrink-0 text-xs underline underline-offset-2 opacity-60 hover:opacity-100 transition-opacity"
              >
                Edit
              </Link>
            </div>
          </section>
        )}

        {/* A/B day picker — only shown when rotation classes exist and school is in session */}
        {hasAbClasses && !noSchoolToday && (
          <section>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted">
                Today&apos;s rotation
              </span>
              {(["A", "B", null] as const).map((type) => {
                const isCalendarSource = type !== null && calendarAbOverride === type;
                return (
                  <button
                    key={type ?? "standard"}
                    type="button"
                    onClick={() => setTodayDayType(type === todayDayType ? null : type)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition select-none ${
                      effectiveDayType === type
                        ? type === "A"
                          ? "border-blue-400/50 bg-blue-500/20 text-blue-700"
                          : type === "B"
                          ? "border-purple-400/50 bg-purple-500/20 text-purple-700"
                          : "border-border bg-surface text-foreground"
                        : "border-border bg-card text-muted hover:bg-surface"
                    }`}
                  >
                    {type === null ? "Standard" : `${type}-Day`}
                    {isCalendarSource && (
                      <span className="ml-1.5 opacity-60">·&nbsp;calendar</span>
                    )}
                  </button>
                );
              })}
              {effectiveDayType && !calendarAbOverride && (
                <span className="text-xs text-muted">
                  Showing{" "}
                  <span className="font-medium text-foreground">{effectiveDayType}-Day</span>{" "}
                  classes
                </span>
              )}
            </div>
          </section>
        )}

        {/* Today's schedule strip */}
        {!noSchoolToday && todayClasses.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
              Today&apos;s Schedule
            </h2>
            <div className="flex flex-wrap gap-3">
              {todayClasses.map((cls) => {
                const time = getClassTimeForDay(cls, todayWeekday);
                return (
                  <div
                    key={cls.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
                  >
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: cls.color ?? "#d4edd9" }}
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-foreground">{cls.name}</p>
                        {cls.scheduleLabel && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              cls.scheduleLabel === "A"
                                ? "bg-accent-blue text-accent-blue-foreground"
                                : "bg-accent-purple text-accent-purple-foreground"
                            }`}
                          >
                            {cls.scheduleLabel}
                          </span>
                        )}
                      </div>
                      {time && (
                        <p className="text-xs text-muted">
                          {formatTimeRange(time.startTime, time.endTime)}
                          {cls.room ? ` · ${cls.room}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state: no classes set up yet */}
        {classes.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-7">
            <p className="text-sm font-medium text-foreground">No classes set up yet.</p>
            <p className="mt-1 text-sm text-muted">
              Describe your schedule above and the assistant will set it up for you, or{" "}
              <Link
                href="/classes"
                className="font-medium text-accent-green-foreground underline underline-offset-2"
              >
                add classes manually
              </Link>
              .
            </p>
          </div>
        )}

        {/* Classes exist but none meet today (and no special day explanation) */}
        {!noSchoolToday && classes.length > 0 && todayClasses.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-5">
            <p className="text-sm text-muted">
              No classes scheduled for today.
              {hasAbClasses && !effectiveDayType && (
                <span>
                  {" "}
                  If you have A/B day rotation, select today&apos;s rotation above to see your schedule.
                </span>
              )}
            </p>
          </div>
        )}

        {/* Up Next + Workload */}
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <NextTaskCard
            task={nextTask}
            schoolClass={nextTask ? classes.find((c) => c.id === nextTask.classId) : undefined}
          />

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">Workload</h2>
            <div className="mt-4 space-y-3">
              {nonEmptyBuckets.length === 0 ? (
                <p className="text-sm text-muted">No open tasks right now.</p>
              ) : (
                nonEmptyBuckets.map(([bucket, bucketTasks]) => (
                  <div
                    key={bucket}
                    className={`rounded-xl border-l-4 px-4 py-3 ${BUCKET_COLORS[bucket]}`}
                  >
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide ${BUCKET_LABEL_COLORS[bucket]}`}
                    >
                      {BUCKET_LABELS[bucket]} · {bucketTasks.length}
                    </p>
                    <div className="mt-2 space-y-2">
                      {bucketTasks.slice(0, 3).map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          schoolClass={classes.find((c) => c.id === task.classId)}
                          isOverdue={bucket === "overdue"}
                        />
                      ))}
                      {bucketTasks.length > 3 && (
                        <Link
                          href="/tasks"
                          className="block text-xs text-muted underline underline-offset-2 hover:text-foreground"
                        >
                          +{bucketTasks.length - 3} more in Tasks
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
