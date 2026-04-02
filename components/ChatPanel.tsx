"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../lib/auth-context";
import { useCalendar } from "../lib/stores/calendarStore";
import { useScheduleConfig } from "../lib/stores/scheduleConfig";
import { useAutomations } from "../lib/stores/automationStore";
import { usePlanningStore } from "../lib/stores/planningStore";
import { useClasses } from "../lib/stores/classStore";
import { useNotes } from "../lib/stores/noteStore";
import { matchNote } from "../lib/notes-data";
import { getScheduleDayOverrideForDate, getTodayDateString } from "../lib/schedule";
import { loadProfile } from "../lib/profile";
import { renderContent } from "../lib/render-content";
import { assembleTutoringContext } from "../lib/assistant-tutoring";
import {
  canUseSpeechSynthesis,
  speakText,
  stopSpeaking,
  useBrowserVoiceInput,
} from "../lib/voice";
import { formatDueDate } from "../lib/datetime";
import { useTaskStore } from "../lib/task-store";
import type {
  AssistantAction,
  PlanningItem,
  PlanningItemKind,
  AssistantSession,
  AssistantSessionInput,
  AssistantSessionMessage,
  ChatMessage,
  StudentNote,
  StudentTask,
  TutoringContext,
  Weekday,
} from "../types";

function matchTask(
  tasks: StudentTask[],
  taskId?: string,
  taskTitle?: string,
): { match: StudentTask | null; ambiguous: boolean } {
  const active = tasks.filter((task) => task.status !== "done");

  if (taskId) {
    const byId = active.find((task) => task.id === taskId);
    if (byId) return { match: byId, ambiguous: false };
  }

  if (!taskTitle) return { match: null, ambiguous: false };

  const needle = taskTitle.trim().toLowerCase();
  const exactMatches = active.filter((task) => task.title.toLowerCase() === needle);
  if (exactMatches.length === 1) return { match: exactMatches[0], ambiguous: false };
  if (exactMatches.length > 1) return { match: null, ambiguous: true };

  const containsMatches = active.filter(
    (task) =>
      task.title.toLowerCase().includes(needle) || needle.includes(task.title.toLowerCase()),
  );
  if (containsMatches.length === 1) return { match: containsMatches[0], ambiguous: false };
  if (containsMatches.length > 1) return { match: null, ambiguous: true };

  return { match: null, ambiguous: false };
}

function matchPlanningItem(
  items: PlanningItem[],
  itemId?: string,
  itemTitle?: string,
  itemKind?: PlanningItemKind,
): { match: PlanningItem | null; ambiguous: boolean; candidates: PlanningItem[] } {
  const scoped = itemKind ? items.filter((item) => item.kind === itemKind) : items;

  if (itemId) {
    const byId = scoped.find((item) => item.id === itemId);
    if (byId) return { match: byId, ambiguous: false, candidates: [byId] };
  }

  if (!itemTitle) {
    return { match: null, ambiguous: false, candidates: [] };
  }

  const needle = itemTitle.trim().toLowerCase();
  const exactMatches = scoped.filter((item) => item.title.toLowerCase() === needle);
  if (exactMatches.length === 1) {
    return { match: exactMatches[0], ambiguous: false, candidates: exactMatches };
  }
  if (exactMatches.length > 1) {
    return { match: null, ambiguous: true, candidates: exactMatches };
  }

  const containsMatches = scoped.filter(
    (item) =>
      item.title.toLowerCase().includes(needle) || needle.includes(item.title.toLowerCase()),
  );
  if (containsMatches.length === 1) {
    return { match: containsMatches[0], ambiguous: false, candidates: containsMatches };
  }
  if (containsMatches.length > 1) {
    return { match: null, ambiguous: true, candidates: containsMatches };
  }

  return { match: null, ambiguous: false, candidates: [] };
}

function formatPlanningKindLabel(kind: PlanningItemKind) {
  return kind === "recurring_activity" ? "activity" : "event";
}

function formatPlanningCandidate(item: PlanningItem) {
  return `- **${item.title}** (${formatPlanningKindLabel(item.kind)})`;
}

function formatNoteCandidate(note: StudentNote) {
  const label = note.title?.trim() ? note.title : note.content;
  return `- **${label}**`;
}

function formatNoteUpdateSummary(
  note: StudentNote,
  updates: {
    content?: string;
    title?: string | null;
  },
) {
  const changeParts: string[] = [];

  if (updates.title !== undefined) {
    changeParts.push(note.title ? `title set to **${note.title}**` : "title cleared");
  }

  if (updates.content !== undefined) {
    changeParts.push("content updated");
  }

  return changeParts;
}

function formatPlanningUpdateSummary(
  item: PlanningItem,
  originalTitle: string,
  updates: {
    kind?: PlanningItemKind;
    title?: string;
    daysOfWeek?: Weekday[] | null;
    date?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    location?: string | null;
    notes?: string | null;
    isAllDay?: boolean;
    enabled?: boolean;
  },
) {
  const changeParts: string[] = [];

  if (updates.title !== undefined && item.title !== originalTitle) {
    changeParts.push(`renamed to **${item.title}**`);
  }
  if (updates.daysOfWeek !== undefined && item.kind === "recurring_activity" && item.daysOfWeek?.length) {
    changeParts.push(`days set to **${item.daysOfWeek.join(", ")}**`);
  }
  if (updates.date !== undefined) {
    if (item.kind === "one_off_event" && item.date) {
      changeParts.push(`date set to **${item.date}**`);
    } else if (updates.date === null) {
      changeParts.push("date cleared");
    }
  }
  if (updates.isAllDay !== undefined && item.isAllDay) {
    changeParts.push("set to **all day**");
  } else if ((updates.startTime !== undefined || updates.endTime !== undefined) && item.startTime && item.endTime) {
    changeParts.push(`time set to **${item.startTime}-${item.endTime}**`);
  } else if (updates.startTime !== undefined && item.startTime) {
    changeParts.push(`start time set to **${item.startTime}**`);
  } else if (
    (updates.startTime === null || updates.endTime === null) &&
    !item.startTime &&
    !item.endTime
  ) {
    changeParts.push("time cleared");
  }
  if (updates.location !== undefined) {
    if (item.location) {
      changeParts.push(`location set to **${item.location}**`);
    } else if (updates.location === null) {
      changeParts.push("location cleared");
    }
  }
  if (updates.notes !== undefined) {
    if (item.notes) {
      changeParts.push("notes updated");
    } else if (updates.notes === null) {
      changeParts.push("notes cleared");
    }
  }
  if (updates.enabled !== undefined) {
    changeParts.push(item.enabled ? "enabled" : "disabled");
  }

  return changeParts;
}

// ── Contextual suggestions ────────────────────────────────────────────────────

