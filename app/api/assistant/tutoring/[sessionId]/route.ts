import { NextResponse } from "next/server";
import { getAuthedSupabase } from "../../../../../lib/supabase/route-auth";
import { getTutoringSession, patchTutoringSession } from "../../../../../lib/tutoring-service";
import type { AssistantSessionInput } from "../../../../../types";

type UpdateTutoringSessionRequest = {
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
    const data = await getTutoringSession(auth.supabase, auth.userId, sessionId);
    if (!data) {
      return NextResponse.json({ error: "Tutoring session not found." }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load tutoring session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as UpdateTutoringSessionRequest;

  try {
    const { sessionId } = await context.params;
    const data = await patchTutoringSession(auth.supabase, auth.userId, sessionId, body.session ?? {});
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update tutoring session.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
