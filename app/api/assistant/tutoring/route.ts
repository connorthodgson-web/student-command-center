import { NextResponse } from "next/server";
import { getAuthedSupabase } from "../../../../lib/supabase/route-auth";
import { createTutoringSession, listTutoringSessions } from "../../../../lib/tutoring-service";
import type { AssistantSessionInput, TutoringMode } from "../../../../types";

type CreateTutoringSessionRequest = {
  session?: AssistantSessionInput;
};

export async function GET(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const classId = url.searchParams.get("classId") ?? undefined;
  const tutoringMode = (url.searchParams.get("tutoringMode") ?? undefined) as TutoringMode | undefined;
  const status = (url.searchParams.get("status") ?? undefined) as "active" | "archived" | undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  try {
    const data = await listTutoringSessions(auth.supabase, auth.userId, {
      classId,
      tutoringMode,
      status,
      limit: typeof limit === "number" && limit > 0 ? limit : undefined,
    });

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load tutoring sessions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as CreateTutoringSessionRequest;

  try {
    const data = await createTutoringSession(auth.supabase, auth.userId, {
      ...body.session,
      channel: "tutoring",
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create tutoring session.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