function getContextualPrompts(params: {
  hasClasses: boolean;
  hasActiveTasks: boolean;
  tutoringActive: boolean;
  tutoringMode?: string;
}): string[] {
  if (params.tutoringActive) {
    if (params.tutoringMode === "quiz") {
      return ["Start the quiz", "Make it harder", "Explain that answer"];
    }
    if (params.tutoringMode === "study_plan") {
      return ["Build me a weekly plan", "What should I start with?", "How long until the exam?"];
    }
    if (params.tutoringMode === "homework_help") {
      return ["Help me get started", "Check my work", "Give me a hint"];
    }
    if (params.tutoringMode === "step_by_step") {
      return ["Walk me through the next step", "I'm stuck — help me", "Explain this part again"];
    }
    // explain, review
    return [
      "Explain the key concepts",
      "What are the most important points?",
      "Give me a practice problem",
    ];
  }

  if (!params.hasClasses) {
    // New user — guide toward setup
    return [
      "Help me add my class schedule",
      "What can you help me with?",
      "I'm new here — walk me through this",
    ];
  }
  if (!params.hasActiveTasks) {
    // Has classes, but no tasks yet
    return [
      "Add a homework assignment",
      "I have a test this week — track it",
      "What do I have today?",
    ];
  }
  // Has both — general power-user prompts
  return [
    "What should I study tonight?",
    "Help me prioritize this week",
    "What's due soon?",
  ];
}

// ── TTS helper ────────────────────────────────────────────────────────────────

function toSpokenText(content: string): string {
  return content
    .replace(/^###\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .trim();
}

// ── Attachment state ──────────────────────────────────────────────────────────

type AttachmentUploadState = {
  file: File;
  status: "uploading" | "ready" | "failed";
  id?: string;
  error?: string;
};

// ── Initial greeting ──────────────────────────────────────────────────────────

function buildInitialGreeting(tutoringContext?: TutoringContext): ChatMessage {
  return {
    id: tutoringContext ? "chat-greeting-tutoring" : "chat-greeting",
    role: "assistant",
    content: tutoringContext
      ? "Hi! I can help you study this topic, explain the material, and work through questions step by step."
      : "Hi! I can help you capture school tasks, review what's due, and think through your workload.",
    createdAt: new Date().toISOString(),
  };
}

function getSessionStorageKey(tutoringContext?: TutoringContext) {
  return tutoringContext ? "scc-chat-session:tutoring" : "scc-chat-session:web_chat";
}

function mapStoredSessionMessage(message: AssistantSessionMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  };
}

// ── ChatPanel ─────────────────────────────────────────────────────────────────

