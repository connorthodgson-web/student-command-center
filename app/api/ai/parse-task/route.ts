import { NextResponse } from "next/server";
import { parseNaturalLanguageTask } from "../../../../lib/ai";
import { loadAssistantData } from "../../../../lib/assistant-data";

export async function POST(request: Request) {
  const body = (await request.json()) as { input?: string };

  if (!body.input) {
    return NextResponse.json({ error: "Input is required." }, { status: 400 });
  }

  let assistantData = null;
  try {
    assistantData = await loadAssistantData();
  } catch {
    assistantData = null;
  }
  const parsedTask = await parseNaturalLanguageTask(body.input, assistantData?.classes ?? []);

  return NextResponse.json({ data: parsedTask });
}
