"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useClasses } from "../lib/stores/classStore";
import { useAuth } from "../lib/auth-context";
import { ChatPanel } from "./ChatPanel";
import { TutoringSetupPanel } from "./TutoringSetupPanel";
import type { AssistantSession, TutoringContext, TutoringMode } from "../types";

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
  persisted?: boolean;
  summary?: string;
  groundingLabel?: string;
  needsMoreMaterial?: boolean;
};

function getMetadataString(metadata: AssistantSession["metadata"], key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function getMetadataBoolean(metadata: AssistantSession["metadata"], key: string) {
  const value = metadata?.[key];
  return typeof value === "boolean" ? value : undefined;
}

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

function mapAssistantSessionToRecentSession(
  session: AssistantSession,
  className?: string,
): RecentSession | null {
  const mode = session.tutoringMode ?? session.tutoringContext?.mode;
  if (!mode) return null;

  return {
    id: session.id,
    mode,
    className,
    classId: session.classId ?? session.tutoringContext?.classId,
    topic: session.topic ?? session.tutoringContext?.topic,
    startedAt: session.lastMessageAt ?? session.updatedAt ?? session.createdAt,
    context: {
      ...(session.tutoringContext ?? {}),
      mode,
      classId: session.classId ?? session.tutoringContext?.classId,
      taskId: session.taskId ?? session.tutoringContext?.taskId,
      topic: session.topic ?? session.tutoringContext?.topic,
      goal: session.goal ?? session.tutoringContext?.goal,
      studyFocus: session.studyFocus ?? session.tutoringContext?.studyFocus,
    },
    persisted: true,
    summary: getMetadataString(session.metadata, "tutoringResumeSummary"),
    groundingLabel: getMetadataString(session.metadata, "tutoringGroundingLabel"),
    needsMoreMaterial: getMetadataBoolean(session.metadata, "tutoringNeedsMoreMaterial"),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

const VALID_TUTORING_MODES: TutoringMode[] = [
  "explain", "step_by_step", "quiz", "review", "study_plan", "homework_help",
];

function parseTutoringMode(value: string | null): TutoringMode | undefined {
  if (!value) return undefined;
  return VALID_TUTORING_MODES.includes(value as TutoringMode)
    ? (value as TutoringMode)
    : undefined;
}

interface ChatPageContentProps {
  initialQuery?: string;
  openTutoring?: boolean;
}

export function ChatPageContent({ initialQuery, openTutoring }: ChatPageContentProps) {
  const { user, loading: authLoading } = useAuth();
  const { classes } = useClasses();
  const searchParams = useSearchParams();

  // Tutoring deep-link params: ?mode=quiz&classId=X&topic=Y
  const deepLinkMode = parseTutoringMode(searchParams.get("mode"));
  const deepLinkClassId = searchParams.get("classId") ?? undefined;
  const deepLinkTopic = searchParams.get("topic") ?? undefined;
  const [showTutoringSetup, setShowTutoringSetup] = useState(false);
  const [tutoringContext, setTutoringContext] = useState<TutoringContext | undefined>();
  const [activeTutoringSessionId, setActiveTutoringSessionId] = useState<string | null>(null);
  const [preferredSessionId, setPreferredSessionId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [activeInitialQuery, setActiveInitialQuery] = useState<string | undefined>(initialQuery);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [showRecentSessions, setShowRecentSessions] = useState(false);
  const didAutoOpen = useRef(false);

  const refreshRecentSessions = useCallback(async () => {
    if (authLoading) return;

    if (!user) {
      setRecentSessions(loadRecentSessions());
      return;
    }

    try {
      const response = await fetch("/api/assistant/tutoring?status=active&limit=5", {
        cache: "no-store",
      });
      const json = (await response.json()) as {
        data?: AssistantSession[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(json.error ?? "Failed to load tutoring sessions.");
      }

      const mapped = (json.data ?? [])
        .map((session) =>
          mapAssistantSessionToRecentSession(
            session,
            classes.find((schoolClass) => schoolClass.id === session.classId)?.name,
          ),
        )
        .filter((session): session is RecentSession => Boolean(session));

      setRecentSessions(mapped);
    } catch {
      setRecentSessions([]);
    }
  }, [authLoading, classes, user]);

  useEffect(() => {
    void refreshRecentSessions();
  }, [refreshRecentSessions]);

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
    const localSessionId = user ? null : `${Date.now()}`;
    setTutoringContext(context);
    setActiveTutoringSessionId(localSessionId);
    setPreferredSessionId(null);
    setShowTutoringSetup(false);
    setActiveInitialQuery(firstMessage);
    setShowRecentSessions(false);
    // Remount ChatPanel so the new initialQuery + tutoringContext take effect
    setChatKey((k) => k + 1);

    if (!user && context.mode) {
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
      setRecentSessions(loadRecentSessions());
    }
  };

  const handleResumeSession = (session: RecentSession) => {
    if (session.persisted) {
      setTutoringContext(session.context);
      setActiveTutoringSessionId(session.id);
      setPreferredSessionId(session.id);
      setActiveInitialQuery(undefined);
      setShowRecentSessions(false);
      setShowTutoringSetup(false);
      setChatKey((k) => k + 1);
      return;
    }

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
    setActiveTutoringSessionId(session.id);
    setPreferredSessionId(null);
    setActiveInitialQuery(resumeMessage);
    setShowRecentSessions(false);
    setShowTutoringSetup(false);
    setChatKey((k) => k + 1);
  };

  const handleClearTutoring = () => {
    setTutoringContext(undefined);
    setActiveTutoringSessionId(null);
    setPreferredSessionId(null);
    setActiveInitialQuery(undefined);
    setChatKey((k) => k + 1);
  };

  const handleTutoringContextChange = (updates: Partial<TutoringContext>) => {
    setTutoringContext((current) => {
      if (!current) return current;

      const next = { ...current, ...updates };
      if (current.mode && activeTutoringSessionId && !user) {
        const className = classes.find((c) => c.id === next.classId)?.name;
        saveRecentSession({
          id: activeTutoringSessionId,
          mode: current.mode,
          className,
          classId: next.classId,
          topic: next.topic,
          startedAt: new Date().toISOString(),
          context: next,
        });
        setRecentSessions(loadRecentSessions());
      }

      if (current.mode && activeTutoringSessionId && user) {
        const mode = current.mode;
        setRecentSessions((existing) => {
          const className = classes.find((c) => c.id === next.classId)?.name;
          const updatedSession: RecentSession = {
            id: activeTutoringSessionId,
            mode,
            className,
            classId: next.classId,
            topic: next.topic,
            startedAt: new Date().toISOString(),
            context: next,
            persisted: true,
          };

          return [updatedSession, ...existing.filter((session) => session.id !== activeTutoringSessionId)].slice(0, 5);
        });
      }

      return next;
    });
  };

  const handleSessionChange = useCallback(
    (session: AssistantSession | null) => {
      if (!session) {
        if (!tutoringContext) {
          setPreferredSessionId(null);
        }
        return;
      }

      if (session.channel === "tutoring") {
        const nextContext: TutoringContext = {
          ...(session.tutoringContext ?? {}),
          mode: session.tutoringMode ?? session.tutoringContext?.mode,
          classId: session.classId ?? session.tutoringContext?.classId,
          taskId: session.taskId ?? session.tutoringContext?.taskId,
          topic: session.topic ?? session.tutoringContext?.topic,
          goal: session.goal ?? session.tutoringContext?.goal,
          studyFocus: session.studyFocus ?? session.tutoringContext?.studyFocus,
        };

        setTutoringContext(nextContext);
        setActiveTutoringSessionId(session.id);
        setPreferredSessionId(session.id);
        void refreshRecentSessions();
      } else {
        setPreferredSessionId(session.id);
      }
    },
    [refreshRecentSessions, tutoringContext],
  );

  const modeLabel = tutoringContext?.mode
    ? TUTORING_MODE_LABELS[tutoringContext.mode]
    : null;

  const modeIcon = tutoringContext?.mode
    ? TUTORING_MODE_ICONS[tutoringContext.mode]
    : null;
  const activeRecentSession = activeTutoringSessionId
    ? recentSessions.find((session) => session.id === activeTutoringSessionId)
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
                    ? (() => {
                        const activeClass = classes.find((c) => c.id === tutoringContext.classId);
                        const parts = [modeLabel, activeClass?.name, tutoringContext.topic].filter(Boolean).join(" · ");
                        const hasMaterials = activeClass && ((activeClass.materials?.length ?? 0) > 0 || activeClass.syllabusText || activeClass.classNotes);
                        return (
                          <span className="flex items-center gap-1.5 flex-wrap">
                            <span>{parts || "Tutoring session active"}</span>
                            {hasMaterials && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sidebar-accent/20 px-1.5 py-px text-[9px] font-semibold text-sidebar-accent/80">
                                <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                class materials
                              </span>
                            )}
                            {activeRecentSession?.groundingLabel && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-px text-[9px] font-semibold text-white/75">
                                {activeRecentSession.groundingLabel}
                              </span>
                            )}
                          </span>
                        );
                      })()
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
                  className={`flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
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
                    className="min-h-[36px] rounded-xl border border-sidebar-accent/30 bg-sidebar-accent/10 px-3 py-1.5 text-xs font-semibold text-sidebar-accent transition hover:bg-sidebar-accent/20"
                  >
                    Change mode
                  </button>
                  {/* Secondary action: end session (more muted — intentionally destructive) */}
                  <button
                    type="button"
                    onClick={handleClearTutoring}
                    className="min-h-[36px] rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-white/40 transition hover:border-white/20 hover:bg-white/5 hover:text-white/70"
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
                  className={`flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
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
                    {session.groundingLabel && (
                      <span className="block max-w-[240px] truncate text-[10px] text-sidebar-accent/80">
                        {session.groundingLabel}
                      </span>
                    )}
                    {session.topic && (
                      <span className="block truncate max-w-[160px] text-muted">{session.topic}</span>
                    )}
                    {session.summary && (
                      <span className="block max-w-[240px] truncate text-[10px] text-muted/80">
                        {session.summary}
                      </span>
                    )}
                    {session.needsMoreMaterial && (
                      <span className="block text-[10px] text-accent-rose-foreground">
                        Limited class material context
                      </span>
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
              initialMode={deepLinkMode}
              initialClassId={deepLinkClassId}
              initialTopic={deepLinkTopic}
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
            preferredSessionId={preferredSessionId}
            tutoringContext={tutoringContext}
            onTutoringContextChange={handleTutoringContextChange}
            onSessionChange={handleSessionChange}
            onOpenTutoring={() => setShowTutoringSetup(true)}
          />
        </div>
      </div>
    </>
  );
}
