import { NextResponse } from "next/server";
import {
  generateAssistantReply,
  type AssistantHistoryMessage,
} from "../../../../lib/assistant-chat";
import { loadAssistantAttachmentsForRequest } from "../../../../lib/assistant-attachments";
import {
  executeAssistantAction,
  saveParsedSchedule,
} from "../../../../lib/assistant-action-executor";
import {
  appendAssistantSessionEvent,
  appendAssistantSessionMessage,
  ensureAssistantSession,
  listAssistantSessionMessages,
  updateAssistantSession,
} from "../../../../lib/assistant-sessions";
import { assembleTutoringContext } from "../../../../lib/assistant-tutoring";
import { detectAssistantIntent } from "../../../../lib/assistant-intent";
import { parseNaturalLanguageSchedule } from "../../../../lib/ai";
import { loadAssistantData } from "../../../../lib/assistant-data";
import { getOptionalAuthedSupabase } from "../../../../lib/supabase/route-auth";
import type {
  AssistantSession,
  AssistantSessionInput,
  ReminderPreference,
  RotationDay,
  ScheduleArchitecture,
  SchoolCalendarEntry,
  SchoolClass,
  StudentTask,
  TutoringContext,
} from "../../../../types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    messages?: { role: string; content: string }[];
    classes?: SchoolClass[];
    tasks?: StudentTask[];
    reminderPreferences?: ReminderPreference;
    effectiveDayType?: RotationDay | null;
    scheduleArchitecture?: ScheduleArchitecture;
    calendarEntries?: SchoolCalendarEntry[];
    attachmentIds?: string[];
    classId?: string;
    taskId?: string;
    tutoringContext?: TutoringContext;
    session?: AssistantSessionInput;
  };

  const messages = body.messages ?? [];

  if (!messages.length) {
    return NextResponse.json({ error: "Messages are required." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "AI is not configured. Please set OPENAI_API_KEY." },
      { status: 503 },
    );
  }

  const validMessages = messages.filter((message) =>
    message.role === "user" || message.role === "assistant",
  );
  if (!validMessages.length) {
    return NextResponse.json({ error: "No valid messages found." }, { status: 400 });
  }

  const lastMessage = validMessages[validMessages.length - 1];
  if (lastMessage.role !== "user") {
    return NextResponse.json({ error: "Last message must be from user." }, { status: 400 });
  }

  const requestHistory: AssistantHistoryMessage[] = validMessages
    .slice(0, -1)
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));

  try {
    const auth = await getOptionalAuthedSupabase();
    const classes = body.classes ?? [];
    const userMessage = lastMessage.content;
    const attachmentIds = Array.from(
      new Set(
        [...(body.attachmentIds ?? []), ...(body.tutoringContext?.attachmentIds ?? [])].filter(
          Boolean,
        ),
      ),
    );
    const tutoringContext = body.tutoringContext
      ? {
          ...body.tutoringContext,
          attachmentIds:
            attachmentIds.length > 0 ? attachmentIds : body.tutoringContext.attachmentIds,
        }
      : undefined;

    let session: AssistantSession | null = null;
    let persistedHistory: AssistantHistoryMessage[] | null = null;

    if (auth.supabase && auth.userId) {
      session = (
        await ensureAssistantSession(auth.supabase, auth.userId, {
          ...body.session,
          channel: body.session?.channel ?? (tutoringContext ? "tutoring" : "web_chat"),
          classId: body.classId ?? tutoringContext?.classId ?? body.session?.classId,
          taskId: body.taskId ?? tutoringContext?.taskId ?? body.session?.taskId,
          tutoringMode: tutoringContext?.mode ?? body.session?.tutoringMode,
          topic: tutoringContext?.topic ?? body.session?.topic,
          goal: tutoringContext?.goal ?? body.session?.goal,
          studyFocus: tutoringContext?.studyFocus ?? body.session?.studyFocus,
          tutoringContext,
        })
      ).session;

      const existingMessages = await listAssistantSessionMessages(
        auth.supabase,
        auth.userId,
        session.id,
      );

      persistedHistory = existingMessages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.content,
        }));
    }

    const attachments =
      auth.supabase && auth.userId
        ? await loadAssistantAttachmentsForRequest(auth.supabase, auth.userId, {
            ...(attachmentIds.length > 0
              ? { attachmentIds }
              : session?.id
                ? { sessionId: session.id }
                : {}),
          })
        : [];

    const detectedIntent = detectAssistantIntent(userMessage, classes);
    if (detectedIntent === "schedule_setup") {
      const parsedClasses = await parseNaturalLanguageSchedule(
        userMessage,
        body.scheduleArchitecture,
      );

      if (parsedClasses.length > 0) {
        const count = parsedClasses.length;
        let assistantContent = `I parsed **${count} ${count === 1 ? "class" : "classes"}** from your description.`;
        let actionStatus: "completed" | "failed" = "failed";
        let sync: string[] = [];

        if (auth.supabase && auth.userId) {
          try {
            const savedSchedule = await saveParsedSchedule({
              supabase: auth.supabase,
              userId: auth.userId,
              classes: parsedClasses,
            });
            assistantContent = formatScheduleImportResultMessage(savedSchedule, count);
            actionStatus = "completed";
            sync = ["classes"];
          } catch {
            assistantContent =
              `I parsed **${count} ${count === 1 ? "class" : "classes"}** from your description, ` +
              "but I ran into an issue saving them. Please try again or add them from the Classes page.";
          }
        } else {
          assistantContent =
            `I parsed **${count} ${count === 1 ? "class" : "classes"}** from your description, ` +
            "but I couldn't save them because your session isn't connected right now.";
        }

        if (auth.supabase && auth.userId && session) {
          await appendAssistantSessionMessage(auth.supabase, {
            sessionId: session.id,
            userId: auth.userId,
            role: "user",
            contentType: "text",
            content: userMessage,
            metadata: {
              source: "text",
              actionType: "setup_schedule",
            },
          });

          await appendAssistantSessionMessage(auth.supabase, {
            sessionId: session.id,
            userId: auth.userId,
            role: "assistant",
            contentType: "text",
            content: assistantContent,
            metadata: {
              actionType: "setup_schedule",
              actionStatus,
            },
          });

          await appendAssistantSessionEvent(auth.supabase, {
            sessionId: session.id,
            userId: auth.userId,
            eventType: "assistant_response_generated",
            metadata: {
              actionType: "setup_schedule",
              actionStatus,
            },
          });
        }

        return NextResponse.json({
          data: {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: assistantContent,
            createdAt: new Date().toISOString(),
          },
          session,
          sync,
        });
      }
    }

    if (auth.supabase && auth.userId && session) {
      await appendAssistantSessionMessage(auth.supabase, {
        sessionId: session.id,
        userId: auth.userId,
        role: "user",
        contentType: "text",
        content: userMessage,
        metadata: {
          source: "text",
        },
      });

      await appendAssistantSessionEvent(auth.supabase, {
        sessionId: session.id,
        userId: auth.userId,
        eventType: "message_added",
        metadata: {
          source: "text",
        },
      });
    }

    const result = await generateAssistantReply({
      message: userMessage,
      history: persistedHistory ?? requestHistory,
      tasks: body.tasks ?? [],
      classes,
      userId: auth.userId ?? undefined,
      reminderPreferences: body.reminderPreferences,
      effectiveDayType: body.effectiveDayType,
      scheduleArchitecture: body.scheduleArchitecture,
      calendarEntries: body.calendarEntries,
      classId: body.classId ?? tutoringContext?.classId,
      taskId: body.taskId ?? tutoringContext?.taskId,
      attachments,
      tutoringContext,
    });

    let finalizedContent = result.data.content;
    let finalizedActionResult = result.data.actionResult;
    let sync: string[] = [];
    let actionStatus = result.action ? "failed" : "skipped";

    if (result.action) {
      if (auth.supabase && auth.userId) {
        try {
          const assistantData = await loadAssistantData({
            includeCompletedTasks: true,
            userId: auth.userId,
            supabase: auth.supabase,
          });

          const execution = await executeAssistantAction({
            supabase: auth.supabase,
            userId: auth.userId,
            action: result.action,
            assistantContent: result.data.content,
            tasks: assistantData?.tasks ?? [],
            classes: assistantData?.classes ?? [],
            automations: assistantData?.automations ?? [],
            notes: assistantData?.notes ?? [],
            planningItems: assistantData?.planningItems ?? [],
          });

          finalizedContent = execution.content;
          finalizedActionResult = execution.actionResult;
          sync = execution.sync;
          actionStatus = execution.status;
        } catch {
          finalizedContent =
            `${result.data.content.trimEnd()}\n\n` +
            "(I understood that request, but I couldn't confirm the save. Please try again.)";
        }
      } else {
        finalizedContent =
          `${result.data.content.trimEnd()}\n\n` +
          "(I couldn't save that right now because your session isn't connected. Please refresh and try again.)";
      }
    }

    const finalizedMessage = {
      ...result.data,
      content: finalizedContent,
      ...(finalizedActionResult ? { actionResult: finalizedActionResult } : {}),
    };

    if (auth.supabase && auth.userId && session) {
      await appendAssistantSessionMessage(auth.supabase, {
        sessionId: session.id,
        userId: auth.userId,
        role: "assistant",
        contentType: "text",
        content: finalizedMessage.content,
        metadata: result.action
          ? {
              actionType: result.action.type,
              actionStatus,
            }
          : {},
      });

      await appendAssistantSessionEvent(auth.supabase, {
        sessionId: session.id,
        userId: auth.userId,
        eventType: "assistant_response_generated",
        metadata: result.action
          ? {
              actionType: result.action.type,
              actionStatus,
            }
          : {},
      });

      if (session.channel === "tutoring") {
        session = await updateAssistantSession(auth.supabase, auth.userId, session.id, {
          metadata: buildTutoringSessionMetadata({
            session,
            userMessage,
            assistantMessage: finalizedMessage.content,
            classes,
            tasks: body.tasks ?? [],
            attachments,
            tutoringContext,
          }),
        });
      }
    }

    return NextResponse.json({ data: finalizedMessage, session, sync });
  } catch (err) {
    console.error("[AI Chat] Error:", err);
    return NextResponse.json(
      { error: "AI request failed. Please try again." },
      { status: 502 },
    );
  }
}

