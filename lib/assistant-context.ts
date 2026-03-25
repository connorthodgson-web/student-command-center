import type { SchoolCalendarEntry, SchoolClass, StudentTask, Weekday } from "../types";
import { getClassesForToday, getClassTimeForDay, isNoSchoolDay } from "./schedule";

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getWeekday(date: Date): Weekday {
  const map: Weekday[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return map[date.getDay()];
}

export interface TodayContextClass {
  name: string;
  startTime: string;
  endTime: string;
}

export interface TodayContextTask {
  title: string;
  dueAt?: string;
  className?: string;
}

export interface TodayContext {
  date: string;
  dayOfWeek: string;
  dayType: "A" | "B" | null;
  isNoSchool: boolean;
  todayClasses: TodayContextClass[];
  tasksDueToday: TodayContextTask[];
  tasksDueTomorrow: TodayContextTask[];
  tasksDueThisWeek: TodayContextTask[];
  overdueTasks: TodayContextTask[];
}

export function buildTodayContext(
  now: Date,
  classes: SchoolClass[],
  tasks: StudentTask[],
  calendarEntries: SchoolCalendarEntry[],
  effectiveDayType: "A" | "B" | null,
): TodayContext {
  const todayStr = toDateStr(now);
  const weekday = getWeekday(now);
  const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
  const noSchool = isNoSchoolDay(calendarEntries, todayStr);

  const todayClasses: TodayContextClass[] = noSchool
    ? []
    : getClassesForToday(classes, weekday, effectiveDayType).map((c) => {
        const times = getClassTimeForDay(c, weekday);
        return {
          name: c.name,
          startTime: times?.startTime ?? c.startTime,
          endTime: times?.endTime ?? c.endTime,
        };
      });

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const startOfTomorrow = new Date(now);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  startOfTomorrow.setHours(0, 0, 0, 0);
  const endOfTomorrow = new Date(startOfTomorrow);
  endOfTomorrow.setHours(23, 59, 59, 999);

  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  endOfWeek.setHours(23, 59, 59, 999);

  function toContextTask(t: StudentTask): TodayContextTask {
    const cls = classes.find((c) => c.id === t.classId);
    return { title: t.title, dueAt: t.dueAt, className: cls?.name };
  }

  const active = tasks.filter((t) => t.status !== "done");

  const tasksDueToday = active
    .filter((t) => t.dueAt && new Date(t.dueAt) >= startOfToday && new Date(t.dueAt) <= endOfToday)
    .map(toContextTask);

  const tasksDueTomorrow = active
    .filter((t) => t.dueAt && new Date(t.dueAt) >= startOfTomorrow && new Date(t.dueAt) <= endOfTomorrow)
    .map(toContextTask);

  const tasksDueThisWeek = active
    .filter((t) => t.dueAt && new Date(t.dueAt) > endOfTomorrow && new Date(t.dueAt) <= endOfWeek)
    .map(toContextTask);

  const overdueTasks = active
    .filter((t) => t.dueAt && new Date(t.dueAt) < startOfToday)
    .map(toContextTask);

  return {
    date: todayStr,
    dayOfWeek,
    dayType: effectiveDayType,
    isNoSchool: noSchool,
    todayClasses,
    tasksDueToday,
    tasksDueTomorrow,
    tasksDueThisWeek,
    overdueTasks,
  };
}

export function formatTodayContextForPrompt(ctx: TodayContext): string {
  const lines: string[] = [];

  lines.push(`## Structured Today Context`);
  lines.push(`Date: ${ctx.dayOfWeek}, ${ctx.date}`);
  if (ctx.dayType) lines.push(`Day type: ${ctx.dayType}-Day`);
  if (ctx.isNoSchool) lines.push(`Note: No school today.`);
  lines.push(``);

  if (ctx.isNoSchool || ctx.todayClasses.length === 0) {
    lines.push(`Classes today: none`);
  } else {
    lines.push(`Classes today:`);
    for (const c of ctx.todayClasses) {
      lines.push(`  - ${c.name}: ${c.startTime}–${c.endTime}`);
    }
  }
  lines.push(``);

  if (ctx.overdueTasks.length > 0) {
    lines.push(`Overdue tasks:`);
    for (const t of ctx.overdueTasks) {
      const due = t.dueAt
        ? new Date(t.dueAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
        : "";
      const cls = t.className ? ` [${t.className}]` : "";
      lines.push(`  - ${t.title}${cls}${due ? `, was due ${due}` : ""}`);
    }
    lines.push(``);
  }

  if (ctx.tasksDueToday.length > 0) {
    lines.push(`Tasks due today:`);
    for (const t of ctx.tasksDueToday) {
      const cls = t.className ? ` [${t.className}]` : "";
      lines.push(`  - ${t.title}${cls}`);
    }
  } else {
    lines.push(`Tasks due today: none`);
  }
  lines.push(``);

  if (ctx.tasksDueTomorrow.length > 0) {
    lines.push(`Tasks due tomorrow:`);
    for (const t of ctx.tasksDueTomorrow) {
      const cls = t.className ? ` [${t.className}]` : "";
      lines.push(`  - ${t.title}${cls}`);
    }
    lines.push(``);
  }

  if (ctx.tasksDueThisWeek.length > 0) {
    lines.push(`Tasks due this week (next 2–7 days):`);
    for (const t of ctx.tasksDueThisWeek) {
      const due = t.dueAt
        ? new Date(t.dueAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
        : "";
      const cls = t.className ? ` [${t.className}]` : "";
      lines.push(`  - ${t.title}${cls}${due ? `, due ${due}` : ""}`);
    }
  }

  return lines.join("\n");
}
