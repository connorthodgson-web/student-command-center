import type { ReminderPreference } from "../types";

export const supportedReminderTypes = [
  "daily summary",
  "tonight summary",
  "due soon reminders",
] as const;

export function buildReminderPreferenceSummary(preferences: ReminderPreference) {
  const parts: string[] = [];

  parts.push(
    preferences.dailySummaryEnabled
      ? `Daily summaries are on at ${preferences.dailySummaryTime ?? "a saved time"}.`
      : "Daily summaries are off.",
  );

  parts.push(
    preferences.tonightSummaryEnabled
      ? `Tonight summaries are on at ${preferences.tonightSummaryTime ?? "a saved time"}.`
      : "Tonight summaries are off.",
  );

  parts.push(
    preferences.dueSoonRemindersEnabled
      ? `Due-soon reminders are on ${preferences.dueSoonHoursBefore ?? 0} hours before tasks are due.`
      : "Due-soon reminders are off.",
  );

  parts.push(
    preferences.deliveryChannel === "sms"
      ? "Reminder delivery is set to SMS when a verified texting number is available."
      : "Reminder delivery is set to in-app.",
  );

  return parts.join(" ");
}
