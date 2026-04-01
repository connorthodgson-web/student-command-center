import { NextResponse } from "next/server";
import {
  appendAssistantSessionEvent,
  ensureAssistantSession,
  listAssistantSessions,
} from "../../../../lib/assistant-sessions";
import { getAuthedSupabase } from "../../../../lib/supabase/route-auth";
import type { AssistantSessionInput } from "../../../../types";

type CreateAssistantSessionRequest = {
  session?: AssistantSessionInput;
};

export async function GET(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const channel = url.searchParams.get("channel") ?? undefined;
  const classId = url.searchParams.get("classId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const tutoringMode = url.searchParams.get("tutoringMode") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  try {
    const data = await listAssistantSessions(auth.supabase, auth.userId, {
      channel: channel as AssistantSessionInput["channel"],
      classId,
      status: status as "active" | "archived" | undefined,
      tutoringMode: tutoringMode as AssistantSessionInput["tutoringMode"],
      limit: typeof limit === "number" && limit > 0 ? limit : undefined,
    });

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load sessions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as CreateAssistantSessionRequest;

  try {
    const result = await ensureAssistantSession(auth.supabase, auth.userId, {
      channel: body.session?.channel ?? "web_chat",
      title: body.session?.title,
      classId: body.session?.classId,
      taskId: body.session?.taskId,
      tutoringMode: body.session?.tutoringMode,
      topic: body.session?.topic,
      goal: body.session?.goal,
      studyFocus: body.session?.studyFocus,
      tutoringContext: body.session?.tutoringContext,
      metadata: body.session?.metadata,
    });

    await appendAssistantSessionEvent(auth.supabase, {
      sessionId: result.session.id,
      userId: auth.userId,
      eventType: "session_started",
      metadata: {
        channel: result.session.channel,
      },
    });

    if (result.session.tutoringContext) {
      await appendAssistantSessionEvent(auth.supabase, {
        sessionId: result.session.id,
        userId: auth.userId,
        eventType: "tutoring_session_created",
        metadata: { ...result.session.tutoringContext },
      });
    }

    return NextResponse.json({ data: result.session }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create session.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
