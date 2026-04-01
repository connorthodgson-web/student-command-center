import type {
  AssistantAttachment,
  AssistantRequestInput,
  AssistantSessionChannel,
  AssistantSessionInput,
  AssistantMessageContentType,
  Automation,
  PlanningItem,
  ReminderPreference,
  RotationDay,
  ScheduleArchitecture,
  SchoolCalendarEntry,
  SchoolClass,
  StudentTask,
  TutoringContext,
  TutoringMode,
} from "../types";
import type { StudentProfile } from "./profile";

type HistoryMessage = { role: "user" | "assistant"; content: string };

export type LegacyAssistantChatRequest = {
  message?: string;
  history?: HistoryMessage[];
  tasks?: StudentTask[];
  reminderPreferences?: ReminderPreference;
  classes?: SchoolClass[];
  currentDatetime?: string;
  calendarEntries?: SchoolCalendarEntry[];
  effectiveDayType?: RotationDay | null;
  scheduleArchitecture?: ScheduleArchitecture;
  profile?: StudentProfile;
  automations?: Automation[];
  planningItems?: PlanningItem[];
  source?: AssistantMessageContentType;
  channel?: AssistantSessionChannel;
  classId?: string;
  taskId?: string;
  attachmentIds?: string[];
  attachments?: AssistantAttachment[];
  tutoringMode?: TutoringMode;
  topic?: string;
  goal?: string;
  studyFocus?: string;
  tutoringContext?: TutoringContext;
  session?: AssistantSessionInput;
};

export type NormalizedAssistantRequest = {
  message: string;
  history: HistoryMessage[];
  tasks?: StudentTask[];
  reminderPreferences?: ReminderPreference;
  classes?: SchoolClass[];
  currentDatetime?: string;
  calendarEntries?: SchoolCalendarEntry[];
  effectiveDayType?: RotationDay | null;
  scheduleArchitecture?: ScheduleArchitecture;
  profile?: StudentProfile;
  automations?: Automation[];
  planningItems?: PlanningItem[];
  assistant: AssistantRequestInput;
};

export function normalizeAssistantRequest(
  body: LegacyAssistantChatRequest,
): NormalizedAssistantRequest {
  const message = body.message?.trim();
  if (!message) {
    throw new Error("Message is required.");
  }

  const inferredChannel =
    body.session?.channel ??
    body.channel ??
    (body.source === "voice_transcript" ? "voice" : "web_chat");

  return {
    message,
    history: body.history ?? [],
    tasks: body.tasks,
    reminderPreferences: body.reminderPreferences,
    classes: body.classes,
    currentDatetime: body.currentDatetime,
    calendarEntries: body.calendarEntries,
    effectiveDayType: body.effectiveDayType,
    scheduleArchitecture: body.scheduleArchitecture,
    profile: body.profile,
    automations: body.automations,
    planningItems: body.planningItems,
    assistant: {
      message,
      source: body.source ?? "text",
      channel: inferredChannel,
      classId: body.classId ?? body.session?.classId,
      taskId: body.taskId ?? body.session?.taskId,
      attachmentIds: body.attachmentIds ?? [],
      attachments: body.attachments ?? [],
      tutoringMode:
        body.tutoringMode ??
        body.tutoringContext?.mode ??
        body.session?.tutoringMode ??
        body.session?.tutoringContext?.mode,
      tutoringContext: mergeTutoringContext(
        {
          ...body.tutoringContext,
          mode: body.tutoringMode ?? body.tutoringContext?.mode,
          topic: body.topic ?? body.tutoringContext?.topic,
          goal: body.goal ?? body.tutoringContext?.goal,
          studyFocus: body.studyFocus ?? body.tutoringContext?.studyFocus,
          classId: body.classId ?? body.tutoringContext?.classId,
          taskId: body.taskId ?? body.tutoringContext?.taskId,
          attachmentIds: body.attachmentIds ?? body.tutoringContext?.attachmentIds,
        },
        {
          ...body.session?.tutoringContext,
          mode: body.session?.tutoringMode ?? body.session?.tutoringContext?.mode,
          topic: body.session?.topic ?? body.session?.tutoringContext?.topic,
          goal: body.session?.goal ?? body.session?.tutoringContext?.goal,
          studyFocus: body.session?.studyFocus ?? body.session?.tutoringContext?.studyFocus,
          classId: body.session?.classId ?? body.session?.tutoringContext?.classId,
          taskId: body.session?.taskId ?? body.session?.tutoringContext?.taskId,
        },
      ),
      session: {
        ...body.session,
        channel: inferredChannel,
        tutoringMode:
          body.session?.tutoringMode ??
          body.tutoringMode ??
          body.session?.tutoringContext?.mode ??
          body.tutoringContext?.mode,
        topic: body.session?.topic ?? body.topic ?? body.tutoringContext?.topic,
        goal: body.session?.goal ?? body.goal ?? body.tutoringContext?.goal,
        studyFocus:
          body.session?.studyFocus ?? body.studyFocus ?? body.tutoringContext?.studyFocus,
      },
    },
  };
}

function mergeTutoringContext(
  bodyContext?: TutoringContext,
  sessionContext?: TutoringContext,
): TutoringContext | undefined {
  if (!bodyContext && !sessionContext) return undefined;

  return {
    mode: bodyContext?.mode ?? sessionContext?.mode,
    classId: bodyContext?.classId ?? sessionContext?.classId,
    taskId: bodyContext?.taskId ?? sessionContext?.taskId,
    materialIds: bodyContext?.materialIds ?? sessionContext?.materialIds,
    attachmentIds: bodyContext?.attachmentIds ?? sessionContext?.attachmentIds,
    topic: bodyContext?.topic ?? sessionContext?.topic,
    goal: bodyContext?.goal ?? sessionContext?.goal,
    studyFocus: bodyContext?.studyFocus ?? sessionContext?.studyFocus,
  };
}
