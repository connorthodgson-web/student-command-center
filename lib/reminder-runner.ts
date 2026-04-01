import { appendAssistantSessionEvent, appendAssistantSessionMessage, ensureAssistantSession } from "./assistant-sessions";
import { mapDbAutomation, type DbAutomationRow } from "./automations-data";
import { formatPlanningItemWindow, isPlanningItemOnDate, mapDbPlanningItem, type DbPlanningItemRow } from "./planning-items";
import { DEFAULT_REMINDER_PREFERENCES, mapDbReminderPreference, mergeReminderPreferenceWithDefaults, type DbReminderPreferenceRow } from "./reminder-preferences-data";
import { resolvePreferredSmsEndpoint, sendReminderMessageToUser } from "./messaging-service";
import { createAdminClient } from "./supabase/admin";
import { mapDbTaskToStudentTask, type DbTaskRow } from "./tasks-data";
import type { Automation, MessagingMessage, ReminderPreference } from "../types";

type ReminderKind = "daily_summary" | "tonight_summary" | "due_soon";
type DeliveryChannel = "in_app" | "sms";
type DeliveryStatus = "processing" | "sent" | "skipped" | "failed";

type ReminderRunOptions = {
  at?: string;
  timezone?: string;
  force?: boolean;
  kinds?: ReminderKind[];
  userId?: string;
};

type ReminderRunCandidate = {
  userId: string;
  kind: ReminderKind;
  scheduledFor: string;
  dedupeKey: string;
  preferredChannel: DeliveryChannel;
  content: string;
  taskId?: string;
  automationId?: string;
  metadata: Record<string, unknown>;
};

type ReminderRunRecord = {
  id: string;
  user_id: string;
  reminder_kind: ReminderKind;
  dedupe_key: string;
  scheduled_for: string;
  task_id: string | null;
  automation_id: string | null;
  delivery_channel: DeliveryChannel;
  delivery_target: string | null;
  delivery_status: DeliveryStatus;
  content: string | null;
  reason: string | null;
  provider_message_id: string | null;
  messaging_message_id: string | null;
  metadata: Record<string, unknown> | null;
  attempted_at: string;
  created_at: string;
};

type ReminderLogEntry = {
  id: string;
  userId: string;
  reminderKind: ReminderKind;
  dedupeKey: string;
  scheduledFor: string;
  taskId?: string;
  automationId?: string;
  deliveryChannel: DeliveryChannel;
  deliveryTarget?: string;
  deliveryStatus: DeliveryStatus;
  content?: string;
  reason?: string;
  providerMessageId?: string;
  messagingMessageId?: string;
  metadata: Record<string, unknown>;
  attemptedAt: string;
  createdAt: string;
};

type ReminderRunResult = {
  dedupeKey: string;
  userId: string;
  reminderKind: ReminderKind;
  deliveryStatus: "sent" | "skipped" | "failed" | "duplicate";
  deliveryChannel: DeliveryChannel;
  reason?: string;
  taskId?: string;
  automationId?: string;
  deliveryTarget?: string;
  logId?: string;
};

type UserReminderConfig = {
  userId: string;
  preferences: ReminderPreference;
  automations: Automation[];
};

type UserReminderContext = {
  tasks: ReturnType<typeof mapDbTaskToStudentTask>[];
  planningItems: ReturnType<typeof mapDbPlanningItem>[];
  classNamesById: Map<string, string>;
};

type DeliveryResolution =
  | { ok: true; channel: "in_app"; targetLabel: "assistant_inbox"; messageId: string }
  | { ok: true; channel: "sms"; targetLabel: string; messageId?: string; providerMessageId?: string; deliveryStatus: MessagingMessage["deliveryStatus"] }
  | { ok: false; channel: DeliveryChannel; reason: string; targetLabel?: string };

