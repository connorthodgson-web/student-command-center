"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReminderStore } from "../lib/reminder-store";
import { useCalendar } from "../lib/stores/calendarStore";
import { useScheduleConfig } from "../lib/stores/scheduleConfig";
import { useAutomations } from "../lib/stores/automationStore";
import { getAbOverrideForDate, getTodayDateString } from "../lib/schedule";
import { loadProfile } from "../lib/profile";
import { loadActivities } from "../lib/activities";
import { loadConstraints } from "../lib/constraints";
import { renderContent } from "../lib/render-content";
import {
  canUseSpeechSynthesis,
  speakText,
  stopSpeaking,
  useBrowserVoiceInput,
} from "../lib/voice";
import { formatDueDate } from "../lib/datetime";
import type { AssistantAction, ChatMessage, SchoolClass, StudentTask, TutoringContext } from "../types";

// ── Task matching ─────────────────────────────────────────────────────────────

function matchTask(
  tasks: StudentTask[],
  taskId?: string,
  taskTitle?: string,
): { match: StudentTask | null; ambiguous: boolean } {
  const active = tasks.filter((t) => t.status !== "done");

  if (taskId) {
    const byId = active.find((t) => t.id === taskId);
    if (byId) return { match: byId, ambiguous: false };
  }

  if (!taskTitle) return { match: null, ambiguous: false };

  const needle = taskTitle.trim().toLowerCase();
  const exactMatches = active.filter((t) => t.title.toLowerCase() === needle);
  if (exactMatches.length === 1) return { match: exactMatches[0], ambiguous: false };
  if (exactMatches.length > 1) return { match: null, ambiguous: true };

  const containsMatches = active.filter(
    (t) => t.title.toLowerCase().includes(needle) || needle.includes(t.title.toLowerCase()),
  );
  if (containsMatches.length === 1) return { match: containsMatches[0], ambiguous: false };
  if (containsMatches.length > 1) return { match: null, ambiguous: true };

  return { match: null, ambiguous: false };
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
};

// ── Initial greeting ──────────────────────────────────────────────────────────

const INITIAL_GREETING: ChatMessage = {
  id: "chat-greeting",
  role: "assistant",
  content:
    "Hi! I can help you capture school tasks, review what's due, and think through your workload.",
  createdAt: new Date().toISOString(),
};

// ── ChatPanel ─────────────────────────────────────────────────────────────────

