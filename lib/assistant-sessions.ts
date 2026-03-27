import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssistantEventType,
  AssistantMessageContentType,
  AssistantMessageRole,
  AssistantSession,
  AssistantSessionChannel,
  AssistantSessionEvent,
  AssistantSessionInput,
  AssistantSessionMessage,
  AssistantSessionStatus,
  TutoringContext,
  TutoringMode,
} from "../types";
import {
  mapDbAssistantAttachment,
  type DbAssistantAttachmentRow,
} from "./assistant-attachments";

const SESSION_CHANNELS: AssistantSessionChannel[] = [
  "web_chat",
  "voice",
  "messaging",
  "mobile",
  "tutoring",
];
const SESSION_STATUSES: AssistantSessionStatus[] = ["active", "archived"];
const TUTORING_MODES: TutoringMode[] = [
  "explain",
  "step_by_step",
  "quiz",
  "review",
  "study_plan",
  "homework_help",
];
const MESSAGE_ROLES: AssistantMessageRole[] = ["system", "user", "assistant"];
const CONTENT_TYPES: AssistantMessageContentType[] = [
  "text",
  "voice_transcript",
  "messaging_text",
  "attachment_note",
];
const EVENT_TYPES: AssistantEventType[] = [
  "session_started",
  "message_added",
  "assistant_response_generated",
  "attachment_added",
  "tutoring_session_created",
  "voice_transcript_submitted",
];

