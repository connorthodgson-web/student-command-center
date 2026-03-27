import OpenAI from "openai";
import { detectAssistantIntent } from "./assistant-intent";
import { loadAssistantData } from "./assistant-data";
import {
  formatMaterialRetrievalForPrompt,
  retrieveRelevantMaterialExcerpts,
} from "./class-materials";
import { formatAttachmentContextForPrompt } from "./assistant-attachments";
import { buildCalendarContext } from "./schedule";
import { buildTodayContext, formatTodayContextForPrompt } from "./assistant-context";
import {
  assembleTutoringContext,
  buildTutoringContextSection,
  buildTutoringModePolicySection,
} from "./assistant-tutoring";
import { buildProfilePrompt } from "./profile";
import { formatRotationBadge, getClassRotationDays } from "./class-rotation";
import type {
  AssistantAttachment,
  AssistantMessageContentType,
  AssistantSessionChannel,
  AssistantAction,
  ReminderPreference,
  SchoolCalendarEntry,
  SchoolClass,
  StudentTask,
  ChatMessage,
  TutoringContext,
} from "../types";
import type { StudentProfile } from "./profile";
import type { Activity } from "./activities";
import type { LifeConstraint } from "./constraints";

const client = new OpenAI();

export type AssistantHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GenerateAssistantReplyInput = {
  message: string;
  history?: AssistantHistoryMessage[];
  tasks?: StudentTask[];
  reminderPreferences?: ReminderPreference;
  classes?: SchoolClass[];
  currentDatetime?: string;
  calendarEntries?: SchoolCalendarEntry[];
  effectiveDayType?: "A" | "B" | null;
  profile?: StudentProfile;
  activities?: Activity[];
  constraints?: LifeConstraint[];
  userId?: string;
  source?: AssistantMessageContentType;
  channel?: AssistantSessionChannel;
  classId?: string;
  taskId?: string;
  attachments?: AssistantAttachment[];
  tutoringContext?: TutoringContext;
};

