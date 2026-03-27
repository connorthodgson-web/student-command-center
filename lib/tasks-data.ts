import type { StudentTask, TaskSource, TaskStatus, TaskType } from "../types";

const TASK_TYPES: TaskType[] = [
  "assignment",
  "test",
  "quiz",
  "reading",
  "project",
  "study",
];

const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];
const TASK_SOURCES: TaskSource[] = ["manual", "ai-parsed", "chat", "imported"];

export type DbTaskRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  class_id: string | null;
  due_at: string | null;
  status: TaskStatus;
  source: TaskSource;
  type: TaskType | null;
  reminder_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskMutationInput = {
  title?: string;
  description?: string;
  classId?: string;
  dueAt?: string;
  status?: TaskStatus;
  source?: TaskSource;
  type?: TaskType;
  reminderAt?: string;
};

export function mapDbTaskToStudentTask(row: DbTaskRow): StudentTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    classId: row.class_id ?? undefined,
    dueAt: row.due_at ?? undefined,
    status: row.status,
    source: row.source,
    type: row.type ?? undefined,
    reminderAt: row.reminder_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeTaskInput(
  input: TaskMutationInput,
  options: { requireTitle?: boolean } = {},
) {
  const title = input.title?.trim();

  if (options.requireTitle && !title) {
    throw new Error("Task title is required.");
  }

  const payload: Partial<Omit<DbTaskRow, "id" | "user_id" | "created_at" | "updated_at">> = {};

  if ("title" in input) {
    if (!title) {
      throw new Error("Task title cannot be empty.");
    }
    payload.title = title;
  }

  if ("description" in input) {
    payload.description = emptyToNull(input.description);
  }

  if ("classId" in input) {
    payload.class_id = normalizeOptionalString(input.classId);
  }

  if ("dueAt" in input) {
    payload.due_at = normalizeOptionalDateTime(input.dueAt, "dueAt");
  }

  if ("reminderAt" in input) {
    payload.reminder_at = normalizeOptionalDateTime(input.reminderAt, "reminderAt");
  }

  if ("status" in input) {
    if (input.status && !TASK_STATUSES.includes(input.status)) {
      throw new Error("Task status must be todo, in_progress, or done.");
    }
    payload.status = input.status ?? "todo";
  }

  if ("source" in input) {
    if (input.source && !TASK_SOURCES.includes(input.source)) {
      throw new Error("Task source is invalid.");
    }
    payload.source = input.source ?? "manual";
  }

  if ("type" in input) {
    if (input.type && !TASK_TYPES.includes(input.type)) {
      throw new Error("Task type is invalid.");
    }
    payload.type = input.type ?? null;
  }

  return payload;
}

function normalizeOptionalDateTime(value: string | undefined, fieldName: string) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date/time.`);
  }

  return date.toISOString();
}

function normalizeOptionalString(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function emptyToNull(value: string | undefined) {
  return normalizeOptionalString(value);
}
