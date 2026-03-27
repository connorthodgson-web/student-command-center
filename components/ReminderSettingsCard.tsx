"use client";

import { useState } from "react";
import { buildReminderPreferenceSummary } from "../lib/reminders";
import { useReminderStore } from "../lib/reminder-store";

export function ReminderSettingsCard() {
  const { preferences, updatePreferences } = useReminderStore();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const togglePreference = (
    key: "dailySummaryEnabled" | "tonightSummaryEnabled" | "dueSoonRemindersEnabled",
  ) => {
    setError(null);
    void updatePreferences({ [key]: !preferences[key] })
      .then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      })
      .catch((saveError) => {
        setError(saveError instanceof Error ? saveError.message : "Failed to save preferences.");
      });
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Reminder Preferences</h2>
      <p className="mt-2 text-sm text-muted">
        Configure how and when the assistant nudges you about your schedule and upcoming work.
      </p>

      <div className="mt-6 space-y-3">
        {/* Daily summary toggle */}
        <button
          type="button"
          onClick={() => togglePreference("dailySummaryEnabled")}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:bg-surface"
        >
          <span>
            <span className="block text-sm font-medium text-foreground">Daily summary</span>
            <span className="block text-xs text-muted mt-0.5">
              {preferences.dailySummaryEnabled
                ? `Enabled at ${preferences.dailySummaryTime ?? "a saved time"}`
                : "Off"}
            </span>
          </span>
          <TogglePill on={preferences.dailySummaryEnabled} />
        </button>

        {/* Tonight summary toggle */}
        <button
          type="button"
          onClick={() => togglePreference("tonightSummaryEnabled")}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:bg-surface"
        >
          <span>
            <span className="block text-sm font-medium text-foreground">Tonight summary</span>
            <span className="block text-xs text-muted mt-0.5">
              {preferences.tonightSummaryEnabled
                ? `Enabled at ${preferences.tonightSummaryTime ?? "a saved time"}`
                : "Off"}
            </span>
          </span>
          <TogglePill on={preferences.tonightSummaryEnabled} />
        </button>

        {/* Due soon reminders toggle */}
        <button
          type="button"
          onClick={() => togglePreference("dueSoonRemindersEnabled")}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:bg-surface"
        >
          <span>
            <span className="block text-sm font-medium text-foreground">Due soon reminders</span>
            <span className="block text-xs text-muted mt-0.5">
              {preferences.dueSoonRemindersEnabled
                ? `${preferences.dueSoonHoursBefore ?? 0} hours before due dates`
                : "Off"}
            </span>
          </span>
          <TogglePill on={preferences.dueSoonRemindersEnabled} />
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-background p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Current summary</p>
        <p className="mt-2 text-sm leading-6 text-foreground">
          {buildReminderPreferenceSummary(preferences)}
        </p>
      </div>

      {saved && (
        <p className="mt-3 text-xs font-medium text-accent-green-foreground">
          Saved
        </p>
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
        on
          ? "bg-accent-green text-accent-green-foreground"
          : "bg-surface text-muted"
      }`}
    >
      {on ? "On" : "Off"}
    </span>
  );
}
