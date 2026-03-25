import { NextResponse } from "next/server";
import { parseNaturalLanguageTask } from "../../../../lib/ai";
import { mockClasses } from "../../../../lib/mock-data";

export async function POST(request: Request) {
  const body = (await request.json()) as { input?: string };

  if (!body.input) {
    return NextResponse.json({ error: "Input is required." }, { status: 400 });
  }

  // TODO: Replace mockClasses with the real user's class list once auth + Supabase are in place.
  // TODO: Persist parsed tasks to Supabase after the data model is finalized.
  const parsedTask = await parseNaturalLanguageTask(body.input, mockClasses);

  return NextResponse.json({ data: parsedTask });
}
