import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssistantSessionInput, TutoringMode } from "../types";
import {
  appendAssistantSessionEvent,
  ensureAssistantSession,
  getAssistantSessionById,
  listAssistantSessionMessages,
  listAssistantSessions,
  updateAssistantSession,
} from "./assistant-sessions";
import { loadAssistantAttachmentsForRequest } from "./assistant-attachments";

export async function createTutoringSession(
  supabase: SupabaseClient,
  userId: string,
  session: AssistantSessionInput,
) {
  const result = await ensureAssistantSession(supabase, userId, {
    ...session,
    channel: "tutoring",
  });

  await appendAssistantSessionEvent(supabase, {
    sessionId: result.session.id,
    userId,
    eventType: result.created ? "session_started" : "tutoring_session_created",
    metadata: {
      tutoringMode: result.session.tutoringMode,
      topic: result.session.topic,
      goal: result.session.goal,
    },
  });

  return result.session;
}

export async function listTutoringSessions(
  supabase: SupabaseClient,
  userId: string,
  options?: { classId?: string; tutoringMode?: TutoringMode },
) {
  return listAssistantSessions(supabase, userId, {
    channel: "tutoring",
    classId: options?.classId,
    tutoringMode: options?.tutoringMode,
  });
}

export async function getTutoringSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
) {
  const session = await getAssistantSessionById(supabase, userId, sessionId);
  if (!session || session.channel !== "tutoring") {
    return null;
  }

  const [messages, attachments] = await Promise.all([
    listAssistantSessionMessages(supabase, userId, sessionId),
    loadAssistantAttachmentsForRequest(supabase, userId, { sessionId }),
  ]);

  return {
    session,
    messages,
    attachments,
  };
}

export async function patchTutoringSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  session: Partial<AssistantSessionInput> & { status?: "active" | "archived" },
) {
  const updated = await updateAssistantSession(supabase, userId, sessionId, session);

  await appendAssistantSessionEvent(supabase, {
    sessionId: updated.id,
    userId,
    eventType: "tutoring_session_created",
    metadata: {
      tutoringMode: updated.tutoringMode,
      topic: updated.topic,
      goal: updated.goal,
      studyFocus: updated.studyFocus,
    },
  });

  return updated;
}
