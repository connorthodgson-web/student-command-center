import { NextResponse } from "next/server";
import OpenAI from "openai";
import { mockClasses, mockTasks, mockReminderPreference } from "../../../../lib/mock-data";
import type { ReminderPreference, SchoolClass, StudentTask } from "../../../../types";

// TODO: In a future sprint, replace mock data with real student profile pulled from Supabase.
// The system prompt should be built from the authenticated user's actual classes, tasks, and preferences.

const client = new OpenAI(); // Reads OPENAI_API_KEY from environment automatically

function buildSystemPrompt(
  tasks: StudentTask[],
  classes: SchoolClass[],
  reminderPreferences: ReminderPreference,
  currentDatetime: string,
): string {
  const now = new Date(currentDatetime);
  const readableDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const readableTime = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const classLines = classes
    .map((c) => `* ${c.name}, meets ${c.days.join(", ")}, ${c.startTime} to ${c.endTime}`)
    .join("\n");

  const taskLines = tasks
    .map((t) => {
      const classMatch = classes.find((c) => c.id === t.classId);
      const parts = [`* ${t.title}`];
      if (t.type) parts.push(t.type);
      if (classMatch) parts.push(classMatch.name);
      if (t.dueAt) {
        const dueDate = new Date(t.dueAt);
        const readableDue = dueDate.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
        parts.push(`due ${readableDue}`);
      }
      parts.push(`status ${t.status}`);
      return parts.join(", ");
    })
    .join("\n");

  const dailySummaryLine = reminderPreferences.dailySummaryEnabled
    ? `* Daily summary: enabled at ${reminderPreferences.dailySummaryTime ?? "a saved time"}`
    : "* Daily summary: disabled";

  const tonightSummaryLine = reminderPreferences.tonightSummaryEnabled
    ? `* Tonight summary: enabled at ${reminderPreferences.tonightSummaryTime ?? "a saved time"}`
    : "* Tonight summary: disabled";

  const dueSoonLine = reminderPreferences.dueSoonRemindersEnabled
    ? `* Due soon reminders: enabled, ${reminderPreferences.dueSoonHoursBefore ?? 0} hours before`
    : "* Due soon reminders: disabled";

  return `You are a helpful AI academic assistant for a student. Today is ${readableDate} at ${readableTime}. Use this to reason about what is due soon, what is due tonight, and what is coming up this week.

The student's classes are:
${classLines}

The student's current tasks are:
${taskLines}

The student's reminder preferences are:
${dailySummaryLine}
${tonightSummaryLine}
${dueSoonLine}

Answer the student's questions about their workload, schedule, and upcoming deadlines in a helpful, honest, and conversational way. Do not invent information that is not in the context above. If you are unsure about something, say so.`;
}

type HistoryMessage = { role: string; content: string };

export async function POST(request: Request) {
  const body = (await request.json()) as {
    message?: string;
    history?: HistoryMessage[];
    // Live context sent from ChatPanel so the assistant sees the student's current state.
    tasks?: StudentTask[];
    reminderPreferences?: ReminderPreference;
    classes?: SchoolClass[];
    currentDatetime?: string;
  };

  if (!body.message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const history = body.history ?? [];
  const tasks = body.tasks ?? mockTasks;
  const classes = body.classes ?? mockClasses;
  const reminderPreferences = body.reminderPreferences ?? mockReminderPreference;
  const currentDatetime = body.currentDatetime ?? new Date().toISOString();

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(tasks, classes, reminderPreferences, currentDatetime) },
    ...history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: body.message },
  ];

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1000,
    messages,
  });

  const content = response.choices[0].message.content ?? "Sorry, I couldn't respond.";

  return NextResponse.json({
    data: {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
    },
  });
}