function buildSystemPrompt(
  params: {
    userMessage: string;
    tasks: StudentTask[];
    classes: SchoolClass[];
    reminderPreferences: ReminderPreference;
    currentDatetime: string;
    calendarEntries?: SchoolCalendarEntry[];
    effectiveDayType?: "A" | "B" | null;
    profile?: StudentProfile;
    activities?: Activity[];
    constraints?: LifeConstraint[];
    source?: AssistantMessageContentType;
    channel?: AssistantSessionChannel;
    classId?: string;
    taskId?: string;
    attachments?: AssistantAttachment[];
    tutoringContext?: TutoringContext;
  },
): string {
  const now = new Date(params.currentDatetime);
  const assistantIntent = detectAssistantIntent(params.userMessage, params.classes);
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
  const calendarSection = buildCalendarContext(
    params.calendarEntries ?? [],
    todayDateStr,
    params.effectiveDayType ?? null,
  );

  const todayCtx = buildTodayContext(
    now,
    params.classes,
    params.tasks,
    params.calendarEntries ?? [],
    params.effectiveDayType ?? null,
    params.activities ?? [],
    params.constraints ?? [],
  );
  const todayContextSection = formatTodayContextForPrompt(todayCtx);
  const materialRetrieval = retrieveRelevantMaterialExcerpts({
    message: params.userMessage,
    classes: params.classes,
  });

  const classLines = params.classes
    .map((c) => {
      const effectiveDays = c.meetings && c.meetings.length > 0
        ? c.meetings.map((m) => m.day)
        : c.days;
      const rotationBadge = formatRotationBadge(c.rotationDays, c.scheduleLabel);
      const labelNote = rotationBadge ? ` [${rotationBadge} rotation]` : "";
      const teacherNote = c.teacherName ? ` - teacher: ${c.teacherName}` : "";
      const emailNote = c.teacherEmail ? ` <${c.teacherEmail}>` : "";
      const roomNote = c.room ? `, room: ${c.room}` : "";

      if (c.meetings && c.meetings.length > 0) {
        const meetingLines = c.meetings
          .map((m) => `    ${m.day}: ${m.startTime}-${m.endTime}`)
          .join("\n");
        return `* ${c.name} (id:${c.id})${labelNote}${teacherNote}${emailNote}${roomNote}, per-day times:\n${meetingLines}`;
      }

      const rotationDays = getClassRotationDays(c);
      const daysStr = effectiveDays.length > 0
        ? effectiveDays.join(", ")
        : rotationDays.length > 0
          ? "(rotation-based, no fixed weekdays)"
          : "(no meeting days set)";
      const timeStr = c.startTime && c.endTime ? `, ${c.startTime}-${c.endTime}` : "";
      return `* ${c.name} (id:${c.id})${labelNote}, meets ${daysStr}${timeStr}${teacherNote}${emailNote}${roomNote}`;
    })
    .join("\n");

  const materialInventoryLines = params.classes
    .filter((schoolClass) => (schoolClass.materials?.length ?? 0) > 0)
    .map(
      (schoolClass) =>
        `* ${schoolClass.name}: ${schoolClass.materials?.length ?? 0} saved material(s)`,
    )
    .join("\n");

  const taskLines = params.tasks
    .map((t) => {
      const classMatch = params.classes.find((c) => c.id === t.classId);
      const parts = [`* ${t.title} (id:${t.id})`];
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

  const dailySummaryLine = params.reminderPreferences.dailySummaryEnabled
    ? `* Daily summary: enabled at ${params.reminderPreferences.dailySummaryTime ?? "a saved time"}`
    : "* Daily summary: disabled";

  const tonightSummaryLine = params.reminderPreferences.tonightSummaryEnabled
    ? `* Tonight summary: enabled at ${params.reminderPreferences.tonightSummaryTime ?? "a saved time"}`
    : "* Tonight summary: disabled";

  const dueSoonLine = params.reminderPreferences.dueSoonRemindersEnabled
    ? `* Due soon reminders: enabled, ${params.reminderPreferences.dueSoonHoursBefore ?? 0} hours before`
    : "* Due soon reminders: disabled";

  const profileSection = buildProfilePrompt(params.profile);
  const tutoringAssembly = assembleTutoringContext({
    message: params.userMessage,
    classes: params.classes,
    tasks: params.tasks,
    attachments: params.attachments ?? [],
    tutoringContext: params.tutoringContext,
    classId: params.classId,
    taskId: params.taskId,
  });
  const tutoringSection = tutoringAssembly.tutoringSection;
  const tutoringModeSection = buildTutoringModePolicySection(params.tutoringContext?.mode);
  const attachmentSection = formatAttachmentContextForPrompt(params.attachments ?? []);
  const linkedClass = params.classId
    ? params.classes.find((schoolClass) => schoolClass.id === params.classId)
    : null;
  const requestContextSection = [
    `Request channel: ${params.channel ?? "web_chat"}`,
    `Input source: ${params.source ?? "text"}`,
    linkedClass ? `Linked class: ${linkedClass.name}` : null,
    params.taskId ? `Linked task id: ${params.taskId}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are a calm, smart academic assistant built into a student planner app. Today is ${readableDate} at ${readableTime}.

You are given structured context about the student's current day, schedule, and upcoming tasks. Use it to give specific, practical, and grounded answers. Prefer referencing real items from the context instead of giving generic advice.
${profileSection ? `\n${profileSection}\n` : ""}
Detected intent: ${assistantIntent}

Request context:
${requestContextSection}

${tutoringSection ? `${tutoringSection}\n` : ""}
${tutoringModeSection ? `${tutoringModeSection}\n` : ""}

${todayContextSection}

School calendar context:
${calendarSection}

All classes (full list):
${classLines}

All tasks (full list):
${taskLines}

Saved class material inventory:
${materialInventoryLines || "No class materials saved yet."}

Relevant class material retrieval for this message:
${formatMaterialRetrievalForPrompt(materialRetrieval)}

Request attachments:
${attachmentSection}

Tutoring material selection:
${tutoringAssembly.materialSection}

Tutoring attachment selection:
${tutoringAssembly.attachmentSection}

${tutoringAssembly.taskSection}

The student's reminder preferences are:
${dailySummaryLine}
${tonightSummaryLine}
${dueSoonLine}

### Decision Rules

1. **Be selective** - do NOT list everything. Highlight the most relevant 1-3 items first.
2. **Prioritize by time** - Overdue > Today > Tomorrow > This Week.
3. **Be concrete** - reference real tasks and classes from the context above. Include names and timing when helpful.
4. **Avoid generic advice** - never say things like "stay organized" or "manage your time well". Always anchor responses in the student's real data.
5. **Answer first, then expand** - start with a short direct answer (1-2 sentences), then optionally add a few bullets.
6. **Keep responses calm and concise** - no long paragraphs, no over-explaining.
7. **For "what should I work on" questions** - recommend one clear starting task, then optionally include 1-2 secondary suggestions.
8. **For schedule questions ("what do I have today/tomorrow/on A day/on B day")** - list classes in time order with name and time. Include room if known. Keep it compact.
9. **For teacher questions ("who teaches X", "what's my X teacher's name")** - answer directly from the class list. If teacher info isn't available, say so in one sentence.
10. **For email drafting help** - if the student asks to draft an email to a teacher, use the teacher name from the class list. Note: you cannot send emails, only draft them.
11. **If context is missing** - say so honestly in one sentence. Never invent schedule details, teacher names, due dates, or note contents.
12. **If retrieved material excerpts are present** - use them directly and make it clear you're grounding the answer in those excerpts.
13. **If no relevant material excerpts were retrieved** - do not imply you read the student's notes. Say you couldn't find relevant material in their saved notes/files.
14. **If materials exist but extraction failed or text is missing** - say the file is saved but doesn't currently have usable text.
15. **If tutoring mode is quiz** - ask questions instead of immediately teaching everything.
16. **If tutoring mode is step_by_step or homework_help** - prefer guidance, hints, and structured steps before full solutions unless the student explicitly asks for the full answer.
17. **If tutoring mode is study_plan** - return a practical study sequence grounded in the linked class, task, notes, and attachments.

### Formatting Rules

- Use **bullets** for lists
- Use **bold** for important items like task names, class names, and deadlines
- Use headings **only** for multi-day or grouped answers (e.g. ### Monday, ### This Week)
- Never invent information not found in the context above. If unsure, say so briefly.
- Never claim to have used notes or files unless the "Relevant class material retrieval" section includes actual excerpts.

### Completing Tasks

When the student says they finished a task - e.g. "I finished my chemistry homework", "mark the essay as done", "I already did that", "remove my reading task" - do two things:
1. Respond naturally in one short sentence confirming the completion.
2. Append a machine-readable action on its very own line at the end:

ACTION:{"type":"complete_task","taskId":"<id>","taskTitle":"<title>"}

Rules:
- Always include both taskId and taskTitle when possible.
- Only emit a complete_task ACTION when the student clearly indicates a specific task is done or should be removed.
- If it's genuinely ambiguous which task they mean, ask one short clarifying question instead of guessing.
- The ACTION line must be the very last line of your response.

### Updating Tasks

When the student asks to change a task's due date, title, notes, or description — e.g. "Move my essay due date to Friday", "Rename my calc homework", "Change the notes on my history project" — do two things:
1. Respond naturally in one sentence confirming what you updated.
2. Append a machine-readable action on its very own line at the end:

ACTION:{"type":"update_task","taskId":"<id>","taskTitle":"<current title>","updates":{"dueAt":"<ISO 8601 datetime or omit if unchanged>","title":"<new title or omit if unchanged>","description":"<new notes or omit if unchanged>"}}

Rules:
- Always include taskId when you have it, plus taskTitle for fuzzy matching.
- Only include fields that actually changed in the updates object.
- Resolve relative dates like "Friday" or "next Monday" to a full ISO 8601 datetime based on today's date shown above. Use end-of-day (T23:59:00) unless a specific time is mentioned.
- If it's unclear which task, ask one short clarifying question instead of guessing.
- The ACTION must be the very last line.

### Adding Tasks from Chat

When the student clearly wants to add, track, or log a new task/assignment — e.g. "Add my chemistry homework due tomorrow", "Track my Spanish quiz on Friday", "I have a history essay due next Monday" — do two things:
1. Respond naturally in one sentence confirming you're adding it.
2. Append a machine-readable action on its very own line at the end:

ACTION:{"type":"add_task","task":{"title":"<short clean task name>","dueAt":"<ISO 8601 datetime or omit>","type":"<assignment|test|quiz|reading|project|study|null>","className":"<class name or null>","description":"<notes or null>"}}

Rules:
- Keep task titles short and clean — ideally 3–6 words.
- Only emit add_task when the intent is clearly to create a new task, not just to discuss an existing one.
- Resolve relative dates to ISO 8601 based on today's date shown above. Use end-of-day (T23:59:00) unless a specific time is mentioned.
- The ACTION must be the very last line.

### Creating Automations & Reminders

When the student clearly asks to set up a reminder or automation, do two things:
1. Respond naturally in 1-2 sentences confirming what you're setting up.
2. Append a machine-readable action on its very own line:

ACTION:{"type":"create_automation","automation":{"userId":"local","type":"<automationType>","title":"<title>","scheduleDescription":"<humanReadableSchedule>","scheduleConfig":<scheduleConfigObject>,"deliveryChannel":"in_app","enabled":true}}

Supported automationType values: tonight_summary, morning_summary, due_soon, study_reminder, class_reminder, custom

Rules:
- Only emit an ACTION when the intent is clearly to create a reminder or automation.
- If the request is ambiguous, ask one short clarifying question instead of guessing.
- The ACTION line must be the very last line of your response.`;
}

function extractAssistantAction(rawContent: string) {
  let content = rawContent;
  let action: AssistantAction | undefined;

  const actionMatch = rawContent.trimEnd().match(/(?:^|\n)ACTION:(\{.+\})$/);
  if (actionMatch) {
    try {
      action = JSON.parse(actionMatch[1]) as AssistantAction;
      content = rawContent.slice(0, rawContent.lastIndexOf("\nACTION:")).trim();
    } catch {
      // Ignore malformed action payloads and return the raw content.
    }
  }

  return { content, action };
}

export async function generateAssistantReply(
  input: GenerateAssistantReplyInput,
): Promise<{ data: ChatMessage; action?: AssistantAction }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI is not configured. Set OPENAI_API_KEY in your environment.");
  }

  if (!input.message.trim()) {
    throw new Error("Message is required.");
  }

  const history = input.history ?? [];
  let assistantData = null;
  try {
    assistantData = await loadAssistantData({
      includeCompletedTasks: true,
      userId: input.userId,
    });
  } catch {
    assistantData = null;
  }

  const tasks = assistantData?.tasks ?? input.tasks ?? [];
  const classes = assistantData?.classes ?? input.classes ?? [];
  const reminderPreferences =
    assistantData?.reminderPreferences ??
    input.reminderPreferences ?? {
      id: "default",
      deliveryChannel: "in_app",
      dailySummaryEnabled: false,
      tonightSummaryEnabled: false,
      dueSoonRemindersEnabled: false,
    };

  const currentDatetime = input.currentDatetime ?? new Date().toISOString();
  const calendarEntries = input.calendarEntries;
  const effectiveDayType = input.effectiveDayType;
  const profile = input.profile;
  const activities = input.activities ?? [];
  const constraints = input.constraints ?? [];

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: buildSystemPrompt(
        {
          userMessage: input.message,
          tasks,
          classes,
          reminderPreferences,
          currentDatetime,
          calendarEntries,
          effectiveDayType,
          profile,
          activities,
          constraints,
          source: input.source,
          channel: input.channel,
          classId: input.classId,
          taskId: input.taskId,
          attachments: input.attachments,
          tutoringContext: input.tutoringContext,
        },
      ),
    },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: input.message },
  ];

  const modelMap: Record<string, string> = {
    fast: "gpt-4o-mini",
    balanced: "gpt-4o",
    powerful: "gpt-4o",
  };
  const selectedModel = modelMap[input.profile?.aiModel ?? "balanced"] ?? "gpt-4o";

  const aiResponse = await client.chat.completions.create({
    model: selectedModel,
    max_tokens: 1000,
    messages,
  });

  const rawContent = aiResponse.choices[0].message.content ?? "Sorry, I couldn't respond.";
  const { content, action } = extractAssistantAction(rawContent);

  return {
    data: {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
    },
    action,
  };
}
