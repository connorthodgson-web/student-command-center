import { NextResponse } from "next/server";
import { generateAssistantReply, type AssistantHistoryMessage } from "../../../../lib/assistant-chat";
import type { ReminderPreference, SchoolClass, SchoolCalendarEntry, StudentTask, TutoringContext } from "../../../../types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    messages?: { role: string; content: string }[];
    classes?: SchoolClass[];
    tasks?: StudentTask[];
    reminderPreferences?: ReminderPreference;
    effectiveDayType?: "A" | "B" | null;
    calendarEntries?: SchoolCalendarEntry[];
    tutoringContext?: TutoringContext;
  };

  const messages = body.messages ?? [];

  if (!messages.length) {
    return NextResponse.json({ error: "Messages are required." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI is not configured. Please set OPENAI_API_KEY." },
      { status: 503 },
    );
  }

  // Split messages into history (all but last) and the current user message (last).
  // Filter out system messages — only user/assistant history is sent to the model.
  const validMessages = messages.filter((m) => m.role === "user" || m.role === "assistant");
  if (!validMessages.length) {
    return NextResponse.json({ error: "No valid messages found." }, { status: 400 });
  }

  const lastMessage = validMessages[validMessages.length - 1];
  if (lastMessage.role !== "user") {
    return NextResponse.json({ error: "Last message must be from user." }, { status: 400 });
  }

  const history: AssistantHistoryMessage[] = validMessages
    .slice(0, -1)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  try {
    const result = await generateAssistantReply({
      message: lastMessage.content,
      history,
      tasks: body.tasks ?? [],
      classes: body.classes ?? [],
      reminderPreferences: body.reminderPreferences,
      effectiveDayType: body.effectiveDayType,
      calendarEntries: body.calendarEntries,
      tutoringContext: body.tutoringContext,
    });

    return NextResponse.json({ data: result.data, action: result.action });
  } catch (err) {
    console.error("[AI Chat] Error:", err);
    return NextResponse.json(
      { error: "AI request failed. Please try again." },
      { status: 502 },
    );
  }
}