function buildTutoringSessionMetadata(params: {
  session: AssistantSession;
  userMessage: string;
  assistantMessage: string;
  classes: SchoolClass[];
  tasks: StudentTask[];
  attachments: NonNullable<Awaited<ReturnType<typeof loadAssistantAttachmentsForRequest>>>;
  tutoringContext?: TutoringContext;
}) {
  const assembly = assembleTutoringContext({
    message: [
      params.tutoringContext?.topic,
      params.tutoringContext?.goal,
      params.userMessage,
    ]
      .filter(Boolean)
      .join(" "),
    classes: params.classes,
    tasks: params.tasks,
    attachments: params.attachments,
    tutoringContext: params.tutoringContext,
    classId: params.session.classId ?? params.tutoringContext?.classId,
    taskId: params.session.taskId ?? params.tutoringContext?.taskId,
  });
  const activeMaterialTitles = assembly.selectedMaterials.slice(0, 3).map((material) => material.title);
  const activeAttachmentTitles = assembly.selectedAttachments
    .slice(0, 3)
    .map((attachment) => attachment.title);
  const groundingLabel =
    assembly.groundingStatus === "uploaded_materials"
      ? activeAttachmentTitles.length > 0
        ? `Using uploaded file${activeAttachmentTitles.length === 1 ? "" : "s"}: ${activeAttachmentTitles.join(", ")}`
        : "Using uploaded session files"
      : assembly.groundingStatus === "class_materials"
        ? activeMaterialTitles.length > 0
          ? `Using class material${activeMaterialTitles.length === 1 ? "" : "s"}: ${activeMaterialTitles.join(", ")}`
          : "Using saved class materials"
        : assembly.groundingStatus === "limited_materials"
          ? "Saved materials are linked, but they do not currently provide enough readable text"
          : "Answering generally because no relevant readable materials are active";

  return {
    ...(params.session.metadata ?? {}),
    tutoringResumeSummary: summarizeTutoringResume({
      session: params.session,
      userMessage: params.userMessage,
      assistantMessage: params.assistantMessage,
      className: assembly.linkedClass?.name,
      topic: params.tutoringContext?.topic ?? params.session.topic,
    }),
    tutoringGroundingLabel: groundingLabel,
    tutoringGroundingStatus: assembly.groundingStatus,
    tutoringMaterialTitles: activeMaterialTitles,
    tutoringAttachmentTitles: activeAttachmentTitles,
    tutoringNeedsMoreMaterial:
      assembly.groundingStatus === "limited_materials" ||
      assembly.groundingStatus === "general_only",
    tutoringUpdatedAt: new Date().toISOString(),
  };
}

