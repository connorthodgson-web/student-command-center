import type { PlanningItem, PlanningItemKind, Weekday } from "../types";

export type DbPlanningItemRow = {
  id: string;
  user_id: string;
  kind: PlanningItemKind;
  title: string;
  days_of_week: Weekday[] | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  is_all_day: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type PlanningItemInsert = Omit<PlanningItem, "id" | "userId" | "createdAt" | "updatedAt">;
export type PlanningItemUpdate = {
  kind?: PlanningItemKind;
  title?: string;
  daysOfWeek?: Weekday[] | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  notes?: string | null;
  isAllDay?: boolean;
  enabled?: boolean;
};

export function mapDbPlanningItem(row: DbPlanningItemRow): PlanningItem {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    title: row.title,
    daysOfWeek: row.days_of_week ?? undefined,
    date: row.date ?? undefined,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    location: row.location ?? undefined,
    notes: row.notes ?? undefined,
    isAllDay: row.is_all_day,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type PlanningItemInputShape = {
  kind?: PlanningItemKind | null;
  title?: string | null;
  daysOfWeek?: Weekday[] | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  notes?: string | null;
  isAllDay?: boolean;
  enabled?: boolean;
};

export function normalizePlanningItemInput<T extends PlanningItemInputShape>(
  input: T,
  options: { requireTitle?: boolean; requireKind?: boolean } = {},
): T {
  const next = { ...input } as T;

  if ("title" in next) {
    const trimmed = typeof next.title === "string" ? next.title.trim() : "";
    if (options.requireTitle && !trimmed) {
      throw new Error("Item title is required.");
    }
    if (!trimmed) {
      throw new Error("Item title cannot be empty.");
    }
    next.title = trimmed as T["title"];
  }

  if ("kind" in next) {
    if (!next.kind && options.requireKind) {
      throw new Error("Item kind is required.");
    }
    if (next.kind && next.kind !== "recurring_activity" && next.kind !== "one_off_event") {
      throw new Error(`Unsupported planning item kind: ${next.kind}.`);
    }
  }

  if ("daysOfWeek" in next && next.daysOfWeek) {
    next.daysOfWeek = normalizeWeekdays(next.daysOfWeek) as T["daysOfWeek"];
  }

  if ("startTime" in next && next.startTime !== undefined && next.startTime !== null) {
    next.startTime = normalizeOptionalTime(next.startTime, "startTime") as T["startTime"];
  }

  if ("endTime" in next && next.endTime !== undefined && next.endTime !== null) {
    next.endTime = normalizeOptionalTime(next.endTime, "endTime") as T["endTime"];
  }

  validateCrossFieldRules(next);

  return next;
}

export function mapPlanningItemToInsert(
  item: PlanningItemInsert,
  userId: string,
): Partial<Omit<DbPlanningItemRow, "id" | "created_at" | "updated_at">> {
  const normalized = normalizePlanningItemInput(item, {
    requireTitle: true,
    requireKind: true,
  });

  if (normalized.kind === "recurring_activity" && !(normalized.daysOfWeek?.length)) {
    throw new Error("Recurring activities need at least one weekday.");
  }

  if (normalized.kind === "one_off_event" && !normalized.date) {
    throw new Error("One-off events need a date.");
  }

  return {
    user_id: userId,
    kind: normalized.kind,
    title: normalized.title,
    days_of_week: normalized.daysOfWeek?.length ? normalized.daysOfWeek : null,
    date: normalized.date ?? null,
    start_time: normalized.startTime ?? null,
    end_time: normalized.endTime ?? null,
    location: emptyToNull(normalized.location),
    notes: emptyToNull(normalized.notes),
    is_all_day: normalized.isAllDay ?? false,
    enabled: normalized.enabled ?? true,
  };
}

export function mapPlanningItemToUpdate(updates: PlanningItemUpdate) {
  const normalized = normalizePlanningItemInput(updates);
  const payload: Partial<
    Omit<DbPlanningItemRow, "id" | "user_id" | "created_at" | "updated_at">
  > = {};

  if ("kind" in normalized && normalized.kind) {
    payload.kind = normalized.kind;
  }
  if ("title" in normalized && normalized.title !== undefined) {
    payload.title = normalized.title;
  }
  if ("daysOfWeek" in normalized) {
    payload.days_of_week = normalized.daysOfWeek?.length ? normalized.daysOfWeek : null;
  }
  if ("date" in normalized) {
    payload.date = normalized.date ?? null;
  }
  if ("startTime" in normalized) {
    payload.start_time = normalized.startTime ?? null;
  }
  if ("endTime" in normalized) {
    payload.end_time = normalized.endTime ?? null;
  }
  if ("location" in normalized) {
    payload.location = emptyToNull(normalized.location);
  }
  if ("notes" in normalized) {
    payload.notes = emptyToNull(normalized.notes);
  }
  if ("isAllDay" in normalized && normalized.isAllDay !== undefined) {
    payload.is_all_day = Boolean(normalized.isAllDay);
  }
  if ("enabled" in normalized && normalized.enabled !== undefined) {
    payload.enabled = Boolean(normalized.enabled);
  }

  return payload;
}

export function isPlanningItemOnDate(item: PlanningItem, date: Date) {
  if (!item.enabled) return false;

  if (item.kind === "recurring_activity") {
    const weekday = getWeekday(date);
    return Boolean(item.daysOfWeek?.includes(weekday));
  }

  return item.date === toDateString(date);
}

export function formatPlanningItemWindow(item: Pick<PlanningItem, "isAllDay" | "startTime" | "endTime">) {
  if (item.isAllDay) return "All day";
  if (item.startTime && item.endTime) return `${item.startTime}-${item.endTime}`;
  if (item.startTime) return item.startTime;
  return "Time not set";
}

function validateCrossFieldRules(input: PlanningItemInputShape) {
  if (input.kind === "recurring_activity") {
    if ("date" in input && input.date) {
      throw new Error("Recurring activities should not include a specific date.");
    }
    if ("daysOfWeek" in input && (!input.daysOfWeek || input.daysOfWeek.length === 0)) {
      throw new Error("Recurring activities need at least one weekday.");
    }
  }

  if (input.kind === "one_off_event") {
    if ("date" in input && !input.date) {
      throw new Error("One-off events need a date.");
    }
  }

  if (input.startTime && input.endTime && input.startTime >= input.endTime) {
    throw new Error("startTime must be before endTime.");
  }
}

function normalizeWeekdays(days: Weekday[]) {
  const allowed: Weekday[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  const unique = Array.from(new Set(days));
  for (const day of unique) {
    if (!allowed.includes(day)) {
      throw new Error(`Invalid weekday: ${day}.`);
    }
  }
  return unique;
}

function normalizeOptionalTime(value: string, fieldName: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    throw new Error(`${fieldName} must use HH:MM format.`);
  }
  const [hours, minutes] = trimmed.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`${fieldName} must be a valid time.`);
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function emptyToNull(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getWeekday(date: Date): Weekday {
  const days: Weekday[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return days[date.getDay()];
}

function toDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}
