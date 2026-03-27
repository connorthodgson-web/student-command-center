import { NextResponse } from "next/server";
import {
  getAssistantSessionById,
  updateAssistantSession,
} from "../../../../../lib/assistant-sessions";
import { getAuthedSupabase } from "../../../../../lib/supabase/route-auth";
import type { AssistantSessionInput } from "../../../../../types";

type UpdateAssistantSessionRequest = {
  session?: Partial<AssistantSessionInput> & { status?: "active" | "archived" };
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  try {
    const { sessionId } = await context.params;
    const session = await getAssistantSessionById(auth.supabase, auth.userId, sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    return NextResponse.json({ data: session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as UpdateAssistantSessionRequest;

  try {
    const { sessionId } = await context.params;
    const data = await updateAssistantSession(auth.supabase, auth.userId, sessionId, {
      ...body.session,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update session.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