function summarizeTutoringResume(params: {
  session: AssistantSession;
  userMessage: string;
  assistantMessage: string;
  className?: string;
  topic?: string;
}) {
  const modeLabel = formatTutoringModeLabel(
    params.session.tutoringMode ?? params.session.tutoringContext?.mode,
  );
  const scope = [modeLabel, params.className, params.topic].filter(Boolean).join(" - ");
  const lastTurn = summarizePlainText(params.assistantMessage || params.userMessage, 150);

  return scope ? `${scope}. ${lastTurn}` : lastTurn;
}

function formatTutoringModeLabel(mode?: TutoringContext["mode"]) {
  switch (mode) {
    case "explain":
      return "Explain";
    case "step_by_step":
      return "Step by step";
    case "quiz":
      return "Quiz";
    case "review":
      return "Review";
    case "study_plan":
      return "Study plan";
    case "homework_help":
      return "Homework help";
    default:
      return "";
  }
}

function summarizePlainText(value: string, maxLength: number) {
  const cleaned = value
    .replace(/ACTION:\{.+\}$/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function formatScheduleImportResultMessage(
  result: Awaited<ReturnType<typeof saveParsedSchedule>>,
  parsedCount: number,
) {
  const parts: string[] = [];

  if (result.created.length > 0) {
    parts.push(`added ${result.created.length} ${result.created.length === 1 ? "class" : "classes"}`);
  }
  if (result.updated.length > 0) {
    parts.push(`updated ${result.updated.length} existing ${result.updated.length === 1 ? "class" : "classes"}`);
  }
  if (result.skipped.length > 0) {
    parts.push(`skipped ${result.skipped.length} duplicate ${result.skipped.length === 1 ? "match" : "matches"}`);
  }
  if (result.ambiguous.length > 0) {
    parts.push(`left ${result.ambiguous.length} ambiguous ${result.ambiguous.length === 1 ? "class" : "classes"} unchanged`);
  }

  if (parts.length === 0) {
    return `I parsed ${parsedCount} ${parsedCount === 1 ? "class" : "classes"}, but there was nothing new to save.`;
  }

  const reviewNote =
    result.partial.length > 0
      ? ` ${result.partial.length} ${result.partial.length === 1 ? "class still needs" : "classes still need"} missing schedule details filled in.`
      : "";

  return `Done - I ${parts.join(", ")} in your schedule.${reviewNote}`;
}