export function ChatPanel({
  initialQuery,
  preferredSessionId,
  tutoringContext,
  onTutoringContextChange,
  onSessionChange,
  onOpenTutoring,
}: {
  initialQuery?: string;
  preferredSessionId?: string | null;
  tutoringContext?: TutoringContext;
  onTutoringContextChange?: (updates: Partial<TutoringContext>) => void;
  onSessionChange?: (session: AssistantSession | null) => void;
  onOpenTutoring?: () => void;
}) {
  const { user, loading: authLoading } = useAuth();
  const initialGreeting = useMemo(() => buildInitialGreeting(tutoringContext), [tutoringContext]);
  const [messages, setMessages] = useState<ChatMessage[]>([initialGreeting]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [failedInput, setFailedInput] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [voiceAutoRead, setVoiceAutoRead] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<AttachmentUploadState | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profile = loadProfile();
  const { tasks, addTask, updateTask, completeTask: completeStoredTask, reloadTasks } = useTaskStore();
  const { classes, addClasses, reloadClasses } = useClasses();
  const { notes, addNote, updateNote, deleteNote, reloadNotes } = useNotes();
  const { entries: calendarEntries } = useCalendar();
  const { todayDayType, scheduleArchitecture } = useScheduleConfig();
  const { addAutomation, reloadAutomations } = useAutomations();
  const {
    items: planningItems,
    addItem: addPlanningItem,
    updateItem: updatePlanningItem,
    removeItem: removePlanningItem,
    reloadItems: reloadPlanningItems,
  } = usePlanningStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialSendRef = useRef(false);
  const sessionStorageKey = useMemo(
    () => getSessionStorageKey(tutoringContext),
    [tutoringContext],
  );

  useEffect(() => {
    setSpeechSupported(canUseSpeechSynthesis());
  }, []);

  // Restore the latest persisted thread. Prefer server-backed sessions when signed in,
  // and fall back to local-only history if we don't have an authenticated user yet.
  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    const hydrateMessagesForSession = async (candidateSessionId: string) => {
      const response = await fetch(`/api/assistant/sessions/${candidateSessionId}/messages`, {
        cache: "no-store",
      });
      const json = (await response.json()) as {
        data?: AssistantSessionMessage[];
        error?: string;
      };

      if (!response.ok || !json.data) {
        throw new Error(json.error ?? "Failed to load session messages.");
      }

      const hydratedMessages = json.data.map(mapStoredSessionMessage);
      if (!cancelled) {
        setSessionId(candidateSessionId);
        setMessages(hydratedMessages.length > 0 ? hydratedMessages : [initialGreeting]);
      }
      return true;
    };

    const loadPersistedThread = async () => {
      if (initialQuery && !initialSendRef.current) {
        localStorage.removeItem(sessionStorageKey);
        localStorage.removeItem("scc-chat-history");
        setSessionId(null);
        setMessages([initialGreeting]);
        onSessionChange?.(null);
        return;
      }

      const storedSessionId = localStorage.getItem(sessionStorageKey);
      const candidateSessionIds = Array.from(
        new Set([preferredSessionId, storedSessionId].filter((value): value is string => Boolean(value))),
      );

      if (user) {
        for (const candidateSessionId of candidateSessionIds) {
          try {
            const didHydrate = await hydrateMessagesForSession(candidateSessionId);
            if (didHydrate) return;
          } catch {
            // Try the next candidate, then fall back to latest durable session or local history.
          }
        }

        try {
          const channel =
            sessionStorageKey === "scc-chat-session:tutoring" ? "tutoring" : "web_chat";
          const response = await fetch(
            `/api/assistant/sessions?channel=${channel}&status=active&limit=1`,
            { cache: "no-store" },
          );
          const json = (await response.json()) as {
            data?: AssistantSession[];
            error?: string;
          };

          const latestSessionId = json.data?.[0]?.id;
          if (response.ok && latestSessionId) {
            const didHydrate = await hydrateMessagesForSession(latestSessionId);
            if (didHydrate) {
              onSessionChange?.(json.data?.[0] ?? null);
              return;
            }
          }
        } catch {
          // Fall back to local history below if the latest durable session can't be restored.
        }
      }

      try {
        const rawHistory = localStorage.getItem("scc-chat-history");
        if (!rawHistory) {
          if (!cancelled) {
            setMessages([initialGreeting]);
          }
          return;
        }

        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed) && parsed.length > 0 && !cancelled) {
          setMessages(parsed as ChatMessage[]);
        }
      } catch {
        if (!cancelled) {
          setMessages([initialGreeting]);
        }
      }
    };

    void loadPersistedThread();
    return () => {
      cancelled = true;
    };
  }, [authLoading, initialGreeting, initialQuery, onSessionChange, preferredSessionId, sessionStorageKey, user]);

  // Persist chat history on every change (capped at 50 messages)
  useEffect(() => {
    try {
      localStorage.setItem("scc-chat-history", JSON.stringify(messages.slice(-50)));
    } catch {}
  }, [messages]);

  useEffect(() => {
    try {
      if (sessionId) {
        localStorage.setItem(sessionStorageKey, sessionId);
      } else {
        localStorage.removeItem(sessionStorageKey);
      }
    } catch {}
  }, [sessionId, sessionStorageKey]);

  const {
    state: voiceState,
    error: voiceError,
    isSupported: voiceSupported,
    isListening,
    isTranscribing,
    start: startListening,
    stop: stopListening,
    cancel: cancelListening,
    clearError: clearVoiceError,
  } = useBrowserVoiceInput((transcript) => {
    setLastTranscript(transcript);
    setInput((prev) => (prev ? `${prev.trimEnd()} ${transcript}` : transcript));
    textareaRef.current?.focus();
  });

  const activeTasks = tasks.filter((t) => t.status !== "done");
  const suggestedPrompts = useMemo(
    () =>
      getContextualPrompts({
        hasClasses: classes.length > 0,
        hasActiveTasks: activeTasks.length > 0,
        tutoringActive: !!tutoringContext,
        tutoringMode: tutoringContext?.mode,
      }),
    [classes.length, activeTasks.length, tutoringContext],
  );
  const activeTutoringSummary = useMemo(() => {
    if (!tutoringContext) return null;

    return assembleTutoringContext({
      message: [tutoringContext.topic, tutoringContext.goal, tutoringContext.studyFocus]
        .filter(Boolean)
        .join(" "),
      classes,
      tasks,
      attachments: [],
      tutoringContext,
      classId: tutoringContext.classId,
      taskId: tutoringContext.taskId,
    });
  }, [classes, tasks, tutoringContext]);
  const visibleTutoringGroundingStatus =
    tutoringContext?.attachmentIds?.length && tutoringContext.attachmentIds.length > 0
      ? "uploaded_materials"
      : activeTutoringSummary?.groundingStatus;

  useEffect(() => {
    if (initialQuery && !initialSendRef.current) {
      initialSendRef.current = true;
      void sendMessage(initialQuery, [initialGreeting]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGreeting, initialQuery]);

  useEffect(() => {
    setMessages((current) => {
      if (current.some((message) => message.role === "user")) {
        return current;
      }

      return [initialGreeting];
    });
  }, [initialGreeting]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  // ── File attachment upload ────────────────────────────────────────────────

  const readJsonResponse = useCallback(async (response: Response) => {
    try {
      return (await response.json()) as { data?: { id?: string }; error?: string };
    } catch {
      return {
        error: response.ok
          ? "The upload finished, but the server returned an unreadable response."
          : "The upload failed before the server could return a usable error message.",
      };
    }
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = ""; // reset so same file can be re-selected

      setAttachment({ file, status: "uploading" });

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", file.name);
        if (file.type.startsWith("image/")) {
          formData.append("attachmentType", "image");
        }
        if (tutoringContext?.classId) {
          formData.append("classId", tutoringContext.classId);
        }
        if (sessionId) {
          formData.append("sessionId", sessionId);
        }

        const res = await fetch("/api/assistant/attachments", {
          method: "POST",
          body: formData,
        });
        const json = await readJsonResponse(res);

        if (res.ok) {
          setAttachment((prev) =>
            prev ? { ...prev, status: "ready", id: json.data?.id, error: undefined } : null,
          );
          if (tutoringContext && json.data?.id) {
            const attachmentIds = tutoringContext.attachmentIds ?? [];
            if (!attachmentIds.includes(json.data.id)) {
              onTutoringContextChange?.({
                attachmentIds: [...attachmentIds, json.data.id],
              });
            }
          }
        } else {
          setAttachment((prev) =>
            prev
              ? {
                  ...prev,
                  status: "failed",
                  error: json.error ?? "This file could not be uploaded.",
                }
              : null,
          );
        }
      } catch (error) {
        setAttachment((prev) =>
          prev
            ? {
                ...prev,
                status: "failed",
                error: error instanceof Error ? error.message : "This file could not be uploaded.",
              }
            : null,
        );
      }
    },
    [onTutoringContextChange, readJsonResponse, sessionId, tutoringContext],
  );

  // ── TTS ───────────────────────────────────────────────────────────────────

  const speakMessage = useCallback((message: ChatMessage) => {
    const spoken = toSpokenText(message.content);
    const didStart = speakText(spoken, {
      onEnd: () =>
        setSpeakingMessageId((current) =>
          current === message.id ? null : current,
        ),
    });
    if (didStart) {
      setSpeakingMessageId(message.id);
    } else {
      setSpeakingMessageId(null);
    }
  }, []);

  // ── Send message ─────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string, currentMessages: ChatMessage[]) => {
      if (!text || isLoading) return;

      cancelListening();

      // Build the display message — include attachment name if present
      const displayText =
        attachment && attachment.status === "ready"
          ? `${text}\n\n[Attached: ${attachment.file.name}]`
          : text;

      const timestamp = new Date().toISOString();
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: displayText,
        createdAt: timestamp,
      };
      const loadingMessage: ChatMessage = {
        id: `loading-${Date.now()}`,
        role: "assistant",
        content: "...",
        createdAt: timestamp,
      };

      setMessages([...currentMessages, userMessage, loadingMessage]);
      setFailedInput(null);
      setLastTranscript(null);
      setIsLoading(true);

      // Capture and clear attachment before async work
      const sentAttachment = attachment;
      setAttachment(null);

      try {
        const sessionPayload: AssistantSessionInput = {
          ...(sessionId ? { id: sessionId } : {}),
          channel: tutoringContext ? "tutoring" : "web_chat",
          classId: tutoringContext?.classId,
          taskId: tutoringContext?.taskId,
          tutoringMode: tutoringContext?.mode,
          topic: tutoringContext?.topic,
          goal: tutoringContext?.goal,
          studyFocus: tutoringContext?.studyFocus,
          tutoringContext,
        };

        // Build the full messages array: history + new user message
        const apiMessages = [
          ...currentMessages
            .filter((m) => m.role !== "system")
            .map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: text },
        ];

        // Compute effective day type client-side for schedule context
        const todayDateStr = getTodayDateString();
        const calendarAbOverride = getScheduleDayOverrideForDate(calendarEntries, todayDateStr);
        const effectiveDayType = calendarAbOverride ?? todayDayType;

        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            classes,
            tasks,
            effectiveDayType,
            scheduleArchitecture,
            calendarEntries,
            attachmentIds:
              sentAttachment?.status === "ready" && sentAttachment.id
                ? Array.from(
                    new Set([...(tutoringContext?.attachmentIds ?? []), sentAttachment.id]),
                  )
                : tutoringContext?.attachmentIds,
            classId: tutoringContext?.classId,
            taskId: tutoringContext?.taskId,
            tutoringContext,
            session: sessionPayload,
          }),
        });

        if (!response.ok) {
          let serverError = "AI request failed.";
          try {
            const errJson = (await response.json()) as { error?: string };
            if (errJson.error) serverError = errJson.error;
          } catch {
            // ignore
          }
          throw new Error(serverError);
        }

        const json = (await response.json()) as {
          data?: ChatMessage;
          action?: AssistantAction;
          session?: AssistantSession | null;
          sync?: Array<"tasks" | "classes" | "notes" | "planningItems" | "automations">;
          error?: string;
        };

        if (json.error || !json.data) {
          throw new Error(json.error ?? "No response from AI.");
        }

        if (json.session?.id) {
          setSessionId(json.session.id);
          onSessionChange?.(json.session);
        }

        if (json.sync?.length) {
          const reloads = json.sync.map((target) => {
            switch (target) {
              case "tasks":
                return reloadTasks();
              case "classes":
                return reloadClasses();
              case "notes":
                return reloadNotes();
              case "planningItems":
                return reloadPlanningItems();
              case "automations":
                return reloadAutomations();
            }
          });

          await Promise.allSettled(reloads);
        }

        const assistantMessage: ChatMessage = json.data;

        // Handle create_automation action
        if (json.action?.type === "create_automation") {
          const auto = json.action.automation;
          const isValid =
            auto &&
            typeof auto.type === "string" &&
            typeof auto.title === "string" &&
            auto.title.trim().length > 0 &&
            typeof auto.scheduleDescription === "string" &&
            auto.scheduleDescription.trim().length > 0 &&
            typeof auto.scheduleConfig === "object" &&
            auto.scheduleConfig !== null &&
            typeof auto.enabled === "boolean" &&
            typeof auto.deliveryChannel === "string";

          if (isValid) {
            try {
              await addAutomation(auto);
              assistantMessage.content =
                assistantMessage.content.trimEnd() +
                "\n\nSaved to your [Automations](/automations).";
            } catch {
              assistantMessage.content =
                assistantMessage.content.trimEnd() +
                "\n\n(I ran into an issue saving that reminder. You can add it manually in [Automations](/automations).)";
            }
          } else {
            assistantMessage.content =
              assistantMessage.content.trimEnd() +
              "\n\n(I wasn't able to set that up automatically. Try describing the reminder again or add it in [Automations](/automations).)";
          }
        }

        if (json.action?.type === "create_planning_item") {
          try {
            await addPlanningItem({
              ...json.action.item,
              enabled: json.action.item.enabled ?? true,
              startTime: json.action.item.startTime ?? undefined,
              endTime: json.action.item.endTime ?? undefined,
              location: json.action.item.location ?? undefined,
              notes: json.action.item.notes ?? undefined,
            });
            assistantMessage.content =
              assistantMessage.content.trimEnd() +
              "\n\nSaved to your [Activities](/activities).";
          } catch {
            assistantMessage.content =
              assistantMessage.content.trimEnd() +
              "\n\n(I couldn't save that planning item automatically. Try again in [Activities](/activities).)";
          }
        }

        if (json.action?.type === "update_planning_item") {
          const { match, ambiguous, candidates } = matchPlanningItem(
            planningItems,
            json.action.itemId,
            json.action.itemTitle,
            json.action.itemKind,
          );

          if (match) {
            try {
              const originalTitle = match.title;
              const patched = await updatePlanningItem(match.id, {
                ...(json.action.updates.kind !== undefined ? { kind: json.action.updates.kind } : {}),
                ...(json.action.updates.title !== undefined ? { title: json.action.updates.title } : {}),
                ...(json.action.updates.daysOfWeek !== undefined
                  ? { daysOfWeek: json.action.updates.daysOfWeek }
                  : {}),
                ...(json.action.updates.date !== undefined ? { date: json.action.updates.date } : {}),
                ...(json.action.updates.startTime !== undefined
                  ? { startTime: json.action.updates.startTime }
                  : {}),
                ...(json.action.updates.endTime !== undefined
                  ? { endTime: json.action.updates.endTime }
                  : {}),
                ...(json.action.updates.location !== undefined
                  ? { location: json.action.updates.location }
                  : {}),
                ...(json.action.updates.notes !== undefined ? { notes: json.action.updates.notes } : {}),
                ...(json.action.updates.isAllDay !== undefined
                  ? { isAllDay: json.action.updates.isAllDay }
                  : {}),
                ...(json.action.updates.enabled !== undefined
                  ? { enabled: json.action.updates.enabled }
                  : {}),
              });

              const changeParts = formatPlanningUpdateSummary(
                patched,
                originalTitle,
                json.action.updates,
              );
              const kindLabel = formatPlanningKindLabel(patched.kind);
              assistantMessage.content = changeParts.length > 0
                ? `Updated your ${kindLabel} — **${patched.title}**: ${changeParts.join(", ")}.`
                : `Updated your ${kindLabel} — **${patched.title}** is saved.`;
            } catch {
              assistantMessage.content =
                `I found **${match.title}**, but I ran into an issue saving that change. Please try again or edit it in [Activities](/activities).`;
            }
          } else if (ambiguous) {
            const list = candidates.slice(0, 5).map(formatPlanningCandidate).join("\n");
            assistantMessage.content =
              `I found a few saved activities or events that could match — which one did you mean?\n\n${list}`;
          } else {
            const itemLabel = json.action.itemTitle ? `"${json.action.itemTitle}"` : "that item";
            assistantMessage.content =
              `I couldn't find ${itemLabel} in your saved activities or events. Can you describe it a little differently?`;
          }
        }

        if (json.action?.type === "delete_planning_item") {
          const { match, ambiguous, candidates } = matchPlanningItem(
            planningItems,
            json.action.itemId,
            json.action.itemTitle,
            json.action.itemKind,
          );

          if (match) {
            try {
              await removePlanningItem(match.id);
              assistantMessage.content =
                `Done - I removed **${match.title}** from your ${formatPlanningKindLabel(match.kind)} list.`;
            } catch {
              assistantMessage.content =
                `I found **${match.title}**, but I couldn't remove it right now. Please try again or delete it in [Activities](/activities).`;
            }
          } else if (ambiguous) {
            const list = candidates.slice(0, 5).map(formatPlanningCandidate).join("\n");
            assistantMessage.content =
              `I found a few saved activities or events that could match — which one should I remove?\n\n${list}`;
          } else {
            const itemLabel = json.action.itemTitle ? `"${json.action.itemTitle}"` : "that item";
            assistantMessage.content =
              `I couldn't find ${itemLabel} in your saved activities or events. Can you describe it a little differently?`;
          }
        }

        if (json.action?.type === "add_note") {
          const { note } = json.action;
          let classId: string | undefined;
          if (note.className?.trim()) {
            const needle = note.className.toLowerCase();
            classId = classes.find(
              (schoolClass) =>
                schoolClass.name.toLowerCase().includes(needle) ||
                needle.includes(schoolClass.name.toLowerCase()),
            )?.id;
          }

          try {
            const savedNote = await addNote({
              content: note.content,
              title: note.title ?? undefined,
              classId,
            });
            assistantMessage.content = classId || !note.className
              ? `Done - I saved that to your notes${savedNote.title ? ` as **${savedNote.title}**` : ""}.`
              : `Done - I saved that to your notes${savedNote.title ? ` as **${savedNote.title}**` : ""}. I couldn't confidently match "${note.className}" to one of your saved classes, so I left it uncategorized.`;
          } catch {
            assistantMessage.content =
              "I understood the note, but I ran into an issue saving it. Please try again.";
          }
        }

        if (json.action?.type === "update_note") {
          const { match, ambiguous, candidates } = matchNote(notes, {
            noteId: json.action.noteId,
            noteTitle: json.action.noteTitle,
            noteContent: json.action.noteContent,
          });

          if (match) {
            let classId: string | null | undefined;
            if (json.action.updates.className !== undefined) {
              if (json.action.updates.className === null) {
                classId = null;
              } else {
                const needle = json.action.updates.className.toLowerCase();
                classId =
                  classes.find(
                    (schoolClass) =>
                      schoolClass.name.toLowerCase().includes(needle) ||
                      needle.includes(schoolClass.name.toLowerCase()),
                  )?.id ?? match.classId ?? null;
              }
            }

            try {
              const patched = await updateNote(match.id, {
                ...(json.action.updates.content !== undefined
                  ? { content: json.action.updates.content }
                  : {}),
                ...(json.action.updates.title !== undefined
                  ? { title: json.action.updates.title }
                  : {}),
                ...(json.action.updates.className !== undefined ? { classId } : {}),
              });
              const changeParts = formatNoteUpdateSummary(patched, {
                content: json.action.updates.content,
                title: json.action.updates.title,
              });
              assistantMessage.content = changeParts.length > 0
                ? `Updated your note${patched.title ? ` - **${patched.title}**` : ""}: ${changeParts.join(", ")}.`
                : `Updated your note${patched.title ? ` - **${patched.title}**` : ""}.`;
            } catch {
              assistantMessage.content =
                `I found that note, but I ran into an issue saving the update. Please try again.`;
            }
          } else if (ambiguous) {
            const list = candidates.slice(0, 5).map(formatNoteCandidate).join("\n");
            assistantMessage.content =
              `I found a few notes that could match - which one did you mean?\n\n${list}`;
          } else {
            assistantMessage.content =
              "I couldn't find that note in your saved memory. Can you quote a bit of it for me?";
          }
        }

        if (json.action?.type === "delete_note") {
          const { match, ambiguous, candidates } = matchNote(notes, {
            noteId: json.action.noteId,
            noteTitle: json.action.noteTitle,
            noteContent: json.action.noteContent,
          });

          if (match) {
            try {
              await deleteNote(match.id);
              assistantMessage.content = `Done - I deleted that note${match.title ? ` (**${match.title}**)` : ""}.`;
            } catch {
              assistantMessage.content =
                "I found that note, but I couldn't delete it right now. Please try again.";
            }
          } else if (ambiguous) {
            const list = candidates.slice(0, 5).map(formatNoteCandidate).join("\n");
            assistantMessage.content =
              `I found a few notes that could match - which one should I delete?\n\n${list}`;
          } else {
            assistantMessage.content =
              "I couldn't find that note in your saved memory. Can you describe it a little differently?";
          }
        }

        // Handle complete_task action
        if (json.action?.type === "complete_task") {
          const { taskId, taskTitle } = json.action;
          const { match, ambiguous } = matchTask(tasks, taskId, taskTitle);

          if (match) {
            await completeStoredTask(match.id);
            assistantMessage.content = `Done — I marked **${match.title}** as complete.`;
          } else if (ambiguous) {
            const needle = (taskTitle ?? "").toLowerCase();
            const candidates = activeTasks
              .filter(
                (t) =>
                  t.title.toLowerCase().includes(needle) ||
                  needle.includes(t.title.toLowerCase()),
              )
              .slice(0, 5);
            const list = candidates.map((t) => `- ${t.title}`).join("\n");
            assistantMessage.content = `I found a few tasks that could match — which one did you finish?\n\n${list}`;
          } else {
            const taskLabel = taskTitle ? `"${taskTitle}"` : "that task";
            assistantMessage.content = `I couldn't find ${taskLabel} in your task list. Can you give me a bit more detail?`;
          }
        }

        // Handle update_task action
        if (json.action?.type === "update_task") {
          const { taskId, taskTitle, updates } = json.action;
          const { match, ambiguous } = matchTask(tasks, taskId, taskTitle);

          if (match) {
            try {
              const patched = await updateTask(match.id, {
                ...(updates.title ? { title: updates.title } : {}),
                ...(updates.dueAt !== undefined ? { dueAt: updates.dueAt ?? undefined } : {}),
                ...(updates.description !== undefined
                  ? { description: updates.description ?? undefined }
                  : {}),
                ...(updates.status ? { status: updates.status } : {}),
              });
              assistantMessage.actionResult = {
                type: "task_updated",
                title: patched.title,
                dueAt: patched.dueAt,
              };
              // Build explicit confirmation from what actually changed
              const changeParts: string[] = [];
              if (updates.title && patched.title !== match.title) {
                changeParts.push(`renamed to **${patched.title}**`);
              }
              if (updates.dueAt !== undefined) {
                const duePart = patched.dueAt
                  ? `due date moved to **${formatDueDate(patched.dueAt)}**`
                  : "due date cleared";
                changeParts.push(duePart);
              }
              if (updates.description !== undefined) {
                changeParts.push("notes updated");
              }
              if (updates.status) {
                changeParts.push(`status set to **${updates.status}**`);
              }
              const taskRef = `**${patched.title}**`;
              if (changeParts.length > 0) {
                assistantMessage.content = `Updated — ${taskRef}: ${changeParts.join(", ")}.`;
              } else {
                assistantMessage.content = `Updated **${patched.title}** — saved to your tasks.`;
              }
            } catch {
              assistantMessage.content = `I found **${match.title}** but ran into an issue saving the update. Please try again or edit it directly in Tasks.`;
            }
          } else if (ambiguous) {
            const needle = (taskTitle ?? "").toLowerCase();
            const candidates = activeTasks
              .filter((t) =>
                t.title.toLowerCase().includes(needle) || needle.includes(t.title.toLowerCase()),
              )
              .slice(0, 4);
            const list = candidates.map((t) => `- **${t.title}**`).join("\n");
            assistantMessage.content = `I found a few tasks that could match — which one did you mean?\n\n${list}\n\nJust tell me which one and I'll update it.`;
          } else {
            const taskLabel = taskTitle ? `"${taskTitle}"` : "that task";
            assistantMessage.content = `I couldn't find ${taskLabel} in your task list. Can you describe it differently?`;
          }
        }

        // Handle add_task action
        if (json.action?.type === "add_task") {
          const { task: taskData } = json.action;
          // Resolve className to classId via fuzzy match
          let classId: string | undefined;
          if (taskData.className) {
            const needle = taskData.className.toLowerCase();
            classId = classes.find(
              (c) =>
                c.name.toLowerCase().includes(needle) ||
                needle.includes(c.name.toLowerCase()),
            )?.id;
          }
          try {
            const localTask = await addTask({
              title: taskData.title,
              dueAt: taskData.dueAt ?? undefined,
              description: taskData.description ?? undefined,
              type: taskData.type ?? undefined,
              classId,
              source: "chat",
              status: "todo",
            });
            assistantMessage.actionResult = {
              type: "task_added",
              title: localTask.title,
              dueAt: localTask.dueAt,
            };
            assistantMessage.content = classId || !taskData.className
              ? `Done - I added **${localTask.title}** to your tasks.`
              : `Done - I added **${localTask.title}** to your tasks. I couldn't confidently match "${taskData.className}" to one of your saved classes, so I left it uncategorized.`;
          } catch {
            assistantMessage.content =
              "I understood the task, but I ran into an issue saving it. Please try again or add it from Tasks.";
          }
        }

        // Handle setup_schedule action — save parsed classes to the shared classes store.
        if (json.action?.type === "setup_schedule") {
          const newClasses = json.action.classes ?? [];
          if (newClasses.length > 0) {
            try {
              await addClasses(
                newClasses.map((schoolClass) => ({
                  ...schoolClass,
                  days: (schoolClass.days ?? []) as Weekday[],
                  startTime: schoolClass.startTime ?? "",
                  endTime: schoolClass.endTime ?? "",
                })),
              );
              assistantMessage.content = `Done - I added ${newClasses.length} ${newClasses.length === 1 ? "class" : "classes"} to your schedule.`;
            } catch {
              assistantMessage.content =
                assistantMessage.content.trimEnd() +
                "\n\n(There was an issue saving your classes. Try describing them again or add them in Settings.)";
            }
          }
        }

        setMessages((current) => [...current.slice(0, -1), assistantMessage]);

        if (voiceAutoRead && speechSupported && assistantMessage.content.trim()) {
          speakMessage(assistantMessage);
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Something went wrong.";
        setFailedInput(text);
        setMessages((current) => [
          ...current.slice(0, -1),
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: detail,
            createdAt: new Date().toISOString(),
            failed: true,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      addAutomation,
      addNote,
      addPlanningItem,
      planningItems,
      deleteNote,
      removePlanningItem,
      addClasses,
      addTask,
      attachment,
      calendarEntries,
      classes,
      completeStoredTask,
      isLoading,
      speechSupported,
      speakMessage,
      cancelListening,
      sessionId,
      notes,
      tasks,
      activeTasks,
      todayDayType,
      tutoringContext,
      updateNote,
      updateTask,
      updatePlanningItem,
      voiceAutoRead,
      onSessionChange,
      scheduleArchitecture,
      reloadTasks,
      reloadClasses,
      reloadNotes,
      reloadPlanningItems,
      reloadAutomations,
    ],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput) return;
    setInput("");
    await sendMessage(trimmedInput, messages);
  };

  const handleRetry = useCallback(() => {
    if (!failedInput) return;
    const retryText = failedInput;
    const withoutFailed = messages.filter((m) => !m.failed);
    setMessages(withoutFailed);
    void sendMessage(retryText, withoutFailed);
  }, [failedInput, messages, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const trimmedInput = input.trim();
      if (trimmedInput) {
        setInput("");
        void sendMessage(trimmedInput, messages);
      }
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    cancelListening();
    setInput(prompt);
    setLastTranscript(null);
    textareaRef.current?.focus();
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    if (lastTranscript) {
      setLastTranscript(null);
    }
  };

  const handleVoiceToggle = () => {
    if (isListening || isTranscribing) {
      stopListening();
      return;
    }

    setLastTranscript(null);
    clearVoiceError();
    startListening();
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const hasUserMessages = messages.some((m) => m.role === "user");
  const showVoiceTranscriptHint = Boolean(lastTranscript && input.trim());
  const voiceStatusText = isListening
    ? "Listening. Tap again when you're done."
    : isTranscribing
      ? "Finishing that voice note..."
      : voiceState === "error"
        ? voiceError
        : voiceSupported
          ? "Tap the mic for one short voice note, then review before sending."
          : "Voice input is not supported in this browser.";

  // ── Render ────────────────────────────────────────────────────────────────

  const handleClearChat = async () => {
    cancelListening();
    setLastTranscript(null);
    setMessages([initialGreeting]);
    const currentSessionId = sessionId;
    setSessionId(null);
    onSessionChange?.(null);

    try {
      localStorage.removeItem("scc-chat-history");
      localStorage.removeItem(sessionStorageKey);
    } catch {}

    if (user && currentSessionId) {
      try {
        await fetch(`/api/assistant/sessions/${currentSessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: { status: "archived" } }),
        });
      } catch {
        // Keep the local clear responsive even if archiving fails.
      }
    }
  };

  const starterPromptChips = tutoringContext
    ? suggestedPrompts
    : activeTasks.length === 0
      ? ["Add my first task", "Set up my schedule", "What can you help with?"]
      : ["What's due today?", "Update a task", "What should I work on tonight?"];

  return (
    <div className="flex flex-1 flex-col overflow-hidden pt-4">
      {/* Clear chat button — only when there are user messages */}
      {hasUserMessages && (
        <div className="flex shrink-0 justify-end pb-1">
          <button
            type="button"
            onClick={handleClearChat}
            className="text-xs text-muted transition hover:text-foreground"
          >
            Clear chat
          </button>
        </div>
      )}
      {/* Message list */}
      <div ref={scrollRef} className="chat-scroll flex-1 space-y-5 overflow-y-auto pb-2 pr-1">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            canReadAloud={
              speechSupported &&
              message.role === "assistant" &&
              message.content !== "..."
            }
            isSpeaking={speakingMessageId === message.id}
            onRetry={message.failed ? handleRetry : undefined}
            onSpeak={
              speechSupported &&
              message.role === "assistant" &&
              message.content !== "..."
                ? () => {
                    if (speakingMessageId === message.id) {
                      stopSpeaking();
                      setSpeakingMessageId(null);
                    } else {
                      speakMessage(message);
                    }
                  }
                : undefined
            }
          />
        ))}

        {/* Suggested prompts — shown before first user message */}
        {!hasUserMessages && (
          <div className="pl-10 pt-1">
            <div className="flex flex-wrap gap-2">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSuggestedPrompt(prompt)}
                  className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-muted transition-all hover:border-sidebar-accent/40 hover:bg-surface hover:text-foreground active:scale-[0.97]"
                >
                  {prompt}
                </button>
              ))}
              {/* Tutoring chip when not in tutoring mode */}
              {!tutoringContext && onOpenTutoring && (
                <button
                  key="start-tutoring"
                  type="button"
                  onClick={onOpenTutoring}
                  className="flex items-center gap-1.5 rounded-xl border border-sidebar-accent/20 bg-sidebar-accent/5 px-3 py-1.5 text-xs font-medium text-sidebar-accent transition-all hover:border-sidebar-accent/40 hover:bg-sidebar-accent/10 active:scale-[0.97]"
                >
                  <span>🎓</span>
                  <span>Start tutoring session</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Context-aware suggestion chips — always visible above the input bar */}
      <div className="shrink-0 py-2">
        <div className="flex flex-wrap gap-2">
          {starterPromptChips.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={isLoading}
              onClick={() => void sendMessage(chip, messages)}
              className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-muted transition-all hover:border-sidebar-accent/40 hover:bg-surface hover:text-foreground active:scale-[0.97] disabled:opacity-40"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border pt-4">
        <form onSubmit={handleSend} className="space-y-2">
          {/* Active session files strip — shown when tutoring context carries uploaded files */}
          {tutoringContext?.attachmentIds && tutoringContext.attachmentIds.length > 0 && !attachment && (
            <div className="flex items-center gap-2 rounded-xl border border-sidebar-accent/20 bg-sidebar-accent/5 px-3 py-1.5">
              <svg className="h-3.5 w-3.5 shrink-0 text-sidebar-accent/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="flex-1 text-[11px] text-muted">
                {tutoringContext.attachmentIds.length === 1
                  ? "1 session file active"
                  : `${tutoringContext.attachmentIds.length} session files active`}
                {" "}— the assistant can see {tutoringContext.attachmentIds.length === 1 ? "it" : "them"}
              </span>
            </div>
          )}

          {tutoringContext && activeTutoringSummary && (
            <div className="rounded-2xl border border-sidebar-accent/20 bg-sidebar-accent/5 px-4 py-3">
              <div className="flex flex-wrap items-start gap-2 text-[11px]">
                <span className="rounded-full bg-sidebar-accent/15 px-2 py-0.5 font-semibold text-sidebar-accent">
                  {visibleTutoringGroundingStatus === "uploaded_materials"
                    ? "Using uploaded files first"
                    : visibleTutoringGroundingStatus === "class_materials"
                      ? "Using class materials"
                      : visibleTutoringGroundingStatus === "limited_materials"
                        ? "Limited readable materials"
                        : "General help fallback"}
                </span>
                {activeTutoringSummary.linkedClass && (
                  <span className="rounded-full bg-card px-2 py-0.5 text-muted">
                    Class: {activeTutoringSummary.linkedClass.name}
                  </span>
                )}
                {activeTutoringSummary.linkedTask && (
                  <span className="rounded-full bg-card px-2 py-0.5 text-muted">
                    Task: {activeTutoringSummary.linkedTask.title}
                  </span>
                )}
                {tutoringContext.topic && (
                  <span className="rounded-full bg-card px-2 py-0.5 text-muted">
                    Topic: {tutoringContext.topic}
                  </span>
                )}
              </div>
              <div className="mt-2 space-y-1 text-[11px] text-muted">
                <p>
                  {activeTutoringSummary.selectedMaterials.length > 0
                    ? `Active class materials: ${activeTutoringSummary.selectedMaterials
                        .slice(0, 3)
                        .map((material) => material.title)
                        .join(", ")}${activeTutoringSummary.selectedMaterials.length > 3 ? ` +${activeTutoringSummary.selectedMaterials.length - 3} more` : ""}`
                    : "Active class materials: none specifically selected"}
                </p>
                <p>
                  {tutoringContext.attachmentIds?.length
                    ? `Session files: ${tutoringContext.attachmentIds.length} active${tutoringContext.attachmentIds.length > 1 ? " - mention the file name or topic if you want one used" : ""}`
                    : "Session files: none active"}
                </p>
                {visibleTutoringGroundingStatus === "limited_materials" && (
                  <p className="text-accent-rose-foreground">
                    Some saved materials are linked, but they do not currently provide enough readable text for reliable class-specific answers.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Attachment preview */}
          {attachment && (
            <div
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                attachment.status === "failed"
                  ? "border-accent-rose/30 bg-accent-rose/5"
                  : attachment.status === "ready"
                    ? "border-accent-green/30 bg-accent-green/5"
                    : "border-border bg-surface"
              }`}
            >
              {/* File icon */}
              <svg className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="flex-1 truncate text-xs text-foreground">
                {attachment.file.name}
              </span>

              {/* Status indicator */}
              <span className="shrink-0 text-[10px] font-semibold">
                {attachment.status === "uploading" && (
                  <span className="flex items-center gap-1.5 text-muted">
                    {/* Spinner */}
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted/30 border-t-muted" />
                    Uploading…
                  </span>
                )}
                {attachment.status === "ready" && (
                  <span className="flex items-center gap-1 text-accent-green-foreground">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Ready
                  </span>
                )}
                {attachment.status === "failed" && (
                  <span className="flex items-center gap-1.5 text-accent-rose-foreground">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    Failed —{" "}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="underline underline-offset-2 hover:opacity-80"
                    >
                      retry
                    </button>
                  </span>
                )}
              </span>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => setAttachment(null)}
                title="Remove attachment"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-foreground"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {attachment?.status === "failed" && attachment.error && (
            <div className="rounded-2xl border border-accent-rose/20 bg-accent-rose/5 px-4 py-2 text-xs text-accent-rose-foreground">
              {attachment.error}
            </div>
          )}

          {/* Voice transcript hint */}
          {showVoiceTranscriptHint && (
            <div className="rounded-2xl border border-sidebar-accent/20 bg-sidebar-accent/5 px-4 py-2 text-xs text-foreground">
              Voice transcript ready — you can edit before sending.
            </div>
          )}

          {/* Voice error */}
          {voiceError && (
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-accent-rose/20 bg-accent-rose/5 px-4 py-2 text-xs text-foreground">
              <p>{voiceError}</p>
              <button
                type="button"
                onClick={clearVoiceError}
                className="shrink-0 font-medium text-sidebar-accent underline underline-offset-2 hover:opacity-80"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Main input row */}
          <div
            className={`flex items-end gap-2 rounded-2xl border bg-card px-4 py-3 shadow-sm transition focus-within:ring-2 ${
              tutoringContext
                ? "border-sidebar-accent/30 focus-within:border-sidebar-accent/50 focus-within:ring-sidebar-accent/20"
                : "border-border focus-within:border-sidebar-accent/40 focus-within:ring-sidebar-accent/30"
            }`}
          >
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={handleFileChange}
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                isListening
                  ? "Listening…"
                  : isTranscribing
                    ? "Finishing your transcript…"
                  : tutoringContext
                    ? "Ask your question or say what you're working on…"
                    : profile.displayName
                      ? `Ask me anything, ${profile.displayName}…`
                      : "Ask me anything…"
              }
              rows={2}
              disabled={isLoading}
              autoCapitalize="sentences"
              autoCorrect="on"
              spellCheck
              style={{ maxHeight: "8rem" }}
              className={`flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted/60 disabled:opacity-50 ${
                isListening || isTranscribing ? "text-muted" : ""
              }`}
            />

            <div className="flex shrink-0 items-center gap-1.5 pb-0.5">
              {/* Attachment button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || attachment?.status === "uploading"}
                title="Attach a file or image"
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all disabled:opacity-40 ${
                  attachment
                    ? "bg-sidebar-accent/10 text-sidebar-accent"
                    : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
              </button>

              {/* Mic button */}
              {voiceSupported && (
                <button
                  type="button"
                  onClick={handleVoiceToggle}
                  disabled={isLoading}
                  title={
                    isListening ? "Tap to stop recording" : isTranscribing ? "Processing…" : "Record a voice note"
                  }
                  aria-label={isListening ? "Stop voice recording" : "Start voice recording"}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-all disabled:opacity-40 ${
                    isListening
                      ? "bg-accent-rose/25 text-accent-rose-foreground ring-1 ring-accent-rose/40"
                      : isTranscribing
                        ? "bg-accent-rose/15 text-accent-rose-foreground"
                        : "text-muted hover:bg-surface hover:text-foreground"
                  }`}
                >
                  {isListening && (
                    <span className="absolute inset-0 animate-pulse rounded-xl bg-accent-rose/20" />
                  )}
                  <svg className="relative h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v5a4 4 0 01-8 0V7a4 4 0 014-4z"
                    />
                  </svg>
                </button>
              )}

              {/* Send button */}
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-hero px-3.5 text-xs font-semibold text-white transition hover:bg-hero-mid active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isLoading ? (
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-white/70 [animation-delay:0ms]" />
                    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-white/70 [animation-delay:150ms]" />
                    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-white/70 [animation-delay:300ms]" />
                  </span>
                ) : (
                  <>
                    Send
                    <svg className="h-3 w-3 -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Status bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted/60">
            {(isListening || isTranscribing || voiceState === "error") ? (
              <p className={`font-medium ${
                isListening
                  ? "text-accent-rose-foreground"
                  : isTranscribing
                    ? "text-muted"
                    : "text-accent-rose-foreground"
              }`}>
                {voiceStatusText}
              </p>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
              {speechSupported && (
                <label className="flex cursor-pointer items-center gap-1.5 select-none">
                  <input
                    type="checkbox"
                    checked={voiceAutoRead}
                    onChange={(e) => setVoiceAutoRead(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border bg-card"
                  />
                  <span>Read replies aloud</span>
                </label>
              )}
              <span className="hidden sm:inline">Shift+Enter for new line</span>
            </div>
          </div>
        </form>
      </div>

      {/* Mobile bottom-nav spacer — keeps input above the fixed nav bar on phones.
          Height = nav height (72px) + safe area inset (notched iPhones). */}
      <div
        className="shrink-0 md:hidden"
        aria-hidden="true"
        style={{ height: "calc(72px + env(safe-area-inset-bottom, 0px))" }}
      />
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onRetry,
  onSpeak,
  canReadAloud,
  isSpeaking,
}: {
  message: ChatMessage;
  onRetry?: () => void;
  onSpeak?: () => void;
  canReadAloud?: boolean;
  isSpeaking?: boolean;
}) {
  const isUser = message.role === "user";
  const isLoading = message.content === "...";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-hero px-4 py-3 text-sm leading-relaxed text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent/20 text-[11px] font-semibold text-sidebar-accent shadow-sm">
        ✦
      </div>
      <div
        className={`max-w-[80%] rounded-2xl rounded-bl-sm border px-4 py-3 text-sm shadow-sm ${
          message.failed
            ? "border-accent-rose/30 bg-accent-rose/5 text-muted"
            : "border-border bg-card text-foreground"
        } ${isLoading ? "opacity-60" : ""}`}
      >
        {isLoading ? (
          <span className="flex items-center gap-1.5 py-0.5">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-muted" />
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-muted [animation-delay:200ms]" />
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-muted [animation-delay:400ms]" />
          </span>
        ) : (
          <>
            {renderContent(message.content)}
            {message.actionResult && (
              <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-[rgb(var(--accent-green)/0.35)] bg-[rgb(var(--accent-green)/0.08)] px-3 py-2 text-xs">
                <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent-green-fg)" }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-semibold" style={{ color: "var(--accent-green-fg)" }}>
                    {message.actionResult.type === "task_added" ? "Task added" : "Task updated"}
                  </p>
                  <p className="mt-0.5 text-foreground">{message.actionResult.title}</p>
                  {message.actionResult.dueAt && (
                    <p className="mt-0.5 text-muted">Due {formatDueDate(message.actionResult.dueAt)}</p>
                  )}
                </div>
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {message.failed && onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-xs font-medium text-sidebar-accent underline underline-offset-2 hover:opacity-80"
                >
                  Try again
                </button>
              )}
              {canReadAloud && onSpeak && (
                <button
                  type="button"
                  onClick={onSpeak}
                  className={`flex items-center gap-1 text-xs font-medium underline underline-offset-2 hover:opacity-80 ${
                    isSpeaking ? "text-accent-rose-foreground" : "text-muted hover:text-foreground"
                  }`}
                >
                  {isSpeaking ? (
                    <>
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent-rose-foreground" />
                      Stop reading
                    </>
                  ) : (
                    "Read aloud"
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
