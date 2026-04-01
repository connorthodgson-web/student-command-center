import type {
  PlanningItem,
  RotationDay,
  SchoolCalendarEntry,
  SchoolClass,
  ScheduleArchitecture,
  StudentTask,
  Weekday,
} from "../types";
import { getClassesForToday, getClassTimeForDay, isNoSchoolDay } from "./schedule";
import { formatPlanningItemWindow, isPlanningItemOnDate } from "./planning-items";

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
  /** Room number or location, if set on the class */
  room?: string;
  /** Teacher name, if set on the class */
  teacherName?: string;
}

export interface TodayContextTask {
  title: string;
  dueAt?: string;
  className?: string;
}

export interface TodayContext {
  date: string;
  dayOfWeek: string;
  scheduleDayLabel: RotationDay | null;
  isNoSchool: boolean;
  todayClasses: TodayContextClass[];
  tasksDueToday: TodayContextTask[];
  tasksDueTomorrow: TodayContextTask[];
  tasksDueThisWeek: TodayContextTask[];
  overdueTasks: TodayContextTask[];
  todayActivities: PlanningItem[];
  upcomingEvents: PlanningItem[];
  scheduleArchitecture?: ScheduleArchitecture;
}

export function buildTodayContext(
  now: Date,
  classes: SchoolClass[],
  tasks: StudentTask[],
  calendarEntries: SchoolCalendarEntry[],
  effectiveDayType: RotationDay | null,
  planningItems: PlanningItem[] = [],
  scheduleArchitecture?: ScheduleArchitecture,
): TodayContext {
  const todayStr = toDateStr(now);
  const weekday = getWeekday(now);
  const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
  const noSchool = isNoSchoolDay(calendarEntries, todayStr);

  const todayClasses: TodayContextClass[] = noSchool
    ? []
    : getClassesForToday(classes, weekday, effectiveDayType, scheduleArchitecture).map((c) => {
        const times = getClassTimeForDay(c, weekday);
        return {
          name: c.name,
          startTime: times?.startTime ?? c.startTime,
          endTime: times?.endTime ?? c.endTime,
          room: c.room,
          teacherName: c.teacherName,
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

  const todayActivities = planningItems.filter(
    (item) => item.kind === "recurring_activity" && isPlanningItemOnDate(item, now),
  );

  const upcomingEvents = planningItems.filter((item) => {
    if (item.kind !== "one_off_event" || !item.date || !item.enabled) return false;
    return item.date >= todayStr && item.date <= toDateStr(endOfWeek);
  });

  return {
    date: todayStr,
    dayOfWeek,
    scheduleDayLabel: effectiveDayType,
    isNoSchool: noSchool,
    todayClasses,
    tasksDueToday,
    tasksDueTomorrow,
    tasksDueThisWeek,
    overdueTasks,
    todayActivities,
    upcomingEvents,
    scheduleArchitecture,
  };
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

export function formatTodayContextForPrompt(ctx: TodayContext): string {
  const lines: string[] = [];
  const now = new Date(`${ctx.date}T${new Date().toTimeString().slice(0, 8)}`);

  lines.push(`## Today's context`);
  const architectureLabel =
    ctx.scheduleArchitecture?.type === "rotation"
      ? ` [rotation: ${ctx.scheduleArchitecture.rotationLabels.join("/")}]`
      : ctx.scheduleArchitecture?.type === "weekday"
        ? " [weekday schedule]"
        : "";
  const dayLabel = ctx.scheduleDayLabel ? ` (${ctx.scheduleDayLabel}-Day)` : "";
  lines.push(`${ctx.dayOfWeek}, ${ctx.date}${dayLabel}${architectureLabel}${ctx.isNoSchool ? " — no school" : ""}`);
  lines.push(``);

  if (!ctx.isNoSchool && ctx.todayClasses.length > 0) {
    // Determine current and next class based on current wall-clock time
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let currentClass: TodayContextClass | null = null;
    let nextClass: TodayContextClass | null = null;

    for (const c of ctx.todayClasses) {
      const start = timeToMinutes(c.startTime);
      const end = timeToMinutes(c.endTime);
      if (nowMinutes >= start && nowMinutes < end) {
        currentClass = c;
      } else if (nowMinutes < start && !nextClass) {
        nextClass = c;
      }
    }

    if (currentClass) {
      lines.push(`Current class: ${currentClass.name} (until ${currentClass.endTime})`);
    }
    if (nextClass) {
      lines.push(`Next class: ${nextClass.name} at ${nextClass.startTime}`);
    }

    lines.push(`Schedule today:`);
    for (const c of ctx.todayClasses) {
      const details: string[] = [];
      if (c.room) details.push(`room ${c.room}`);
      if (c.teacherName) details.push(c.teacherName);
      const detailStr = details.length > 0 ? ` (${details.join(", ")})` : "";
      lines.push(`  - ${c.name}: ${c.startTime}–${c.endTime}${detailStr}`);
    }
  } else {
    lines.push(`Classes today: none`);
  }
  lines.push(``);

  if (ctx.overdueTasks.length > 0) {
    const overdueSummary = ctx.overdueTasks.map((t) => {
      const cls = t.className ? ` [${t.className}]` : "";
      return `${t.title}${cls}`;
    }).join(", ");
    lines.push(`Overdue (${ctx.overdueTasks.length}): ${overdueSummary}`);
    lines.push(``);
  }

  if (ctx.tasksDueToday.length > 0) {
    lines.push(`Due today:`);
    for (const t of ctx.tasksDueToday) {
      const cls = t.className ? ` [${t.className}]` : "";
      lines.push(`  - ${t.title}${cls}`);
    }
  } else {
    lines.push(`Due today: nothing`);
  }
  lines.push(``);

  if (ctx.tasksDueTomorrow.length > 0) {
    lines.push(`Due tomorrow:`);
    for (const t of ctx.tasksDueTomorrow) {
      const cls = t.className ? ` [${t.className}]` : "";
      lines.push(`  - ${t.title}${cls}`);
    }
    lines.push(``);
  }

  if (ctx.tasksDueThisWeek.length > 0) {
    lines.push(`Coming up this week:`);
    for (const t of ctx.tasksDueThisWeek) {
      const due = t.dueAt
        ? new Date(t.dueAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
        : "";
      const cls = t.className ? ` [${t.className}]` : "";
      lines.push(`  - ${t.title}${cls}${due ? ` — ${due}` : ""}`);
    }
  }

  if (ctx.todayActivities.length > 0) {
    lines.push(``);
    lines.push(`Outside activities today:`);
    for (const a of ctx.todayActivities) {
      const loc = a.location ? ` @ ${a.location}` : "";
      lines.push(`  - ${a.title}: ${formatPlanningItemWindow(a)}${loc}`);
    }
  }

  if (ctx.upcomingEvents.length > 0) {
    lines.push(``);
    lines.push(`Upcoming one-off events:`);
    for (const event of ctx.upcomingEvents) {
      const dateLabel = event.date
        ? new Date(event.date + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })
        : "Date not set";
      const loc = event.location ? ` @ ${event.location}` : "";
      const notes = event.notes ? ` — ${event.notes}` : "";
      lines.push(
        `  - ${event.title}: ${dateLabel}${event.isAllDay ? " (all day)" : ` (${formatPlanningItemWindow(event)})`}${loc}${notes}`,
      );
    }
  }

  return lines.join("\n");
}
