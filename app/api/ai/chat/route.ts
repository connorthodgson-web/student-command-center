import { NextResponse } from "next/server";
import OpenAI from "openai";
import { mockClasses, mockTasks, mockReminderPreference } from "../../../../lib/mock-data";
import { buildCalendarContext } from "../../../../lib/schedule";
import { buildTodayContext, formatTodayContextForPrompt } from "../../../../lib/assistant-context";
import type { AssistantAction, ReminderPreference, SchoolCalendarEntry, SchoolClass, StudentTask } from "../../../../types";

// TODO: In a future sprint, replace mock data with real student profile pulled from Supabase.
// The system prompt should be built from the authenticated user's actual classes, tasks, and preferences.

const client = new OpenAI(); // Reads OPENAI_API_KEY from environment automatically

function buildSystemPrompt(
  tasks: StudentTask[],
  classes: SchoolClass[],
  reminderPreferences: ReminderPreference,
  currentDatetime: string,
  calendarEntries?: SchoolCalendarEntry[],
  effectiveDayType?: "A" | "B" | null,
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
  const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const calendarSection = buildCalendarContext(calendarEntries ?? [], todayDateStr, effectiveDayType ?? null);

  const todayCtx = buildTodayContext(now, classes, tasks, calendarEntries ?? [], effectiveDayType ?? null);
  const todayContextSection = formatTodayContextForPrompt(todayCtx);

  const classLines = classes
    .map((c) => `* ${c.name} (id:${c.id}), meets ${c.days.join(", ")}, ${c.startTime} to ${c.endTime}`)
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

  return `You are a calm, smart academic assistant built into a student planner app. Today is ${readableDate} at ${readableTime}.

You are given structured context about the student's current day, schedule, and upcoming tasks. Use it to give specific, practical, and grounded answers. Prefer referencing real items from the context instead of giving generic advice.

${todayContextSection}

School calendar context:
${calendarSection}

All classes (full list):
${classLines}

All tasks (full list):
${taskLines}

The student's reminder preferences are:
${dailySummaryLine}
${tonightSummaryLine}
${dueSoonLine}

### Decision Rules

1. **Be selective** — do NOT list everything. Highlight the most relevant 1–3 items first.
2. **Prioritize by time** — Overdue > Today > Tomorrow > This Week.
3. **Be concrete** — reference real tasks and classes from the context above. Include names and timing when helpful.
4. **Avoid generic advice** — never say things like "stay organized" or "manage your time well". Always anchor responses in the student's real data.
5. **Answer first, then expand** — start with a short direct answer (1–2 sentences), then optionally add a few bullets.
6. **Keep responses calm and concise** — no long paragraphs, no over-explaining.
7. **For "what should I work on" questions** — recommend one clear starting task, then optionally include 1–2 secondary suggestions.

### Formatting Rules

- Use **bullets** for lists
- Use **bold** for important items like task names, class names, and deadlines
- Use headings **only** for multi-day or grouped answers (e.g. ### Monday, ### This Week)
- Use 1–3 emojis per response, placed naturally — not at the start of every line
- Never invent information not found in the context above. If unsure, say so briefly.

Examples of good response patterns:
- "Do I have school Friday?" → one sentence, no heading
- "What do I have today?" → short intro, then 2–3 bullets max
- "What should I work on tonight?" → name one task directly, then 1–2 secondary options if relevant
- "What do I have this week?" → grouped by day using ### headings, bullets under each

### Creating Automations & Reminders

When the student clearly asks to set up a reminder or automation, do two things:
1. Respond naturally in 1–2 sentences confirming what you're setting up.
2. Append a machine-readable action on its very own line at the end, formatted exactly like this (no spaces before ACTION:):

ACTION:{"type":"create_automation","automation":{"userId":"local","type":"<automationType>","title":"<title>","scheduleDescription":"<humanReadableSchedule>","scheduleConfig":<scheduleConfigObject>,"deliveryChannel":"in_app","enabled":true}}

**Supported automationType values:** tonight_summary, morning_summary, due_soon, study_reminder, class_reminder, custom

**scheduleConfig examples:**
- Weekly recurring: {"type":"weekly","days":["sunday"],"time":"18:00"}
- Weekday recurring: {"type":"weekdays","time":"19:30"}
- One-time: {"type":"once","datetime":"2026-03-26T20:00:00"}
- Before a class: {"type":"before_class","minutesBefore":30}
- Unknown/complex: {"type":"custom"}

**relatedClassId:** If the automation is tied to a specific class from the class list above, include "relatedClassId":"<id>" in the automation object using the id shown in parentheses (id:...).

**Rules:**
- Only emit an ACTION when the intent is clearly to create a reminder or automation.
- If the request is ambiguous (no clear time, no clear frequency), ask one short clarifying question instead of guessing.
- Do NOT emit an ACTION for general questions, task lookups, or schedule questions.
- The ACTION line must be the very last line of your response, with no text after it.
- Do not wrap the ACTION in code fences or markdown.`;
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
    calendarEntries?: SchoolCalendarEntry[];
    effectiveDayType?: "A" | "B" | null;
  };

  if (!body.message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const history = body.history ?? [];
  const tasks = body.tasks ?? mockTasks;
  const classes = body.classes ?? mockClasses;
  const reminderPreferences = body.reminderPreferences ?? mockReminderPreference;
  const currentDatetime = body.currentDatetime ?? new Date().toISOString();
  const calendarEntries = body.calendarEntries;
  const effectiveDayType = body.effectiveDayType;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(tasks, classes, reminderPreferences, currentDatetime, calendarEntries, effectiveDayType) },
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

  const rawContent = response.choices[0].message.content ?? "Sorry, I couldn't respond.";

  // Extract optional ACTION payload from the last line of the response
  let content = rawContent;
  let action: AssistantAction | undefined;

  const actionMatch = rawContent.trimEnd().match(/(?:^|\n)ACTION:(\{.+\})$/);
  if (actionMatch) {
    try {
      action = JSON.parse(actionMatch[1]) as AssistantAction;
      // Strip the ACTION line from the visible message
      content = rawContent.slice(0, rawContent.lastIndexOf("\nACTION:")).trim();
    } catch {
      // Malformed JSON — show full content as-is, no action
    }
  }

  return NextResponse.json({
    data: {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
    },
    action,
  });
}
