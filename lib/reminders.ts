import type { ReminderPreference } from "../types";

export const supportedReminderTypes = [
  "daily summary",
  "tonight summary",
  "due soon reminders",
] as const;

export function buildReminderPreferenceSummary(preferences: ReminderPreference) {
  const parts: string[] = [];

  parts.push(
    preferences.deliveryChannel === "sms"
      ? "Reminder delivery is set to SMS when a verified texting number is available."
      : "Reminder delivery is set to in-app.",
  );

  if (
    preferences.dailySummaryEnabled ||
    preferences.tonightSummaryEnabled ||
    preferences.dueSoonRemindersEnabled
  ) {
    parts.push(
      "Legacy default reminder fields are still present for compatibility, but recurring reminder rules now belong in Automations.",
    );
  }

  return parts.join(" ");
}
