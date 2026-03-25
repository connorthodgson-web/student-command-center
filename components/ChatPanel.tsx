// UI redesign pass
"use client";

import { useEffect, useRef, useState } from "react";
import { mockChatMessages } from "../lib/mock-data";
import { useTaskStore } from "../lib/task-store";
import { useReminderStore } from "../lib/reminder-store";
import { useClasses } from "../lib/stores/classStore";
import type { ChatMessage } from "../types";

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>(mockChatMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { tasks } = useTaskStore();
  const { preferences: reminderPreferences } = useReminderStore();
  const { classes } = useClasses();
  const scrollRef = useRef<HTMLDivElement>(null);

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
        }),
      });

      const json = (await response.json()) as { data?: ChatMessage; error?: string };

      const assistantMessage: ChatMessage = json.data ?? {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "Something went wrong. Please try again.",
        createdAt: new Date().toISOString(),
      };

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
        className={`max-w-[78%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground shadow-sm ${
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
          <span className="whitespace-pre-wrap">{message.content}</span>
        )}
      </div>
    </div>
  );
}
