import { NextResponse } from "next/server";
import OpenAI from "openai";
import { detectAssistantIntent } from "../../../../lib/assistant-intent";
import { generateAssistantReply } from "../../../../lib/assistant-chat";
import { normalizeAssistantRequest } from "../../../../lib/assistant-request";
import {
  parseNaturalLanguageTask,
  parseNaturalLanguageSchedule,
} from "../../../../lib/ai";
import { loadAssistantData } from "../../../../lib/assistant-data";
import type {
  ReminderPreference,
  RotationDay,
  ScheduleArchitecture,
  SchoolCalendarEntry,
  SchoolClass,
  StudentTask,
} from "../../../../types";

const client = new OpenAI(); // Reads OPENAI_API_KEY from environment automatically

export async function POST(request: Request) {
  const body = (await request.json()) as {
    message?: string;
    tasks?: StudentTask[];
    classes?: SchoolClass[];
    reminderPreferences?: ReminderPreference;
    effectiveDayType?: RotationDay | null;
    scheduleArchitecture?: ScheduleArchitecture;
    calendarEntries?: SchoolCalendarEntry[];
    source?: "text" | "voice_transcript";
    channel?: "web_chat" | "voice" | "mobile" | "tutoring";
    tutoringMode?: "explain" | "step_by_step" | "quiz" | "review" | "study_plan" | "homework_help";
    topic?: string;
    goal?: string;
    studyFocus?: string;
    attachmentIds?: string[];
  };

  if (!process.env.OPENAI_API_KEY) {
    console.error("[AI Assistant] OPENAI_API_KEY is not set.");
    return NextResponse.json(
      { error: "AI is not configured. Set OPENAI_API_KEY in your environment." },
      { status: 503 }
    );
  }

  let normalized;
  try {
    normalized = normalizeAssistantRequest(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Message is required.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { message } = normalized;
  const { effectiveDayType, calendarEntries } = normalized;
  let assistantData = null;
  try {
    assistantData = await loadAssistantData();
  } catch {
    assistantData = null;
  }
  const tasks = assistantData?.tasks ?? normalized.tasks ?? [];
  const classes = assistantData?.classes ?? normalized.classes ?? [];
  const reminderPreferences: ReminderPreference =
    assistantData?.reminderPreferences ??
    normalized.reminderPreferences ?? {
      id: "default",
      deliveryChannel: "in_app",
      dailySummaryEnabled: false,
      tonightSummaryEnabled: false,
      dueSoonRemindersEnabled: false,
    };

  const deterministicIntent = detectAssistantIntent(message, classes);
  let intent: "add_task" | "setup_schedule" | "chat" =
    deterministicIntent === "task_capture"
      ? "add_task"
      : deterministicIntent === "schedule_setup"
        ? "setup_schedule"
        : "chat";
  if (intent === "chat") {
    try {
    const classifyResponse = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 50,
      messages: [
        {
          role: "system",
          content: `You are a classifier for a student assistant app. Given a student's message, decide whether it is:
- setup_schedule: the student is describing their full class schedule, listing multiple classes, or asking the app to build their schedule from a description (e.g. "my A-day classes are...", "I have English at 8, Math at 10...", "set up my schedule")
- add_task: the student is logging something they need to do or that is scheduled — including homework, assignments, essays, projects, tests, quizzes, or exams. This includes bare factual statements like "Bio test next Friday", "Calc homework due tomorrow", "History essay Monday", "Spanish quiz this week". If the message names a task/test/quiz/assignment and gives or implies a date, classify as add_task.
- chat: the student is asking a question, asking about their workload, asking what to work on, or having a general conversation
Return ONLY a JSON object: { "intent": "setup_schedule" } or { "intent": "add_task" } or { "intent": "chat" }. No other text.`,
        },
        { role: "user", content: message },
      ],
    });

    const raw = classifyResponse.choices[0].message.content?.trim() ?? "";
    const jsonText = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(jsonText) as { intent: string };
    if (
      parsed.intent === "add_task" ||
      parsed.intent === "setup_schedule" ||
      parsed.intent === "chat"
    ) {
      intent = parsed.intent;
    }
  } catch {
    // Classification failed — default to chat so the student still gets a response.
    intent = "chat";
  }
  }

  try {
    if (intent === "setup_schedule") {
      const parsedClasses = await parseNaturalLanguageSchedule(message, normalized.scheduleArchitecture);
      return NextResponse.json({ intent: "setup_schedule", classes: parsedClasses });
    } else if (intent === "add_task") {
      const task = await parseNaturalLanguageTask(message, classes);
      return NextResponse.json({ intent: "add_task", task });
    } else {
      const reply = (
        await generateAssistantReply({
          message,
          tasks,
          classes,
          reminderPreferences,
          currentDatetime: normalized.currentDatetime,
          calendarEntries,
          effectiveDayType,
          scheduleArchitecture: normalized.scheduleArchitecture,
          source: normalized.assistant.source,
          channel: normalized.assistant.channel,
          classId: normalized.assistant.classId,
          taskId: normalized.assistant.taskId,
          attachments: normalized.assistant.attachments,
          tutoringContext: normalized.assistant.tutoringContext,
        })
      ).data;
      return NextResponse.json({ intent: "chat", reply });
    }
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
