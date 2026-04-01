"use client";

import { useCallback, useEffect, useState } from "react";
import { useClasses } from "../lib/stores/classStore";
import { useTaskStore } from "../lib/task-store";
import { useCalendar } from "../lib/stores/calendarStore";
import { useScheduleConfig } from "../lib/stores/scheduleConfig";
import { usePlanningStore } from "../lib/stores/planningStore";
import { getScheduleDayOverrideForDate, getTodayDateString } from "../lib/schedule";
import { buildTodayContext, formatTodayContextForPrompt } from "../lib/assistant-context";
import { loadProfile } from "../lib/profile";
import { renderContent } from "../lib/render-content";

export function TodayFocusCard() {
  const { classes } = useClasses();
  const { tasks } = useTaskStore();
  const { entries: calendarEntries } = useCalendar();
  const { todayDayType, scheduleArchitecture } = useScheduleConfig();
  const { items: planningItems } = usePlanningStore();

  const [focus, setFocus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(false);
    setFocus(null);

    try {
      const todayDateStr = getTodayDateString();
      const calendarAbOverride = getScheduleDayOverrideForDate(calendarEntries, todayDateStr);
      const effectiveDayType = calendarAbOverride ?? todayDayType;

      const profile = loadProfile();

      const ctx = buildTodayContext(
        new Date(),
        classes,
        tasks,
        calendarEntries,
        effectiveDayType,
        planningItems,
        scheduleArchitecture,
      );

      const contextText = formatTodayContextForPrompt(ctx);

      const res = await fetch("/api/ai/today-focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextText, profile }),
      });

      if (!res.ok) throw new Error("API error");

      const data = (await res.json()) as { focus?: string; error?: string };
      if (data.focus) {
        setFocus(data.focus);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [classes, tasks, calendarEntries, todayDayType, planningItems, scheduleArchitecture]);

  useEffect(() => {
    generate();
  }, [generate]);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Today&apos;s Focus
          </span>
        </div>
        {!loading && (
          <button
            type="button"
            onClick={generate}
            title="Refresh"
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:bg-surface hover:text-foreground transition-colors"
          >
            <RefreshIcon />
            Refresh
          </button>
        )}
      </div>

      {/* Content */}
      <div className="mt-4 text-sm text-foreground/90">
        {loading ? (
          <FocusSkeleton />
        ) : error ? (
          <p className="text-sm text-muted">
            Couldn&apos;t generate a focus right now.{" "}
            <button
              type="button"
              onClick={generate}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Try again
            </button>
          </p>
        ) : focus ? (
          renderContent(focus)
        ) : null}
      </div>
    </section>
  );
}

function FocusSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-4 w-3/4 rounded bg-border/60" />
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-border/60" />
          <div className="h-3.5 w-5/6 rounded bg-border/60" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-border/60" />
          <div className="h-3.5 w-2/3 rounded bg-border/60" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-border/60" />
          <div className="h-3.5 w-4/5 rounded bg-border/60" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-border/60" />
          <div className="h-3.5 w-1/2 rounded bg-border/60" />
        </div>
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13.65 2.35A8 8 0 1 0 15 8h-2a6 6 0 1 1-1.05-3.36L9 7h6V1l-1.35 1.35Z"
        fill="currentColor"
      />
    </svg>
  );
}
