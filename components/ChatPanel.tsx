"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTaskStore } from "../lib/task-store";
import { useReminderStore } from "../lib/reminder-store";
import { useClasses } from "../lib/stores/classStore";
import { useCalendar } from "../lib/stores/calendarStore";
import { useScheduleConfig } from "../lib/stores/scheduleConfig";
import { useAutomations } from "../lib/stores/automationStore";
import { getAbOverrideForDate, getTodayDateString } from "../lib/schedule";
import { loadProfile } from "../lib/profile";
import { loadActivities } from "../lib/activities";
import { loadConstraints } from "../lib/constraints";
import type { AssistantAction, ChatMessage, StudentTask } from "../types";

// ── Task matching ─────────────────────────────────────────────────────────────
// Simple, reliable matching — no external library needed.

function matchTask(
  tasks: StudentTask[],
  taskId?: string,
  taskTitle?: string
): { match: StudentTask | null; ambiguous: boolean } {
  const active = tasks.filter((t) => t.status !== "done");

  // 1. Exact id match (most reliable — AI supplies this from context)
  if (taskId) {
    const byId = active.find((t) => t.id === taskId);
    if (byId) return { match: byId, ambiguous: false };
  }

  if (!taskTitle) return { match: null, ambiguous: false };

  const needle = taskTitle.trim().toLowerCase();

  // 2. Exact title match
  const exactMatches = active.filter(
    (t) => t.title.toLowerCase() === needle
  );
  if (exactMatches.length === 1) return { match: exactMatches[0], ambiguous: false };
  if (exactMatches.length > 1) return { match: null, ambiguous: true };

  // 3. Contains match
  const containsMatches = active.filter((t) =>
    t.title.toLowerCase().includes(needle) || needle.includes(t.title.toLowerCase())
  );
  if (containsMatches.length === 1) return { match: containsMatches[0], ambiguous: false };
  if (containsMatches.length > 1) return { match: null, ambiguous: true };

  return { match: null, ambiguous: false };
}

// ── Voice input hook ──────────────────────────────────────────────────────────
// Uses browser Web Speech API — lightweight, no external dependencies.
// Resolves to undefined when the browser doesn't support it.

type VoiceState = "idle" | "listening" | "unsupported";

// Minimal types for the Web Speech API (not in standard TS lib)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

function useSpeechInput(onTranscript: (text: string) => void) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const recognitionRef = useRef<AnySpeechRecognition | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    // @ts-ignore
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setVoiceState("unsupported");
      return;
    }

    // @ts-ignore — webkit prefix fallback
    const SpeechRecognitionImpl = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const recognition: AnySpeechRecognition = new SpeechRecognitionImpl();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setVoiceState("listening");
    recognition.onend = () => setVoiceState("idle");
    recognition.onerror = () => setVoiceState("idle");

    recognition.onresult = (event: AnySpeechRecognition) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      if (transcript.trim()) onTranscript(transcript.trim());
    };

    recognition.start();
  }, [isSupported, onTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setVoiceState("idle");
  }, []);

  return { voiceState, isSupported, startListening, stopListening };
}

// ── Main component ────────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  "What should I focus on today?",
  "What do I have coming up?",
  "Help me plan tonight",
];

const INITIAL_GREETING: ChatMessage = {
  id: "chat-greeting",
  role: "assistant",
  content: "Hi! I can help you check what's due, look at your schedule, or think through your week. What's on your mind?",
  createdAt: new Date().toISOString(),
};

