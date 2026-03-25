// UI redesign pass
"use client";

import { useTaskStore } from "../lib/task-store";
import { useClasses } from "../lib/stores/classStore";
import { getClassesOnDay, getCurrentWeekday } from "../lib/schedule";
import { getIncompleteTasks } from "../lib/tasks";

export function AssistantHero() {
  const { tasks } = useTaskStore();
  const { classes } = useClasses();

  const todayWeekday = getCurrentWeekday();
  const todayClasses = getClassesOnDay(classes, todayWeekday);
  const incompleteTasks = getIncompleteTasks(tasks);
  const tasksDueSoon = incompleteTasks.filter((t) => {
    if (!t.dueAt) return false;
    const diff = new Date(t.dueAt).getTime() - Date.now();
    return diff > 0 && diff < 1000 * 60 * 60 * 48; // within 48 hours
  });

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning." : hour < 17 ? "Good afternoon." : "Good evening.";

  return (
    <section className="px-8 pb-2 pt-10">
      <p className="text-[13px] font-medium text-muted">{greeting}</p>
      <h1 className="mt-2 text-5xl font-bold tracking-tight text-foreground leading-tight">
        Here&apos;s where your<br />school week stands.
      </h1>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-full bg-accent-amber px-4 py-1.5 text-sm font-medium text-accent-amber-foreground">
          {tasksDueSoon.length > 0
            ? `${tasksDueSoon.length} task${tasksDueSoon.length > 1 ? "s" : ""} due soon`
            : "No tasks due soon"}
        </span>
        <span className="inline-flex items-center rounded-full bg-accent-blue px-4 py-1.5 text-sm font-medium text-accent-blue-foreground">
          {todayClasses.length > 0
            ? `${todayClasses.length} ${todayClasses.length === 1 ? "class" : "classes"} today`
            : "No classes today"}
        </span>
        <span className="inline-flex items-center rounded-full bg-accent-green px-4 py-1.5 text-sm font-medium text-accent-green-foreground">
          {incompleteTasks.length} open task{incompleteTasks.length !== 1 ? "s" : ""}
        </span>
      </div>
    </section>
  );
}