export function ChatPanel({
  initialQuery,
  tutoringContext,
  onOpenTutoring,
}: {
  initialQuery?: string;
  tutoringContext?: TutoringContext;
  onOpenTutoring?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [failedInput, setFailedInput] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [voiceAutoRead, setVoiceAutoRead] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<AttachmentUploadState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profile = loadProfile();
  const activities = loadActivities();
  const constraints = loadConstraints();
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const { preferences: reminderPreferences } = useReminderStore();
  const { entries: calendarEntries } = useCalendar();
  const { todayDayType } = useScheduleConfig();
  const { addAutomation } = useAutomations();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialSendRef = useRef(false);

  useEffect(() => {
    setSpeechSupported(canUseSpeechSynthesis());
  }, []);

  // Load real student data and chat history from localStorage on mount
  useEffect(() => {
    try {
      const rawTasks = localStorage.getItem("scc-tasks");
      if (rawTasks) {
        const parsed = JSON.parse(rawTasks);
        if (Array.isArray(parsed)) setTasks(parsed as StudentTask[]);
      }
    } catch {}
    try {
      const rawOnboarding = localStorage.getItem("scc-onboarding");
      if (rawOnboarding) {
        const data = JSON.parse(rawOnboarding) as { classes?: SchoolClass[] };
        setClasses(data.classes ?? []);
      }
    } catch {}
    try {
      const rawHistory = localStorage.getItem("scc-chat-history");
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed as ChatMessage[]);
        }
      }
    } catch {}
  }, []);

  // Persist chat history on every change (capped at 50 messages)
  useEffect(() => {
    try {
      localStorage.setItem("scc-chat-history", JSON.stringify(messages.slice(-50)));
    } catch {}
  }, [messages]);

  const completeTask = useCallback(async (id: string) => {
    setTasks((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, status: "done" as const } : t));
      try {
        localStorage.setItem("scc-tasks", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const {
    state: voiceState,
    error: voiceError,
    isSupported: voiceSupported,
    isListening,
    isTranscribing,
    start: startListening,
    stop: stopListening,
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

  useEffect(() => {
    if (initialQuery && !initialSendRef.current) {
      initialSendRef.current = true;
      void sendMessage(initialQuery, [INITIAL_GREETING]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

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
        formData.append(
          "attachmentType",
          file.type.startsWith("image/") ? "image" : "file",
        );

        const res = await fetch("/api/assistant/attachments", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const json = (await res.json()) as { data?: { id: string } };
          setAttachment((prev) =>
            prev ? { ...prev, status: "ready", id: json.data?.id } : null,
          );
        } else {
          setAttachment((prev) => (prev ? { ...prev, status: "failed" } : null));
        }
      } catch {
        setAttachment((prev) => (prev ? { ...prev, status: "failed" } : null));
      }
    },
    [],
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

      stopListening();

      // Build the display message — include attachment name if present
      const displayText =
        attachment && attachment.status === "failed"
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
        // Build the full messages array: history + new user message
        const apiMessages = [
          ...currentMessages
            .filter((m) => m.role !== "system")
            .map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: text },
        ];

        // Compute effective day type client-side for schedule context
        const todayDateStr = getTodayDateString();
        const calendarAbOverride = getAbOverrideForDate(calendarEntries, todayDateStr);
        const effectiveDayType = calendarAbOverride ?? todayDayType;

        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            classes,
            tasks,
            effectiveDayType,
            calendarEntries,
            tutoringContext,
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
          error?: string;
        };

        if (json.error || !json.data) {
          throw new Error(json.error ?? "No response from AI.");
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
              addAutomation(auto);
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

        // Handle complete_task action
        if (json.action?.type === "complete_task") {
          const { taskId, taskTitle } = json.action;
          const { match, ambiguous } = matchTask(tasks, taskId, taskTitle);

          if (match) {
            await completeTask(match.id);
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
            // Build patched task and write to localStorage first — no auth required
            const patched: StudentTask = {
              ...match,
              ...(updates.title ? { title: updates.title } : {}),
              ...(updates.dueAt !== undefined ? { dueAt: updates.dueAt ?? undefined } : {}),
              ...(updates.description !== undefined
                ? { description: updates.description ?? undefined }
                : {}),
              updatedAt: new Date().toISOString(),
            };
            setTasks((prev) => {
              const updated = prev.map((t) => (t.id === match.id ? patched : t));
              try {
                localStorage.setItem("scc-tasks", JSON.stringify(updated));
              } catch {}
              return updated;
            });
            // Attach confirmation card
            assistantMessage.actionResult = {
              type: "task_updated",
              title: patched.title,
              dueAt: patched.dueAt,
            };
            // TODO: Sync to Supabase via PATCH /api/tasks when auth context is available
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
          // Build and save locally first — no auth required
          const now = new Date().toISOString();
          const localTask: StudentTask = {
            id: crypto.randomUUID(),
            title: taskData.title,
            dueAt: taskData.dueAt ?? undefined,
            description: taskData.description ?? undefined,
            type: taskData.type ?? undefined,
            classId,
            source: "chat",
            status: "todo",
            createdAt: now,
            updatedAt: now,
          };
          setTasks((prev) => {
            const updated = [...prev, localTask];
            try {
              localStorage.setItem("scc-tasks", JSON.stringify(updated));
            } catch {}
            return updated;
          });
          // Attach confirmation card
          assistantMessage.actionResult = {
            type: "task_added",
            title: localTask.title,
            dueAt: localTask.dueAt,
          };
          assistantMessage.content = `Done — I added **${localTask.title}** to your tasks.`;
          // TODO: Sync to Supabase via POST /api/tasks when auth context is available
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
      activities,
      addAutomation,
      attachment,
      calendarEntries,
      classes,
      completeTask,
      constraints,
      isLoading,
      profile,
      reminderPreferences,
      speechSupported,
      speakMessage,
      stopListening,
      tasks,
      activeTasks,
      todayDayType,
      tutoringContext,
      voiceAutoRead,
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
    setInput(prompt);
    setLastTranscript(null);
    textareaRef.current?.focus();
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const hasUserMessages = messages.some((m) => m.role === "user");
  const showVoiceTranscriptHint = Boolean(lastTranscript && input.trim());
  const voiceStatusText = isListening
    ? "Listening — speak now"
    : isTranscribing
      ? "Transcribing your speech..."
      : voiceState === "error"
        ? voiceError
        : voiceSupported
          ? "Tap the mic to speak, then review before sending."
          : "Voice input is not supported in this browser.";

  // ── Render ────────────────────────────────────────────────────────────────

  const handleClearChat = () => {
    setMessages([INITIAL_GREETING]);
    try { localStorage.removeItem("scc-chat-history"); } catch {}
  };

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
          {(activeTasks.length === 0
            ? ["Add my first task", "Set up my schedule", "What can you help with?"]
            : ["What's due today?", "Update a task", "What should I work on tonight?"]
          ).map((chip) => (
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
                className="shrink-0 text-muted transition hover:text-foreground"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isListening
                  ? "Listening…"
                  : tutoringContext
                    ? "Ask your question or say what you're working on…"
                    : profile.displayName
                      ? `Ask me anything, ${profile.displayName}…`
                      : "Ask me anything…"
              }
              rows={2}
              disabled={isLoading}
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
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all disabled:opacity-40 ${
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
                  onClick={isListening || isTranscribing ? stopListening : startListening}
                  disabled={isLoading}
                  title={
                    isListening || isTranscribing ? "Stop voice input" : "Speak a message"
                  }
                  className={`relative flex h-8 w-8 items-center justify-center rounded-xl transition-all disabled:opacity-40 ${
                    isListening || isTranscribing
                      ? "bg-accent-rose/20 text-accent-rose-foreground"
                      : "text-muted hover:bg-surface hover:text-foreground"
                  }`}
                >
                  {(isListening || isTranscribing) && (
                    <span className="absolute inset-0 animate-pulse rounded-xl bg-accent-rose/15" />
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
                className="flex h-8 items-center gap-1.5 rounded-xl bg-hero px-3.5 text-xs font-semibold text-white transition hover:bg-hero-mid active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
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
            <p className={voiceState === "error" ? "text-accent-rose-foreground" : undefined}>
              {voiceStatusText}
            </p>
            <div className="flex items-center gap-3">
              {speechSupported && (
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={voiceAutoRead}
                    onChange={(e) => setVoiceAutoRead(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border bg-card"
                  />
                  <span>Read replies aloud</span>
                </label>
              )}
              {/* Only shown on desktop — mobile keyboards don't use Shift+Enter */}
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