function getAdminSupabase() {
  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error(
      "Supabase admin access is not configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return supabase;
}

function mapReminderRunRecord(row: ReminderRunRecord): ReminderLogEntry {
  return {
    id: row.id,
    userId: row.user_id,
    reminderKind: row.reminder_kind,
    dedupeKey: row.dedupe_key,
    scheduledFor: row.scheduled_for,
    taskId: row.task_id ?? undefined,
    automationId: row.automation_id ?? undefined,
    deliveryChannel: row.delivery_channel,
    deliveryTarget: row.delivery_target ?? undefined,
    deliveryStatus: row.delivery_status,
    content: row.content ?? undefined,
    reason: row.reason ?? undefined,
    providerMessageId: row.provider_message_id ?? undefined,
    messagingMessageId: row.messaging_message_id ?? undefined,
    metadata: row.metadata ?? {},
    attemptedAt: row.attempted_at,
    createdAt: row.created_at,
  };
}

function assertValidDate(value: Date, fieldName: string) {
  if (Number.isNaN(value.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO timestamp.`);
  }
}

function getRunnerTimezone(preferred?: string) {
  return (
    preferred?.trim() ||
    process.env.REMINDER_RUNNER_TIMEZONE?.trim() ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC"
  );
}

function getLocalParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: lookup.get("year") ?? "0000",
    month: lookup.get("month") ?? "01",
    day: lookup.get("day") ?? "01",
    hour: lookup.get("hour") ?? "00",
    minute: lookup.get("minute") ?? "00",
    weekday: (lookup.get("weekday") ?? "monday").toLowerCase(),
  };
}

function getLocalDateKey(date: Date, timeZone: string) {
  const parts = getLocalParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getLocalTimeKey(date: Date, timeZone: string) {
  const parts = getLocalParts(date, timeZone);
  return `${parts.hour}:${parts.minute}`;
}

function offsetDateByDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizeTimeString(value: unknown, fallback: string) {
  if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

function readSummaryTime(automation: Automation, fallback: string) {
  const config = automation.scheduleConfig ?? {};
  if (typeof config.time === "string") return normalizeTimeString(config.time, fallback);
  if (typeof config.timeOfDay === "string") return normalizeTimeString(config.timeOfDay, fallback);
  if (typeof config.at === "string") return normalizeTimeString(config.at, fallback);

  const hour = typeof config.hour === "number" ? config.hour : null;
  const minute = typeof config.minute === "number" ? config.minute : null;
  if (hour !== null && minute !== null && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  return fallback;
}

function readDueSoonHours(automation: Automation, fallback: number) {
  const config = automation.scheduleConfig ?? {};
  const numericCandidates = [
    config.hoursBefore,
    config.dueSoonHoursBefore,
    config.leadHours,
    config.hours,
    config.leadTimeHours,
  ];

  for (const candidate of numericCandidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return Math.max(1, Math.round(candidate));
    }
  }

  const dayCandidates = [config.daysBefore, config.leadDays];
  for (const candidate of dayCandidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return Math.max(1, Math.round(candidate * 24));
    }
  }

  return fallback;
}

function summarizeTaskTitles(tasks: UserReminderContext["tasks"], classNamesById: Map<string, string>, limit = 3) {
  return tasks.slice(0, limit).map((task) => {
    const className = task.classId ? classNamesById.get(task.classId) : null;
    return className ? `${task.title} (${className})` : task.title;
  });
}

function formatDateTimeForTimezone(dateInput: string, timeZone: string) {
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function buildDailySummaryContent(context: UserReminderContext, now: Date, timeZone: string) {
  const todayKey = getLocalDateKey(now, timeZone);
  const todayTasks = context.tasks.filter((task) => task.dueAt && getLocalDateKey(new Date(task.dueAt), timeZone) === todayKey);
  const overdueTasks = context.tasks.filter((task) => task.dueAt && new Date(task.dueAt).getTime() < now.getTime() && getLocalDateKey(new Date(task.dueAt), timeZone) < todayKey);
  const todayActivities = context.planningItems.filter((item) => isPlanningItemOnDate(item, now));

  const lines = ["Good morning. Here is your Student Command Center summary for today:"];

  if (overdueTasks.length > 0) {
    lines.push(`Overdue to clear first: ${summarizeTaskTitles(overdueTasks, context.classNamesById).join(", ")}.`);
  }

  if (todayTasks.length > 0) {
    lines.push(`Due today: ${summarizeTaskTitles(todayTasks, context.classNamesById).join(", ")}.`);
  } else {
    lines.push("No assignments are due today right now.");
  }

  if (todayActivities.length > 0) {
    const activities = todayActivities.slice(0, 3).map((item) => `${item.title} (${formatPlanningItemWindow(item)})`);
    lines.push(`On your schedule: ${activities.join(", ")}.`);
  }

  lines.push("Reply if you want help turning this into a plan.");
  return lines.join(" ");
}

function buildTonightSummaryContent(context: UserReminderContext, now: Date, timeZone: string) {
  const tomorrow = offsetDateByDays(now, 1);
  const tomorrowKey = getLocalDateKey(tomorrow, timeZone);
  const upcomingLimit = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const tomorrowTasks = context.tasks.filter((task) => task.dueAt && getLocalDateKey(new Date(task.dueAt), timeZone) === tomorrowKey);
  const nextThreeDays = context.tasks.filter((task) => {
    if (!task.dueAt) return false;
    const due = new Date(task.dueAt);
    return due.getTime() > now.getTime() && due.getTime() <= upcomingLimit.getTime();
  });
  const tomorrowActivities = context.planningItems.filter((item) => isPlanningItemOnDate(item, tomorrow));

  const lines = ["Tonight's summary from Student Command Center:"];

  if (tomorrowTasks.length > 0) {
    lines.push(`Coming up tomorrow: ${summarizeTaskTitles(tomorrowTasks, context.classNamesById).join(", ")}.`);
  } else if (nextThreeDays.length > 0) {
    lines.push(`Next up: ${summarizeTaskTitles(nextThreeDays, context.classNamesById).join(", ")}.`);
  } else {
    lines.push("Nothing urgent is showing up in the next few days.");
  }

  if (tomorrowActivities.length > 0) {
    const activities = tomorrowActivities.slice(0, 3).map((item) => `${item.title} (${formatPlanningItemWindow(item)})`);
    lines.push(`Tomorrow also includes: ${activities.join(", ")}.`);
  }

  lines.push("If you want, I can help you prep tonight.");
  return lines.join(" ");
}

function buildDueSoonContent(task: UserReminderContext["tasks"][number], classNamesById: Map<string, string>, timeZone: string) {
  const className = task.classId ? classNamesById.get(task.classId) : null;
  const dueText = task.dueAt ? formatDateTimeForTimezone(task.dueAt, timeZone) : "soon";
  const classText = className ? ` for ${className}` : "";
  return `Reminder: ${task.title}${classText} is due ${dueText}. Reply if you want help breaking it down.`;
}

async function loadUserReminderConfigs(userId?: string) {
  const supabase = getAdminSupabase();
  let preferenceQuery = supabase
    .from("reminder_preferences")
    .select("*")
    .or("daily_summary_enabled.eq.true,tonight_summary_enabled.eq.true,due_soon_reminders_enabled.eq.true");

  let automationQuery = supabase
    .from("automations")
    .select("*")
    .eq("enabled", true)
    .in("type", ["morning_summary", "tonight_summary", "due_soon"]);

  if (userId) {
    preferenceQuery = preferenceQuery.eq("user_id", userId);
    automationQuery = automationQuery.eq("user_id", userId);
  }

  const [{ data: preferenceRows, error: preferenceError }, { data: automationRows, error: automationError }] = await Promise.all([
    preferenceQuery,
    automationQuery,
  ]);

  if (preferenceError) throw new Error(preferenceError.message);
  if (automationError) throw new Error(automationError.message);

  const configs = new Map<string, UserReminderConfig>();

  for (const row of (preferenceRows ?? []) as DbReminderPreferenceRow[]) {
    const preferences = mergeReminderPreferenceWithDefaults(mapDbReminderPreference(row));
    configs.set(row.user_id, {
      userId: row.user_id,
      preferences,
      automations: configs.get(row.user_id)?.automations ?? [],
    });
  }

  for (const row of (automationRows ?? []) as DbAutomationRow[]) {
    const automation = mapDbAutomation(row);
    const existing = configs.get(row.user_id);
    if (existing) {
      existing.automations.push(automation);
      continue;
    }

    configs.set(row.user_id, {
      userId: row.user_id,
      preferences: { ...DEFAULT_REMINDER_PREFERENCES, userId: row.user_id },
      automations: [automation],
    });
  }

  return Array.from(configs.values());
}

async function loadUserReminderContext(userId: string) {
  const supabase = getAdminSupabase();
  const [{ data: taskRows, error: taskError }, { data: classRows, error: classError }, { data: planningRows, error: planningError }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .neq("status", "done")
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("classes")
      .select("id, name")
      .eq("user_id", userId),
    supabase
      .from("planning_items")
      .select("*")
      .eq("user_id", userId)
      .eq("enabled", true),
  ]);

  if (taskError) throw new Error(taskError.message);
  if (classError) throw new Error(classError.message);
  if (planningError) throw new Error(planningError.message);

  return {
    tasks: ((taskRows ?? []) as DbTaskRow[]).map(mapDbTaskToStudentTask),
    planningItems: ((planningRows ?? []) as DbPlanningItemRow[]).map(mapDbPlanningItem),
    classNamesById: new Map(
      ((classRows ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]),
    ),
  } satisfies UserReminderContext;
}

function buildSummaryCandidates(config: UserReminderConfig, context: UserReminderContext, now: Date, timeZone: string, force: boolean) {
  const candidates: ReminderRunCandidate[] = [];
  const localDate = getLocalDateKey(now, timeZone);
  const localTime = getLocalTimeKey(now, timeZone);

  const morningSources: Array<{ automationId?: string }> = [];
  if (config.preferences.dailySummaryEnabled && (force || localTime === (config.preferences.dailySummaryTime ?? "07:00"))) {
    morningSources.push({});
  }

  for (const automation of config.automations.filter((item) => item.type === "morning_summary")) {
    if (force || localTime === readSummaryTime(automation, config.preferences.dailySummaryTime ?? "07:00")) {
      morningSources.push({ automationId: automation.id });
    }
  }

  if (morningSources.length > 0) {
    candidates.push({
      userId: config.userId,
      kind: "daily_summary",
      scheduledFor: now.toISOString(),
      dedupeKey: `${config.userId}:daily_summary:${localDate}:${localTime}`,
      preferredChannel: config.preferences.deliveryChannel,
      content: buildDailySummaryContent(context, now, timeZone),
      automationId: morningSources[0]?.automationId,
      metadata: {
        source: morningSources.some((item) => !item.automationId) ? "preferences_or_automation" : "automation",
        automationIds: morningSources.map((item) => item.automationId).filter(Boolean),
        localDate,
        localTime,
        timeZone,
      },
    });
  }

  const tonightSources: Array<{ automationId?: string }> = [];
  if (config.preferences.tonightSummaryEnabled && (force || localTime === (config.preferences.tonightSummaryTime ?? "19:00"))) {
    tonightSources.push({});
  }

  for (const automation of config.automations.filter((item) => item.type === "tonight_summary")) {
    if (force || localTime === readSummaryTime(automation, config.preferences.tonightSummaryTime ?? "19:00")) {
      tonightSources.push({ automationId: automation.id });
    }
  }

  if (tonightSources.length > 0) {
    candidates.push({
      userId: config.userId,
      kind: "tonight_summary",
      scheduledFor: now.toISOString(),
      dedupeKey: `${config.userId}:tonight_summary:${localDate}:${localTime}`,
      preferredChannel: config.preferences.deliveryChannel,
      content: buildTonightSummaryContent(context, now, timeZone),
      automationId: tonightSources[0]?.automationId,
      metadata: {
        source: tonightSources.some((item) => !item.automationId) ? "preferences_or_automation" : "automation",
        automationIds: tonightSources.map((item) => item.automationId).filter(Boolean),
        localDate,
        localTime,
        timeZone,
      },
    });
  }

  return candidates;
}

function buildDueSoonCandidates(config: UserReminderConfig, context: UserReminderContext, now: Date, timeZone: string) {
  const windows = new Map<string, { hoursBefore: number; automationId?: string }>();

  if (config.preferences.dueSoonRemindersEnabled) {
    const hoursBefore = config.preferences.dueSoonHoursBefore ?? 6;
    windows.set(`legacy:${hoursBefore}`, { hoursBefore });
  }

  for (const automation of config.automations.filter((item) => item.type === "due_soon")) {
    const hoursBefore = readDueSoonHours(automation, config.preferences.dueSoonHoursBefore ?? 6);
    windows.set(`${automation.relatedTaskId ?? automation.relatedClassId ?? automation.id}:${hoursBefore}`, {
      hoursBefore,
      automationId: automation.id,
    });
  }

  const candidates: ReminderRunCandidate[] = [];

  for (const { hoursBefore, automationId } of windows.values()) {
    const dueWindowEnd = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);
    const eligibleTasks = context.tasks.filter((task) => {
      if (!task.dueAt) return false;
      const dueAt = new Date(task.dueAt);
      if (dueAt.getTime() <= now.getTime() || dueAt.getTime() > dueWindowEnd.getTime()) return false;

      if (!automationId) return true;
      const automation = config.automations.find((item) => item.id === automationId);
      if (!automation) return true;
      if (automation.relatedTaskId && automation.relatedTaskId !== task.id) return false;
      if (automation.relatedClassId && automation.relatedClassId !== task.classId) return false;
      return true;
    });

    for (const task of eligibleTasks) {
      if (!task.dueAt) continue;
      candidates.push({
        userId: config.userId,
        kind: "due_soon",
        scheduledFor: task.dueAt,
        dedupeKey: `${config.userId}:due_soon:${task.id}:${task.dueAt}:${hoursBefore}`,
        preferredChannel: config.preferences.deliveryChannel,
        content: buildDueSoonContent(task, context.classNamesById, timeZone),
        taskId: task.id,
        automationId,
        metadata: {
          hoursBefore,
          dueAt: task.dueAt,
          taskTitle: task.title,
          timeZone,
        },
      });
    }
  }

  return candidates;
}

async function claimReminderRun(candidate: ReminderRunCandidate) {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("reminder_delivery_runs")
    .insert({
      user_id: candidate.userId,
      reminder_kind: candidate.kind,
      dedupe_key: candidate.dedupeKey,
      scheduled_for: candidate.scheduledFor,
      task_id: candidate.taskId ?? null,
      automation_id: candidate.automationId ?? null,
      delivery_channel: candidate.preferredChannel,
      delivery_status: "processing",
      content: candidate.content,
      metadata: candidate.metadata,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { claimed: false as const };
    }
    throw new Error(error.message);
  }

  return {
    claimed: true as const,
    record: mapReminderRunRecord(data as ReminderRunRecord),
  };
}

async function finalizeReminderRun(
  logId: string,
  input: {
    deliveryStatus: Exclude<ReminderRunResult["deliveryStatus"], "duplicate">;
    deliveryTarget?: string;
    reason?: string;
    providerMessageId?: string;
    messagingMessageId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from("reminder_delivery_runs")
    .update({
      delivery_status: input.deliveryStatus,
      delivery_target: input.deliveryTarget ?? null,
      reason: input.reason ?? null,
      provider_message_id: input.providerMessageId ?? null,
      messaging_message_id: input.messagingMessageId ?? null,
      metadata: input.metadata ?? {},
      attempted_at: new Date().toISOString(),
    })
    .eq("id", logId);

  if (error) {
    throw new Error(error.message);
  }
}

async function deliverInAppReminder(candidate: ReminderRunCandidate) {
  const supabase = getAdminSupabase();
  const session = await ensureAssistantSession(supabase, candidate.userId, {
    channel: "mobile",
    title: "Reminder Inbox",
    metadata: {
      source: "scheduled_reminders",
    },
  });

  const message = await appendAssistantSessionMessage(supabase, {
    sessionId: session.session.id,
    userId: candidate.userId,
    role: "assistant",
    contentType: "text",
    content: candidate.content,
    metadata: {
      source: "scheduled_reminder",
      reminderKind: candidate.kind,
      taskId: candidate.taskId,
      automationId: candidate.automationId,
      dedupeKey: candidate.dedupeKey,
    },
  });

  await appendAssistantSessionEvent(supabase, {
    sessionId: session.session.id,
    userId: candidate.userId,
    eventType: "message_added",
    metadata: {
      source: "scheduled_reminder",
      reminderKind: candidate.kind,
      taskId: candidate.taskId,
    },
  });

  return {
    ok: true as const,
    channel: "in_app" as const,
    targetLabel: "assistant_inbox" as const,
    messageId: message.id,
  };
}

async function resolveAndDeliver(candidate: ReminderRunCandidate): Promise<DeliveryResolution> {
  if (candidate.preferredChannel === "in_app") {
    return deliverInAppReminder(candidate);
  }

  const endpoint = await resolvePreferredSmsEndpoint(candidate.userId);
  if (!endpoint) {
    return {
      ok: false,
      channel: "sms",
      reason: "No active verified preferred SMS endpoint is available.",
    };
  }

  const result = await sendReminderMessageToUser(candidate.userId, candidate.content);
  if (!result.delivered || result.channel !== "sms") {
    return {
      ok: false,
      channel: "sms",
      targetLabel: endpoint.address,
      reason: result.reason ?? "SMS delivery is not available for this user.",
    };
  }

  if (result.message.deliveryStatus === "failed") {
    return {
      ok: false,
      channel: "sms",
      targetLabel: endpoint.address,
      reason: result.message.errorMessage ?? "The messaging provider reported a failed send.",
    };
  }

  return {
    ok: true,
    channel: "sms",
    targetLabel: endpoint.address,
    messageId: result.message.id,
    providerMessageId: result.message.providerMessageId,
    deliveryStatus: result.message.deliveryStatus,
  };
}

export async function listReminderDeliveryRuns(options: { userId?: string; limit?: number } = {}) {
  const supabase = getAdminSupabase();
  let query = supabase
    .from("reminder_delivery_runs")
    .select("*")
    .order("attempted_at", { ascending: false })
    .limit(Math.min(Math.max(options.limit ?? 50, 1), 200));

  if (options.userId) {
    query = query.eq("user_id", options.userId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ReminderRunRecord[]).map(mapReminderRunRecord);
}

export async function runReminderRunner(options: ReminderRunOptions = {}) {
  const now = options.at ? new Date(options.at) : new Date();
  assertValidDate(now, "at");

  const timeZone = getRunnerTimezone(options.timezone);
  const force = Boolean(options.force);
  const requestedKinds = options.kinds?.length
    ? new Set(options.kinds)
    : new Set<ReminderKind>(["daily_summary", "tonight_summary", "due_soon"]);

  const configs = await loadUserReminderConfigs(options.userId);
  const candidates: ReminderRunCandidate[] = [];

  for (const config of configs) {
    const context = await loadUserReminderContext(config.userId);

    if (requestedKinds.has("daily_summary") || requestedKinds.has("tonight_summary")) {
      candidates.push(
        ...buildSummaryCandidates(config, context, now, timeZone, force).filter((candidate) =>
          requestedKinds.has(candidate.kind),
        ),
      );
    }

    if (requestedKinds.has("due_soon")) {
      candidates.push(...buildDueSoonCandidates(config, context, now, timeZone));
    }
  }

  const results: ReminderRunResult[] = [];

  for (const candidate of candidates) {
    const claim = await claimReminderRun(candidate);
    if (!claim.claimed) {
      results.push({
        dedupeKey: candidate.dedupeKey,
        userId: candidate.userId,
        reminderKind: candidate.kind,
        deliveryStatus: "duplicate",
        deliveryChannel: candidate.preferredChannel,
        taskId: candidate.taskId,
        automationId: candidate.automationId,
        reason: "This reminder was already claimed in an earlier run.",
      });
      continue;
    }

    try {
      const delivery = await resolveAndDeliver(candidate);
      if (!delivery.ok) {
        await finalizeReminderRun(claim.record.id, {
          deliveryStatus: "skipped",
          deliveryTarget: delivery.targetLabel,
          reason: delivery.reason,
          metadata: {
            ...candidate.metadata,
            resolvedChannel: delivery.channel,
          },
        });

        results.push({
          dedupeKey: candidate.dedupeKey,
          userId: candidate.userId,
          reminderKind: candidate.kind,
          deliveryStatus: "skipped",
          deliveryChannel: candidate.preferredChannel,
          taskId: candidate.taskId,
          automationId: candidate.automationId,
          deliveryTarget: delivery.targetLabel,
          reason: delivery.reason,
          logId: claim.record.id,
        });
        continue;
      }

      await finalizeReminderRun(claim.record.id, {
        deliveryStatus: "sent",
        deliveryTarget: delivery.targetLabel,
        providerMessageId: delivery.channel === "sms" ? delivery.providerMessageId : undefined,
        messagingMessageId: delivery.messageId,
        metadata: {
          ...candidate.metadata,
          resolvedChannel: delivery.channel,
          providerDeliveryStatus: delivery.channel === "sms" ? delivery.deliveryStatus : undefined,
        },
      });

      results.push({
        dedupeKey: candidate.dedupeKey,
        userId: candidate.userId,
        reminderKind: candidate.kind,
        deliveryStatus: "sent",
        deliveryChannel: candidate.preferredChannel,
        taskId: candidate.taskId,
        automationId: candidate.automationId,
        deliveryTarget: delivery.targetLabel,
        logId: claim.record.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reminder delivery failed.";
      await finalizeReminderRun(claim.record.id, {
        deliveryStatus: "failed",
        reason: message,
        metadata: candidate.metadata,
      });

      results.push({
        dedupeKey: candidate.dedupeKey,
        userId: candidate.userId,
        reminderKind: candidate.kind,
        deliveryStatus: "failed",
        deliveryChannel: candidate.preferredChannel,
        taskId: candidate.taskId,
        automationId: candidate.automationId,
        reason: message,
        logId: claim.record.id,
      });
    }
  }

  const counts = {
    sent: results.filter((item) => item.deliveryStatus === "sent").length,
    skipped: results.filter((item) => item.deliveryStatus === "skipped").length,
    failed: results.filter((item) => item.deliveryStatus === "failed").length,
    duplicate: results.filter((item) => item.deliveryStatus === "duplicate").length,
  };

  return {
    ranAt: now.toISOString(),
    timeZone,
    force,
    scopedUserId: options.userId ?? null,
    candidateCount: candidates.length,
    ...counts,
    results,
  };
}
