"use client";

import { useState, useEffect, useRef } from "react";
import { useClasses } from "../lib/stores/classStore";
import { ChatPanel } from "./ChatPanel";
import { TutoringSetupPanel } from "./TutoringSetupPanel";
import type { TutoringContext, TutoringMode } from "../types";

const TUTORING_MODE_LABELS: Record<TutoringMode, string> = {
  explain: "Explain It",
  step_by_step: "Step by Step",
  quiz: "Quiz Me",
  review: "Quick Review",
  study_plan: "Study Plan",
  homework_help: "Homework Help",
};

const TUTORING_MODE_ICONS: Record<TutoringMode, string> = {
  explain: "💡",
  step_by_step: "🪜",
  quiz: "🎯",
  review: "📖",
  study_plan: "📅",
  homework_help: "✏️",
};

// ── Recent sessions (localStorage) ───────────────────────────────────────────

const SESSIONS_KEY = "scc-recent-tutoring";

type RecentSession = {
  id: string;
  mode: TutoringMode;
  className?: string;
  classId?: string;
  topic?: string;
  startedAt: string;
  context: TutoringContext;
};

function loadRecentSessions(): RecentSession[] {
  try {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecentSession(session: RecentSession) {
  try {
    const existing = loadRecentSessions();
    const updated = [session, ...existing.filter((s) => s.id !== session.id)].slice(0, 5);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ChatPageContentProps {
  initialQuery?: string;
  openTutoring?: boolean;
}

export function ChatPageContent({ initialQuery, openTutoring }: ChatPageContentProps) {
  const { classes } = useClasses();
  const [showTutoringSetup, setShowTutoringSetup] = useState(false);
  const [tutoringContext, setTutoringContext] = useState<TutoringContext | undefined>();
  const [chatKey, setChatKey] = useState(0);
  const [activeInitialQuery, setActiveInitialQuery] = useState<string | undefined>(initialQuery);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [showRecentSessions, setShowRecentSessions] = useState(false);
  const didAutoOpen = useRef(false);

  // Load recent sessions on mount
  useEffect(() => {
    setRecentSessions(loadRecentSessions());
  }, []);

  // Auto-open tutoring setup panel when openTutoring=true (only once)
  useEffect(() => {
    if (openTutoring && !didAutoOpen.current) {
      didAutoOpen.current = true;
      setShowTutoringSetup(true);
    }
  }, [openTutoring]);

  const handleStartTutoring = ({
    context,
    firstMessage,
  }: {
    context: TutoringContext;
    firstMessage: string;
  }) => {
    setTutoringContext(context);
    setShowTutoringSetup(false);
    setActiveInitialQuery(firstMessage);
    setShowRecentSessions(false);
    // Remount ChatPanel so the new initialQuery + tutoringContext take effect
    setChatKey((k) => k + 1);

    // Save to recent sessions
    if (context.mode) {
      const className = classes.find((c) => c.id === context.classId)?.name;
      const newSession: RecentSession = {
        id: `${Date.now()}`,
        mode: context.mode,
        className,
        classId: context.classId,
        topic: context.topic,
        startedAt: new Date().toISOString(),
        context,
      };
      saveRecentSession(newSession);
    }
    setRecentSessions(loadRecentSessions());
  };

  const handleResumeSession = (session: RecentSession) => {
    const className = classes.find((c) => c.id === session.classId)?.name;
    const modeLabel = TUTORING_MODE_LABELS[session.mode];
    const resumeMessage = [
      `Let's continue our ${modeLabel} session`,
      session.topic ? `on "${session.topic}"` : null,
      className ? `for ${className}` : null,
    ]
      .filter(Boolean)
      .join(" ");

    setTutoringContext(session.context);
    setActiveInitialQuery(resumeMessage);
    setShowRecentSessions(false);
    setShowTutoringSetup(false);
    setChatKey((k) => k + 1);
  };

  const handleClearTutoring = () => {
    setTutoringContext(undefined);
    setActiveInitialQuery(undefined);
    setChatKey((k) => k + 1);
  };

  const modeLabel = tutoringContext?.mode
    ? TUTORING_MODE_LABELS[tutoringContext.mode]
    : null;

  const modeIcon = tutoringContext?.mode
    ? TUTORING_MODE_ICONS[tutoringContext.mode]
    : null;

  return (
    <>
      {/* Dark header — accent border when tutoring is active for clear visual mode indicator */}
      <div
        className={`shrink-0 px-6 py-4 transition-colors ${
          tutoringContext
            ? "bg-hero border-b-2 border-sidebar-accent/30"
            : "bg-hero border-b border-white/[0.06]"
        }`}
      >
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between gap-4">
            {/* Assistant identity */}
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm shadow-sm transition-colors ${
                  tutoringContext
                    ? "bg-sidebar-accent/30 text-sidebar-accent"
                    : "bg-sidebar-accent/20 text-sidebar-accent"
                }`}
              >
                {tutoringContext ? (modeIcon ?? "🎓") : "✦"}
              </div>
              <div>
                <h1 className="text-base font-semibold text-white">
                  {tutoringContext ? "Tutoring Session" : "Your AI Assistant"}
                </h1>
                <p className="text-xs leading-tight text-white/40">
                  {tutoringContext
                    ? [
                        modeLabel,
                        classes.find((c) => c.id === tutoringContext.classId)?.name,
                        tutoringContext.topic,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : "Ask about your week, workload, upcoming tests, or what to tackle tonight"}
                </p>
              </div>
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-2">
              {/* Recent sessions button — shown when not in active tutoring */}
              {!tutoringContext && recentSessions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowRecentSessions((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                    showRecentSessions
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
                  }`}
                  title="Recent tutoring sessions"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="hidden sm:inline">History</span>
                </button>
              )}

              {tutoringContext ? (
                <div className="flex items-center gap-2">
                  {/* Primary action: switch mode (accent-colored to signal reversibility) */}
                  <button
                    type="button"
                    onClick={() => setShowTutoringSetup(true)}
                    className="rounded-xl border border-sidebar-accent/30 bg-sidebar-accent/10 px-3 py-1.5 text-xs font-semibold text-sidebar-accent transition hover:bg-sidebar-accent/20"
                  >
                    Change mode
                  </button>
                  {/* Secondary action: end session (more muted — intentionally destructive) */}
                  <button
                    type="button"
                    onClick={handleClearTutoring}
                    className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-white/40 transition hover:border-white/20 hover:bg-white/5 hover:text-white/70"
                    title="End this tutoring session"
                  >
                    End
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowTutoringSetup((v) => !v);
                    setShowRecentSessions(false);
                  }}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                    showTutoringSetup
                      ? "border-sidebar-accent/50 bg-sidebar-accent/20 text-sidebar-accent"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span>🎓</span>
                  <span>Tutor mode</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent sessions panel */}
      {showRecentSessions && !tutoringContext && recentSessions.length > 0 && (
        <div className="shrink-0 border-b border-border bg-surface px-6 py-4">
          <div className="mx-auto max-w-4xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                Recent Tutoring Sessions
              </p>
              <button
                type="button"
                onClick={() => setShowRecentSessions(false)}
                className="text-xs text-muted hover:text-foreground transition-colors"
              >
                Close
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => handleResumeSession(session)}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left text-xs transition hover:border-sidebar-accent/40 hover:bg-sidebar-accent/5 active:scale-[0.97]"
                >
                  <span className="text-base leading-none">
                    {TUTORING_MODE_ICONS[session.mode]}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">
                      {TUTORING_MODE_LABELS[session.mode]}
                      {session.className ? ` · ${session.className}` : ""}
                    </span>
                    {session.topic && (
                      <span className="block truncate max-w-[160px] text-muted">{session.topic}</span>
                    )}
                    <span className="block text-[10px] text-muted/60">{formatRelativeTime(session.startedAt)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tutoring setup panel — slides in below header */}
      {showTutoringSetup && (
        <div className="shrink-0 border-b border-border bg-surface px-6 py-5">
          <div className="mx-auto max-w-4xl">
            <TutoringSetupPanel
              classes={classes}
              onStart={handleStartTutoring}
              onCancel={() => setShowTutoringSetup(false)}
            />
          </div>
        </div>
      )}

      {/* Chat area — fills remaining height */}
      <div className="flex flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-4xl flex-col px-4 sm:px-6">
          <ChatPanel
            key={chatKey}
            initialQuery={activeInitialQuery}
            tutoringContext={tutoringContext}
            onOpenTutoring={() => setShowTutoringSetup(true)}
          />
        </div>
      </div>
    </>
  );
}