export function ChatPanel({ initialQuery }: { initialQuery?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const profile = loadProfile();
  const activities = loadActivities();
  const constraints = loadConstraints();
  const { tasks, completeTask } = useTaskStore();
  const { preferences: reminderPreferences } = useReminderStore();
  const { classes } = useClasses();
  const { entries: calendarEntries } = useCalendar();
  const { todayDayType } = useScheduleConfig();
  const { addAutomation } = useAutomations();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { voiceState, isSupported, startListening, stopListening } = useSpeechInput(
    (transcript) => {
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      textareaRef.current?.focus();
    }
  );

  // Pre-fill from ?q= deep-link
  useEffect(() => {
    if (initialQuery) setInput(initialQuery);
  }, [initialQuery]);

  // Auto-scroll to newest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    const timestamp = new Date().toISOString();

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedInput,
      createdAt: timestamp,
    };

    const loadingMessage: ChatMessage = {
      id: `loading-${Date.now()}`,
      role: "assistant",
      content: "...",
      createdAt: timestamp,
    };

    setMessages((current) => [...current, userMessage, loadingMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const todayDateStr = getTodayDateString();
      const calendarAbOverride = getAbOverrideForDate(calendarEntries, todayDateStr);
      const effectiveDayType = calendarAbOverride ?? todayDayType;

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmedInput,
          history,
          tasks,
          reminderPreferences,
          classes,
          currentDatetime: new Date().toISOString(),
          calendarEntries,
          effectiveDayType,
          profile,
          activities,
          constraints,
        }),
      });

      const json = (await response.json()) as {
        data?: ChatMessage;
        action?: AssistantAction;
        error?: string;
      };

      const assistantMessage: ChatMessage = json.data ?? {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "Something went wrong. Please try again.",
        createdAt: new Date().toISOString(),
      };

      // Handle automation creation action
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
              "\n\n✓ Saved to your [Automations](/automations).";
          } catch {
            // Don't crash chat if save fails
          }
        }
      }

      // Handle task completion action
      if (json.action?.type === "complete_task") {
        const { taskId, taskTitle } = json.action;
        const { match, ambiguous } = matchTask(tasks, taskId, taskTitle);

        if (match) {
          completeTask(match.id);
          // Replace the assistant message with a clean confirmation
          assistantMessage.content = `Done — I marked **${match.title}** as completed.`;
        } else if (ambiguous) {
          // Show a disambiguation list — do NOT guess
          const activeTasks = tasks.filter((t) => t.status !== "done");
          const needle = (taskTitle ?? "").toLowerCase();
          const candidates = activeTasks
            .filter(
              (t) =>
                t.title.toLowerCase().includes(needle) ||
                needle.includes(t.title.toLowerCase())
            )
            .slice(0, 5);
          const list = candidates.map((t) => `- ${t.title}`).join("\n");
          assistantMessage.content =
            `I found a few tasks that could match — which one did you finish?\n\n${list}`;
        }
        // If no match and not ambiguous, the assistant's natural reply stands (it may have asked for clarification)
      }

      setMessages((current) => [...current.slice(0, -1), assistantMessage]);
    } catch {
      setMessages((current) => [
        ...current.slice(0, -1),
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "Something went wrong. Please try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  const isListening = voiceState === "listening";
  const hasUserMessages = messages.some((m) => m.role === "user");

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden py-4">
      {/* ── Message list ─────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="chat-scroll flex-1 space-y-5 overflow-y-auto pb-2 pr-1"
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Suggested prompts — shown only before first user message */}
        {!hasUserMessages && (
          <div className="flex flex-wrap gap-2 pt-1 pl-10">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSuggestedPrompt(prompt)}
                className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-muted transition hover:border-accent-green-foreground/40 hover:bg-surface hover:text-foreground"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Input area ───────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border pt-4">
        <form onSubmit={handleSend}>
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm transition focus-within:border-accent-green-foreground/40 focus-within:ring-2 focus-within:ring-accent-green/30">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isListening
                  ? "Listening…"
                  : profile.displayName
                    ? `Ask me anything, ${profile.displayName}…`
                    : "Ask me anything…"
              }
              rows={2}
              disabled={isLoading}
              className={`flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted/60 disabled:opacity-50 ${
                isListening ? "text-muted italic" : ""
              }`}
            />

            <div className="flex shrink-0 items-center gap-2 pb-0.5">
              {/* Voice input button */}
              {isSupported && (
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  disabled={isLoading}
                  title={isListening ? "Stop listening" : "Speak a message"}
                  className={`relative flex h-8 w-8 items-center justify-center rounded-xl transition-all disabled:opacity-40 ${
                    isListening
                      ? "bg-accent-rose/20 text-accent-rose-foreground"
                      : "text-muted hover:bg-surface hover:text-foreground"
                  }`}
                >
                  {isListening && (
                    <span className="absolute inset-0 animate-ping rounded-xl bg-accent-rose/20" />
                  )}
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="flex h-8 items-center gap-1.5 rounded-xl bg-hero px-3.5 text-xs font-semibold text-white transition hover:bg-hero-mid disabled:opacity-40"
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

          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] text-muted/60">
              {isListening ? (
                <span className="font-medium text-accent-rose-foreground">Listening — speak now</span>
              ) : (
                "Shift+Enter for a new line · Enter to send"
              )}
            </p>
            {!isSupported && (
              <p className="text-[11px] text-muted/40">Voice input not supported in this browser</p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function renderContent(text: string): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    nodes.push(
      <ul key={key++} className="mt-1.5 mb-1 space-y-1 pl-1">
        {bulletBuffer.map((b, i) => (
          <li key={i} className="flex items-start gap-2 leading-snug">
            <span className="mt-[4px] shrink-0 h-1.5 w-1.5 rounded-full bg-muted/50" />
            <span>{renderInline(b)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^###\s+(.+)/);
    if (headingMatch) {
      flushBullets();
      nodes.push(
        <p key={key++} className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
          {headingMatch[1]}
        </p>
      );
      continue;
    }

    const standaloneBoldMatch = line.match(/^\*\*([^*]+)\*\*\s*$/);
    if (standaloneBoldMatch) {
      flushBullets();
      nodes.push(
        <p key={key++} className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
          {standaloneBoldMatch[1]}
        </p>
      );
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1]);
      continue;
    }

    flushBullets();
    if (line.trim() === "") {
      nodes.push(<div key={key++} className="h-2" />);
    } else {
      nodes.push(
        <p key={key++} className="leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
  }
  flushBullets();
  return <>{nodes}</>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
        if (boldMatch) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {boldMatch[1]}
            </strong>
          );
        }
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          const [, label, href] = linkMatch;
          if (href.startsWith("/")) {
            return (
              <Link
                key={i}
                href={href}
                className="font-medium text-accent-green-foreground underline underline-offset-2 hover:opacity-80"
              >
                {label}
              </Link>
            );
          }
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent-green-foreground underline underline-offset-2 hover:opacity-80"
            >
              {label}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
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
      {/* Assistant avatar */}
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent/20 text-[11px] font-semibold text-sidebar-accent shadow-sm">
        ✦
      </div>
      <div
        className={`max-w-[80%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm ${
          isLoading ? "opacity-60" : ""
        }`}
      >
        {isLoading ? (
          <span className="flex items-center gap-1.5 py-0.5">
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:0ms]" />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:150ms]" />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:300ms]" />
          </span>
        ) : (
          renderContent(message.content)
        )}
      </div>
    </div>
  );
}
