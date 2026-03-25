// UI redesign pass
"use client";

import React, { useEffect, useRef, useState } from "react";
import { mockChatMessages } from "../lib/mock-data";
import { useTaskStore } from "../lib/task-store";
import { useReminderStore } from "../lib/reminder-store";
import { useClasses } from "../lib/stores/classStore";
import { useCalendar } from "../lib/stores/calendarStore";
import { useScheduleConfig } from "../lib/stores/scheduleConfig";
import { useAutomations } from "../lib/stores/automationStore";
import { getAbOverrideForDate, getTodayDateString } from "../lib/schedule";
import type { AssistantAction, ChatMessage } from "../types";

export function ChatPanel({ initialQuery }: { initialQuery?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>(mockChatMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { tasks } = useTaskStore();
  const { preferences: reminderPreferences } = useReminderStore();
  const { classes } = useClasses();
  const { entries: calendarEntries } = useCalendar();
  const { todayDayType } = useScheduleConfig();
  const { addAutomation } = useAutomations();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pre-fill input from ?q= deep-link (e.g. from Automations page example chips)
  useEffect(() => {
    if (initialQuery) setInput(initialQuery);
  }, [initialQuery]);

  // Auto-scroll to the newest message whenever messages change
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
        }),
      });

      const json = (await response.json()) as { data?: ChatMessage; action?: AssistantAction; error?: string };

      const assistantMessage: ChatMessage = json.data ?? {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "Something went wrong. Please try again.",
        createdAt: new Date().toISOString(),
      };

      // Handle automation creation action — validate before saving to prevent corrupt state
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
            // Don't crash the chat if saving fails — message still renders
          }
        }
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

  return (
    // flex-col + h-full so messages scroll and input stays pinned to the bottom
    <div className="flex flex-1 flex-col overflow-hidden py-4">
      {/* ── Message list ────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="chat-scroll flex-1 space-y-5 overflow-y-auto pb-2 pr-1"
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      {/* ── Input bar ────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border pt-4">
        <form onSubmit={handleSend} className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your workload, what's due, or anything school-related…"
            rows={2}
            disabled={isLoading}
            className="flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="shrink-0 rounded-2xl bg-hero px-5 py-3 text-sm font-medium text-white transition hover:bg-hero-mid disabled:opacity-40"
          >
            {isLoading ? (
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-white/70 [animation-delay:0ms]" />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-white/70 [animation-delay:150ms]" />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-white/70 [animation-delay:300ms]" />
              </span>
            ) : (
              "Send"
            )}
          </button>
        </form>
        <p className="mt-2 text-[11px] text-muted">
          Shift+Enter for a new line · Enter to send
        </p>
      </div>
    </div>
  );
}

// ── Minimal markdown renderer ────────────────────────────────────
// Handles: **bold**, bullet lines (- or *), paragraph spacing.
// No external library needed for this scope.
function renderContent(text: string): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    nodes.push(
      <ul key={key++} className="mt-1 mb-1 space-y-0.5 pl-1">
        {bulletBuffer.map((b, i) => (
          <li key={i} className="flex items-start gap-2 leading-snug">
            <span className="mt-[3px] shrink-0 text-[10px] text-muted">●</span>
            <span>{renderInline(b)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  for (const line of lines) {
    // ### Section heading
    const headingMatch = line.match(/^###\s+(.+)/);
    if (headingMatch) {
      flushBullets();
      nodes.push(
        <p key={key++} className="mt-3 mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          {headingMatch[1]}
        </p>
      );
      continue;
    }

    // Standalone bold-only line like **Tonight** used as a section label
    const standaloneBoldMatch = line.match(/^\*\*([^*]+)\*\*\s*$/);
    if (standaloneBoldMatch) {
      flushBullets();
      nodes.push(
        <p key={key++} className="mt-3 mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
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
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
        if (boldMatch) {
          return <strong key={i} className="font-semibold text-foreground">{boldMatch[1]}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Message bubble sub-component ────────────────────────────────
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isLoading = message.content === "...";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-hero px-4 py-3 text-sm leading-relaxed text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      {/* Assistant avatar */}
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-green text-[11px] text-accent-green-foreground">
        ✦
      </div>
      <div
        className={`max-w-[78%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm ${
          isLoading ? "opacity-60" : ""
        }`}
      >
        {isLoading ? (
          <span className="flex items-center gap-1">
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