export type DbAssistantSessionRow = {
  id: string;
  user_id: string;
  channel: AssistantSessionChannel;
  status: AssistantSessionStatus;
  title: string | null;
  class_id: string | null;
  task_id: string | null;
  tutoring_mode: TutoringMode | null;
  topic: string | null;
  goal: string | null;
  study_focus: string | null;
  tutoring_context: TutoringContext | null;
  metadata: Record<string, unknown> | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DbAssistantSessionMessageRow = {
  id: string;
  session_id: string;
  user_id: string;
  role: AssistantMessageRole;
  content_type: AssistantMessageContentType;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type DbAssistantSessionEventRow = {
  id: string;
  session_id: string;
  user_id: string;
  event_type: AssistantEventType;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export function mapDbAssistantSession(row: DbAssistantSessionRow): AssistantSession {
  return {
    id: row.id,
    userId: row.user_id,
    channel: row.channel,
    status: row.status,
    title: row.title ?? undefined,
    classId: row.class_id ?? undefined,
    taskId: row.task_id ?? undefined,
    tutoringMode: row.tutoring_mode ?? undefined,
    topic: row.topic ?? undefined,
    goal: row.goal ?? undefined,
    studyFocus: row.study_focus ?? undefined,
    tutoringContext: row.tutoring_context ?? undefined,
    metadata: row.metadata ?? undefined,
    lastMessageAt: row.last_message_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDbAssistantSessionMessage(
  row: DbAssistantSessionMessageRow,
  attachments: DbAssistantAttachmentRow[] = [],
): AssistantSessionMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    role: row.role,
    contentType: row.content_type,
    content: row.content,
    metadata: row.metadata ?? undefined,
    attachments: attachments.map(mapDbAssistantAttachment),
    createdAt: row.created_at,
  };
}

export function mapDbAssistantSessionEvent(row: DbAssistantSessionEventRow): AssistantSessionEvent {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    eventType: row.event_type,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
  };
}

export function normalizeAssistantSessionInput(
  input: AssistantSessionInput,
  options: { requireChannel?: boolean } = {},
) {
  const channel = input.channel;
  if (options.requireChannel && (!channel || !SESSION_CHANNELS.includes(channel))) {
    throw new Error("A valid session channel is required.");
  }

  const payload: Record<string, unknown> = {};
  const tutoringMode = input.tutoringMode ?? input.tutoringContext?.mode;
  if (tutoringMode && !TUTORING_MODES.includes(tutoringMode)) {
    throw new Error("Tutoring mode is invalid.");
  }

  if (channel) {
    payload.channel = channel;
  } else if (options.requireChannel) {
    payload.channel = "web_chat";
  }

  if ("title" in input) {
    payload.title = emptyToNull(input.title);
  }
  if ("classId" in input) {
    payload.class_id = emptyToNull(input.classId);
  }
  if ("taskId" in input) {
    payload.task_id = emptyToNull(input.taskId);
  }
  if ("tutoringMode" in input || input.tutoringContext?.mode) {
    payload.tutoring_mode = tutoringMode ?? null;
  }
  if ("topic" in input || "tutoringContext" in input) {
    payload.topic = emptyToNull(input.topic ?? input.tutoringContext?.topic);
  }
  if ("goal" in input || "tutoringContext" in input) {
    payload.goal = emptyToNull(input.goal ?? input.tutoringContext?.goal);
  }
  if ("studyFocus" in input || "tutoringContext" in input) {
    payload.study_focus = emptyToNull(input.studyFocus ?? input.tutoringContext?.studyFocus);
  }
  if ("tutoringContext" in input) {
    payload.tutoring_context = {
      ...(input.tutoringContext ?? {}),
      mode: tutoringMode,
      topic: input.topic ?? input.tutoringContext?.topic,
      goal: input.goal ?? input.tutoringContext?.goal,
      studyFocus: input.studyFocus ?? input.tutoringContext?.studyFocus,
      classId: input.classId ?? input.tutoringContext?.classId,
      taskId: input.taskId ?? input.tutoringContext?.taskId,
    };
  }
  if ("metadata" in input) {
    payload.metadata = input.metadata ?? {};
  }

  return payload;
}

export async function ensureAssistantSession(
  supabase: SupabaseClient,
  userId: string,
  input: AssistantSessionInput,
) {
  if (input.id) {
    const existing = await getAssistantSessionById(supabase, userId, input.id);
    if (!existing) {
      throw new Error("Assistant session not found.");
    }

    const updates = normalizeAssistantSessionInput(
      {
        ...existing,
        ...input,
        metadata: {
          ...(existing.metadata ?? {}),
          ...(input.metadata ?? {}),
        },
        tutoringContext: {
          ...(existing.tutoringContext ?? {}),
          ...(input.tutoringContext ?? {}),
          mode: input.tutoringMode ?? input.tutoringContext?.mode ?? existing.tutoringMode,
          topic: input.topic ?? input.tutoringContext?.topic ?? existing.topic,
          goal: input.goal ?? input.tutoringContext?.goal ?? existing.goal,
          studyFocus:
            input.studyFocus ?? input.tutoringContext?.studyFocus ?? existing.studyFocus,
          classId: input.classId ?? input.tutoringContext?.classId ?? existing.classId,
          taskId: input.taskId ?? input.tutoringContext?.taskId ?? existing.taskId,
        },
      },
      { requireChannel: true },
    );

    const { data, error } = await supabase
      .from("assistant_sessions")
      .update(updates)
      .eq("id", input.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return { session: mapDbAssistantSession(data as DbAssistantSessionRow), created: false };
  }

  const payload = normalizeAssistantSessionInput(input, { requireChannel: true });
  const { data, error } = await supabase
    .from("assistant_sessions")
    .insert({
      user_id: userId,
      ...payload,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { session: mapDbAssistantSession(data as DbAssistantSessionRow), created: true };
}

export async function getAssistantSessionById(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
) {
  const { data, error } = await supabase
    .from("assistant_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapDbAssistantSession(data as DbAssistantSessionRow) : null;
}

export async function listAssistantSessions(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    channel?: AssistantSessionChannel;
    classId?: string;
    status?: AssistantSessionStatus;
    tutoringMode?: TutoringMode;
  },
) {
  let query = supabase
    .from("assistant_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (options?.channel) {
    query = query.eq("channel", options.channel);
  }
  if (options?.classId) {
    query = query.eq("class_id", options.classId);
  }
  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.tutoringMode) {
    query = query.eq("tutoring_mode", options.tutoringMode);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DbAssistantSessionRow[]).map(mapDbAssistantSession);
}

export async function updateAssistantSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  patch: Partial<AssistantSessionInput> & { status?: AssistantSessionStatus },
) {
  if (patch.status && !SESSION_STATUSES.includes(patch.status)) {
    throw new Error("Session status is invalid.");
  }

  const payload = {
    ...normalizeAssistantSessionInput(patch),
    ...(patch.status ? { status: patch.status } : {}),
  };

  const { data, error } = await supabase
    .from("assistant_sessions")
    .update(payload)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapDbAssistantSession(data as DbAssistantSessionRow);
}

export async function appendAssistantSessionMessage(
  supabase: SupabaseClient,
  input: {
    sessionId: string;
    userId: string;
    role: AssistantMessageRole;
    contentType: AssistantMessageContentType;
    content: string;
    metadata?: Record<string, unknown>;
  },
) {
  if (!MESSAGE_ROLES.includes(input.role)) {
    throw new Error("Message role is invalid.");
  }
  if (!CONTENT_TYPES.includes(input.contentType)) {
    throw new Error("Message content type is invalid.");
  }

  const { data, error } = await supabase
    .from("assistant_session_messages")
    .insert({
      session_id: input.sessionId,
      user_id: input.userId,
      role: input.role,
      content_type: input.contentType,
      content: input.content,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await touchAssistantSession(supabase, input.sessionId);
  return mapDbAssistantSessionMessage(data as DbAssistantSessionMessageRow);
}

export async function listAssistantSessionMessages(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
) {
  const { data: messages, error } = await supabase
    .from("assistant_session_messages")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const messageRows = (messages ?? []) as DbAssistantSessionMessageRow[];
  if (messageRows.length === 0) {
    return [];
  }

  const { data: attachmentRows, error: attachmentError } = await supabase
    .from("assistant_attachments")
    .select("*")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .in("message_id", messageRows.map((row) => row.id));

  if (attachmentError) {
    throw new Error(attachmentError.message);
  }

  const attachmentsByMessageId = new Map<string, DbAssistantAttachmentRow[]>();
  for (const row of (attachmentRows ?? []) as DbAssistantAttachmentRow[]) {
    if (!row.message_id) continue;
    const list = attachmentsByMessageId.get(row.message_id) ?? [];
    list.push(row);
    attachmentsByMessageId.set(row.message_id, list);
  }

  return messageRows.map((row) =>
    mapDbAssistantSessionMessage(row, attachmentsByMessageId.get(row.id) ?? []),
  );
}

export async function appendAssistantSessionEvent(
  supabase: SupabaseClient,
  input: {
    sessionId: string;
    userId: string;
    eventType: AssistantEventType;
    metadata?: Record<string, unknown>;
  },
) {
  if (!EVENT_TYPES.includes(input.eventType)) {
    throw new Error("Assistant event type is invalid.");
  }

  const { data, error } = await supabase
    .from("assistant_session_events")
    .insert({
      session_id: input.sessionId,
      user_id: input.userId,
      event_type: input.eventType,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapDbAssistantSessionEvent(data as DbAssistantSessionEventRow);
}

export async function listAssistantSessionEvents(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
) {
  const { data, error } = await supabase
    .from("assistant_session_events")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DbAssistantSessionEventRow[]).map(mapDbAssistantSessionEvent);
}

export async function touchAssistantSession(
  supabase: SupabaseClient,
  sessionId: string,
  timestamp = new Date().toISOString(),
) {
  const { error } = await supabase
    .from("assistant_sessions")
    .update({ last_message_at: timestamp })
    .eq("id", sessionId);

  if (error) {
    throw new Error(error.message);
  }
}

function emptyToNull(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
