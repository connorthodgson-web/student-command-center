import type { Automation } from "../types";

export type DbAutomationRow = {
  id: string;
  user_id: string;
  type: Automation["type"];
  title: string;
  schedule_description: string;
  schedule_config: Record<string, unknown> | null;
  enabled: boolean;
  delivery_channel: Automation["deliveryChannel"] | null;
  related_class_id: string | null;
  related_task_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationInsert = Omit<Automation, "id" | "userId" | "createdAt" | "updatedAt">;
export type AutomationUpdate = Partial<AutomationInsert>;

export function mapDbAutomation(row: DbAutomationRow): Automation {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    scheduleDescription: row.schedule_description,
    scheduleConfig: row.schedule_config ?? {},
    enabled: row.enabled,
    deliveryChannel: row.delivery_channel ?? "in_app",
    relatedClassId: row.related_class_id ?? undefined,
    relatedTaskId: row.related_task_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeAutomationInput<T extends Partial<AutomationInsert>>(
  input: T,
  options: { requireTitle?: boolean; requireType?: boolean } = {},
): T {
  const next = { ...input } as T;

  if ("title" in next) {
    const trimmed = typeof next.title === "string" ? next.title.trim() : "";
    if (options.requireTitle && !trimmed) {
      throw new Error("Automation title is required.");
    }
    if (!trimmed) {
      throw new Error("Automation title cannot be empty.");
    }
    next.title = trimmed as T["title"];
  }

  if ("type" in next) {
    if (!next.type && options.requireType) {
      throw new Error("Automation type is required.");
    }
    if (
      next.type &&
      ![
        "tonight_summary",
        "morning_summary",
        "due_soon",
        "study_reminder",
        "class_reminder",
        "custom",
      ].includes(next.type)
    ) {
      throw new Error(`Unsupported automation type: ${next.type}.`);
    }
  }

  if ("scheduleDescription" in next) {
    const trimmed =
      typeof next.scheduleDescription === "string"
        ? next.scheduleDescription.trim()
        : "";
    if (!trimmed) {
      throw new Error("scheduleDescription is required.");
    }
    next.scheduleDescription = trimmed as T["scheduleDescription"];
  }

  if ("deliveryChannel" in next) {
    next.deliveryChannel = normalizeDeliveryChannel(next.deliveryChannel) as T["deliveryChannel"];
  }

  if ("scheduleConfig" in next && next.scheduleConfig !== undefined) {
    if (
      next.scheduleConfig === null ||
      typeof next.scheduleConfig !== "object" ||
      Array.isArray(next.scheduleConfig)
    ) {
      throw new Error("scheduleConfig must be an object.");
    }
  }

  return next;
}

export function mapAutomationToInsert(
  automation: AutomationInsert,
  userId: string,
): Partial<Omit<DbAutomationRow, "id" | "created_at" | "updated_at">> {
  const normalized = normalizeAutomationInput(automation, {
    requireTitle: true,
    requireType: true,
  });

  if (!normalized.scheduleDescription) {
    throw new Error("scheduleDescription is required.");
  }

  return {
    user_id: userId,
    type: normalized.type,
    title: normalized.title,
    schedule_description: normalized.scheduleDescription,
    schedule_config: normalized.scheduleConfig ?? {},
    enabled: normalized.enabled ?? true,
    delivery_channel: normalized.deliveryChannel ?? "in_app",
    related_class_id: normalized.relatedClassId ?? null,
    related_task_id: normalized.relatedTaskId ?? null,
  };
}

export function mapAutomationToUpdate(updates: AutomationUpdate) {
  const normalized = normalizeAutomationInput(updates);
  const payload: Partial<
    Omit<DbAutomationRow, "id" | "user_id" | "created_at" | "updated_at">
  > = {};

  if ("type" in normalized && normalized.type) {
    payload.type = normalized.type;
  }
  if ("title" in normalized && normalized.title !== undefined) {
    payload.title = normalized.title;
  }
  if ("scheduleDescription" in normalized && normalized.scheduleDescription !== undefined) {
    payload.schedule_description = normalized.scheduleDescription;
  }
  if ("scheduleConfig" in normalized && normalized.scheduleConfig !== undefined) {
    payload.schedule_config = normalized.scheduleConfig;
  }
  if ("enabled" in normalized && normalized.enabled !== undefined) {
    payload.enabled = Boolean(normalized.enabled);
  }
  if ("deliveryChannel" in normalized && normalized.deliveryChannel !== undefined) {
    payload.delivery_channel = normalized.deliveryChannel;
  }
  if ("relatedClassId" in normalized) {
    payload.related_class_id = normalized.relatedClassId ?? null;
  }
  if ("relatedTaskId" in normalized) {
    payload.related_task_id = normalized.relatedTaskId ?? null;
  }

  return payload;
}

function normalizeDeliveryChannel(
  value: Automation["deliveryChannel"] | undefined,
): Automation["deliveryChannel"] {
  if (!value) return "in_app";
  if (value !== "in_app" && value !== "sms") {
    throw new Error("deliveryChannel must be in_app or sms.");
  }
  return value;
}
