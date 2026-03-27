import type { ReminderPreference } from "../types";

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreference = {
  id: "default",
  dailySummaryEnabled: false,
  dailySummaryTime: "07:00",
  tonightSummaryEnabled: false,
  tonightSummaryTime: "19:00",
  dueSoonRemindersEnabled: false,
  dueSoonHoursBefore: 6,
  deliveryChannel: "in_app",
};

export type DbReminderPreferenceRow = {
  id: string;
  user_id: string;
  daily_summary_enabled: boolean;
  daily_summary_time: string | null;
  tonight_summary_enabled: boolean;
  tonight_summary_time: string | null;
  due_soon_reminders_enabled: boolean;
  due_soon_hours_before: number | null;
  delivery_channel: ReminderPreference["deliveryChannel"] | null;
  created_at: string;
  updated_at: string;
};

export type ReminderPreferenceInput = Partial<
  Pick<
    ReminderPreference,
    | "dailySummaryEnabled"
    | "dailySummaryTime"
    | "tonightSummaryEnabled"
    | "tonightSummaryTime"
    | "dueSoonRemindersEnabled"
    | "dueSoonHoursBefore"
    | "deliveryChannel"
  >
>;

export function mapDbReminderPreference(row: DbReminderPreferenceRow): ReminderPreference {
  return {
    id: row.id,
    userId: row.user_id,
    dailySummaryEnabled: row.daily_summary_enabled,
    dailySummaryTime: row.daily_summary_time ?? undefined,
    tonightSummaryEnabled: row.tonight_summary_enabled,
    tonightSummaryTime: row.tonight_summary_time ?? undefined,
    dueSoonRemindersEnabled: row.due_soon_reminders_enabled,
    dueSoonHoursBefore: row.due_soon_hours_before ?? undefined,
    deliveryChannel: row.delivery_channel ?? "in_app",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeReminderPreferenceInput(input: ReminderPreferenceInput) {
  const payload: Partial<Omit<DbReminderPreferenceRow, "id" | "user_id" | "created_at" | "updated_at">> = {};

  if ("dailySummaryEnabled" in input) {
    payload.daily_summary_enabled = Boolean(input.dailySummaryEnabled);
  }

  if ("dailySummaryTime" in input) {
    payload.daily_summary_time = normalizeOptionalTime(input.dailySummaryTime, "dailySummaryTime");
  }

  if ("tonightSummaryEnabled" in input) {
    payload.tonight_summary_enabled = Boolean(input.tonightSummaryEnabled);
  }

  if ("tonightSummaryTime" in input) {
    payload.tonight_summary_time = normalizeOptionalTime(input.tonightSummaryTime, "tonightSummaryTime");
  }

  if ("dueSoonRemindersEnabled" in input) {
    payload.due_soon_reminders_enabled = Boolean(input.dueSoonRemindersEnabled);
  }

  if ("dueSoonHoursBefore" in input) {
    payload.due_soon_hours_before = normalizeOptionalHours(input.dueSoonHoursBefore);
  }

  if ("deliveryChannel" in input) {
    payload.delivery_channel = normalizeDeliveryChannel(input.deliveryChannel);
  }

  return payload;
}

export function mergeReminderPreferenceWithDefaults(
  value?: Partial<ReminderPreference> | null,
): ReminderPreference {
  return {
    ...DEFAULT_REMINDER_PREFERENCES,
    ...value,
    dailySummaryTime: value?.dailySummaryTime ?? DEFAULT_REMINDER_PREFERENCES.dailySummaryTime,
    tonightSummaryTime:
      value?.tonightSummaryTime ?? DEFAULT_REMINDER_PREFERENCES.tonightSummaryTime,
    dueSoonHoursBefore:
      value?.dueSoonHoursBefore ?? DEFAULT_REMINDER_PREFERENCES.dueSoonHoursBefore,
    deliveryChannel:
      value?.deliveryChannel ?? DEFAULT_REMINDER_PREFERENCES.deliveryChannel,
  };
}

function normalizeOptionalTime(value: string | undefined, fieldName: string) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    throw new Error(`${fieldName} must use HH:MM format.`);
  }
  const [hours, minutes] = trimmed.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`${fieldName} must be a valid time.`);
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeOptionalHours(value: number | undefined) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value < 0 || value > 168) {
    throw new Error("dueSoonHoursBefore must be a whole number between 0 and 168.");
  }
  return value;
}

function normalizeDeliveryChannel(value: ReminderPreference["deliveryChannel"] | undefined) {
  if (!value) return "in_app";
  if (value !== "in_app" && value !== "sms") {
    throw new Error("deliveryChannel must be in_app or sms.");
  }
  return value;
}
