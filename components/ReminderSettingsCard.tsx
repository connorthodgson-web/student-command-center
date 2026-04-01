"use client";

import { useEffect, useState } from "react";
import { buildReminderPreferenceSummary } from "../lib/reminders";
import { useReminderStore } from "../lib/reminder-store";

type ToggleKey =
  | "dailySummaryEnabled"
  | "tonightSummaryEnabled"
  | "dueSoonRemindersEnabled";

type SavingState = "idle" | "saving" | "saved";

export function ReminderSettingsCard() {
  const { preferences, updatePreferences, loading } = useReminderStore();
  const [dailySummaryTime, setDailySummaryTime] = useState(preferences.dailySummaryTime ?? "07:00");
  const [tonightSummaryTime, setTonightSummaryTime] = useState(
    preferences.tonightSummaryTime ?? "19:00",
  );
  const [dueSoonHoursBefore, setDueSoonHoursBefore] = useState(
    String(preferences.dueSoonHoursBefore ?? 6),
  );
  const [error, setError] = useState<string | null>(null);
  const [savingState, setSavingState] = useState<SavingState>("idle");

  useEffect(() => {
    setDailySummaryTime(preferences.dailySummaryTime ?? "07:00");
    setTonightSummaryTime(preferences.tonightSummaryTime ?? "19:00");
    setDueSoonHoursBefore(String(preferences.dueSoonHoursBefore ?? 6));
  }, [preferences]);

  const savePartial = async (
    partial: Parameters<typeof updatePreferences>[0],
    fallbackMessage: string,
  ) => {
    setError(null);
    setSavingState("saving");
    try {
      await updatePreferences(partial);
      setSavingState("saved");
      window.setTimeout(() => setSavingState("idle"), 2000);
    } catch (saveError) {
      setSavingState("idle");
      setError(saveError instanceof Error ? saveError.message : fallbackMessage);
    }
  };

  const togglePreference = (key: ToggleKey) => {
    void savePartial({ [key]: !preferences[key] }, "Failed to save reminder preferences.");
  };

  const handleDailyTimeBlur = () => {
    if (dailySummaryTime === (preferences.dailySummaryTime ?? "07:00")) return;
    void savePartial({ dailySummaryTime }, "Failed to save daily summary time.");
  };

  const handleTonightTimeBlur = () => {
    if (tonightSummaryTime === (preferences.tonightSummaryTime ?? "19:00")) return;
    void savePartial({ tonightSummaryTime }, "Failed to save tonight summary time.");
  };

  const handleDueSoonBlur = () => {
    const parsed = Number.parseInt(dueSoonHoursBefore, 10);
    if (Number.isNaN(parsed)) {
      setError("Due soon hours must be a whole number.");
      setDueSoonHoursBefore(String(preferences.dueSoonHoursBefore ?? 6));
      return;
    }

    if (parsed === (preferences.dueSoonHoursBefore ?? 6)) return;
    void savePartial({ dueSoonHoursBefore: parsed }, "Failed to save due-soon timing.");
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Reminder Preferences</h2>
      <p className="mt-2 text-sm text-muted">
        Choose which assistant reminders stay on and tweak the built-in default times.
      </p>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={() => togglePreference("dailySummaryEnabled")}
          disabled={loading || savingState === "saving"}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:bg-surface disabled:opacity-60"
        >
          <span>
            <span className="block text-sm font-medium text-foreground">Daily summary</span>
            <span className="mt-0.5 block text-xs text-muted">
              {preferences.dailySummaryEnabled
                ? `Enabled at ${preferences.dailySummaryTime ?? "a saved time"}`
                : "Off"}
            </span>
          </span>
          <TogglePill on={preferences.dailySummaryEnabled} />
        </button>

        <button
          type="button"
          onClick={() => togglePreference("tonightSummaryEnabled")}
          disabled={loading || savingState === "saving"}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:bg-surface disabled:opacity-60"
        >
          <span>
            <span className="block text-sm font-medium text-foreground">Tonight summary</span>
            <span className="mt-0.5 block text-xs text-muted">
              {preferences.tonightSummaryEnabled
                ? `Enabled at ${preferences.tonightSummaryTime ?? "a saved time"}`
                : "Off"}
            </span>
          </span>
          <TogglePill on={preferences.tonightSummaryEnabled} />
        </button>

        <button
          type="button"
          onClick={() => togglePreference("dueSoonRemindersEnabled")}
          disabled={loading || savingState === "saving"}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:bg-surface disabled:opacity-60"
        >
          <span>
            <span className="block text-sm font-medium text-foreground">Due soon reminders</span>
            <span className="mt-0.5 block text-xs text-muted">
              {preferences.dueSoonRemindersEnabled
                ? `${preferences.dueSoonHoursBefore ?? 0} hours before due dates`
                : "Off"}
            </span>
          </span>
          <TogglePill on={preferences.dueSoonRemindersEnabled} />
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Daily summary time</span>
          <input
            type="time"
            value={dailySummaryTime}
            onChange={(event) => setDailySummaryTime(event.target.value)}
            onBlur={handleDailyTimeBlur}
            disabled={loading || savingState === "saving"}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40 disabled:opacity-60"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Tonight summary time</span>
          <input
            type="time"
            value={tonightSummaryTime}
            onChange={(event) => setTonightSummaryTime(event.target.value)}
            onBlur={handleTonightTimeBlur}
            disabled={loading || savingState === "saving"}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40 disabled:opacity-60"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Due soon lead time</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={168}
              step={1}
              value={dueSoonHoursBefore}
              onChange={(event) => setDueSoonHoursBefore(event.target.value)}
              onBlur={handleDueSoonBlur}
              disabled={loading || savingState === "saving"}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40 disabled:opacity-60"
            />
            <span className="text-xs text-muted">hours</span>
          </div>
        </label>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-background p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Current summary</p>
        <p className="mt-2 text-sm leading-6 text-foreground">
          {loading ? "Loading your saved reminder setup..." : buildReminderPreferenceSummary(preferences)}
        </p>
      </div>

      {savingState === "saved" && (
        <p className="mt-3 text-xs font-medium text-accent-green-foreground">Saved</p>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-accent-rose bg-accent-rose px-4 py-3 text-sm text-accent-rose-foreground">
          {error}
        </p>
      )}
    </section>
  );
}

function TogglePill({ on }: { on: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        on ? "bg-accent-green text-accent-green-foreground" : "bg-surface text-muted"
      }`}
    >
      {on ? "On" : "Off"}
    </span>
  );
}
