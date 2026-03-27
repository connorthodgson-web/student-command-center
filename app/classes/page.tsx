"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SectionHeader } from "../../components/SectionHeader";
import { ClassMaterialsPanel } from "../../components/ClassMaterialsPanel";
import { formatTimeRange } from "../../lib/schedule";
import { getApTemplate } from "../../lib/ap-course-templates";
import {
  formatRotationBadge,
  getClassRotationDays,
} from "../../lib/class-rotation";
import type { SchoolClass } from "../../types";

export default function ClassesPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const loading = false;
  const [knowledgeClass, setKnowledgeClass] = useState<SchoolClass | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("scc-onboarding");
      if (raw) {
        const data = JSON.parse(raw) as { classes?: SchoolClass[] };
        if (Array.isArray(data.classes)) setClasses(data.classes);
      }
    } catch {}
  }, []);

  const updateClass = useCallback(async (id: string, updates: Partial<Omit<SchoolClass, "id">>) => {
    setClasses((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
      try {
        const raw = localStorage.getItem("scc-onboarding");
        const data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        localStorage.setItem("scc-onboarding", JSON.stringify({ ...data, classes: updated }));
      } catch {}
      return updated;
    });
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          title="Classes"
          description="Your schedule at a glance."
        />
        <div className="flex shrink-0 self-center gap-2">
          <Link
            href={`/chat?tutor=true`}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted transition hover:border-sidebar-accent/40 hover:bg-sidebar-accent/5 hover:text-foreground"
          >
            <span className="text-[10px] text-sidebar-accent">🎓</span>
            Start tutoring
          </Link>
          <a
            href="/settings?tab=schedule"
            className="shrink-0 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition hover:bg-surface hover:text-foreground"
          >
            Manage schedule
          </a>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted shadow-sm">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-sidebar-accent" />
          Loading your classes…
        </div>
      )}

      {!loading && classes.length > 0 && (
        <DayTypeScheduleView classes={classes} onKnowledge={setKnowledgeClass} />
      )}

      {!loading && classes.length === 0 && (
        <div className="space-y-4 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted">
            Add your first class so the assistant understands your schedule.
          </p>
          <a
            href="/settings?tab=schedule"
            className="inline-block rounded-full bg-accent-green-foreground px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Add Class
          </a>
        </div>
      )}

      {knowledgeClass && (
        <ClassKnowledgeModal
          schoolClass={knowledgeClass}
          onSave={async (updates) => {
            await updateClass(knowledgeClass.id, updates);
            setKnowledgeClass(null);
          }}
          onClose={() => setKnowledgeClass(null)}
        />
      )}
    </main>
  );
}

// ─── Timeline helpers ─────────────────────────────────────────────────────────

function parseTimeMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  return (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0);
}

function getClassDisplayTime(
  cls: SchoolClass
): { startMin: number; endMin: number } | null {
  if (cls.startTime && cls.endTime) {
    return {
      startMin: parseTimeMinutes(cls.startTime),
      endMin: parseTimeMinutes(cls.endTime),
    };
  }
  if (cls.meetings && cls.meetings.length > 0) {
    const first = cls.meetings[0];
    return {
      startMin: parseTimeMinutes(first.startTime),
      endMin: parseTimeMinutes(first.endTime),
    };
  }
  return null;
}

function hourLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display} ${suffix}`;
}

// ─── Overlap layout ───────────────────────────────────────────────────────────
// Groups overlapping class blocks into "clusters" and assigns each a column
// so they render side-by-side instead of stacking invisibly on top of each other.

type TimedEntry = { cls: SchoolClass; time: { startMin: number; endMin: number } };
type LayedOut   = TimedEntry & { col: number; colCount: number };

function layoutBlocks(entries: TimedEntry[]): LayedOut[] {
  if (entries.length === 0) return [];

  // Work with a copy sorted by start time
  const sorted = [...entries].sort((a, b) => a.time.startMin - b.time.startMin);
  const result: LayedOut[] = [];
  let i = 0;

  while (i < sorted.length) {
    // Expand the overlap cluster: keep extending while the next event starts
    // before the current cluster ends.
    let clusterEnd = sorted[i].time.endMin;
    let j = i + 1;
    while (j < sorted.length && sorted[j].time.startMin < clusterEnd) {
      clusterEnd = Math.max(clusterEnd, sorted[j].time.endMin);
      j++;
    }
    const group = sorted.slice(i, j);

    // Greedily assign columns within the cluster
    const colEnds: number[] = [];
    const assigned = group.map((entry) => {
      let col = colEnds.findIndex((end) => end <= entry.time.startMin);
      if (col === -1) col = colEnds.length;
      colEnds[col] = entry.time.endMin;
      return { ...entry, col };
    });

    const colCount = colEnds.length;
    assigned.forEach((e) => result.push({ ...e, colCount }));
    i = j;
  }

  return result;
}

const PX_PER_MIN = 1.4; // 84 px per hour — clear spacing
const TOP_PAD = 28;     // px above first hour line
const BOTTOM_PAD = 32;  // px below last hour line
const BLOCK_GAP = 3;    // px gap between stacked/adjacent blocks
const MIN_BLOCK_PX = 36; // minimum block height in px

// ─── Schedule timeline ────────────────────────────────────────────────────────

function ScheduleTimeline({
  classes,
  onKnowledge,
}: {
  classes: SchoolClass[];
  onKnowledge?: (cls: SchoolClass) => void;
}) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const timedEntries: TimedEntry[] = classes
    .map((cls) => {
      const time = getClassDisplayTime(cls);
      return time ? { cls, time } : null;
    })
    .filter((e): e is TimedEntry => e !== null)
    .sort((a, b) => a.time.startMin - b.time.startMin);

  const untimedClasses = classes.filter((cls) => !getClassDisplayTime(cls));

  // ── All classes lack times → skip the grid entirely ────────────────────────
  if (timedEntries.length === 0) {
    return (
      <div className="px-5 py-5">
        {untimedClasses.length > 0 ? (
          <UntimedSection classes={untimedClasses} onKnowledge={onKnowledge} />
        ) : (
          <p className="py-8 text-center text-sm text-muted">No classes to display.</p>
        )}
      </div>
    );
  }

  // ── Layout ─────────────────────────────────────────────────────────────────
  const laidOut = layoutBlocks(timedEntries);

  const allMins    = timedEntries.flatMap((e) => [e.time.startMin, e.time.endMin]);
  const dayStartMin = Math.floor(Math.min(...allMins) / 60) * 60;
  const dayEndMin   = Math.ceil(Math.max(...allMins)  / 60) * 60;
  const containerH  = (dayEndMin - dayStartMin) * PX_PER_MIN + TOP_PAD + BOTTOM_PAD;

  // Shorthand: minutes → px top offset within the container
  const toTop = (min: number) => (min - dayStartMin) * PX_PER_MIN + TOP_PAD;

  const hourMarkers: number[] = [];
  for (let m = dayStartMin; m <= dayEndMin; m += 60) hourMarkers.push(m);

  // "Now" line is only meaningful when the current time falls inside the day range
  const nowTop      = toTop(nowMinutes);
  const nowInRange  = nowMinutes > dayStartMin && nowMinutes < dayEndMin;

  return (
    <div className="px-5 py-4">
      <div className="flex">

        {/* ── Time axis (48 px wide) ───────────────────────────────────────── */}
        <div className="relative w-12 shrink-0 select-none" style={{ height: containerH }}>
          {hourMarkers.map((min) => (
            <div
              key={min}
              className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted/60"
              style={{ top: toTop(min) }}
            >
              {hourLabel(min)}
            </div>
          ))}

          {/* Dot lives in the axis column so the line starts right at the grid edge */}
          {nowInRange && (
            <div
              className="absolute right-0 z-20 translate-x-1/2 -translate-y-1/2"
              style={{ top: nowTop }}
            >
              <div className="h-2.5 w-2.5 rounded-full bg-accent-green-foreground ring-2 ring-accent-green/40" />
            </div>
          )}
        </div>

        {/* ── Grid + class blocks ──────────────────────────────────────────── */}
        <div className="relative min-w-0 flex-1" style={{ height: containerH }}>

          {/* Hour grid lines */}
          {hourMarkers.map((min) => (
            <div
              key={min}
              className="absolute inset-x-0 border-t border-border/30"
              style={{ top: toTop(min) }}
            />
          ))}

          {/* "Now" indicator — a clean horizontal rule across the whole grid */}
          {nowInRange && (
            <div
              className="absolute inset-x-0 z-10 border-t-2 border-accent-green-foreground/50"
              style={{ top: nowTop }}
            />
          )}

          {/* Class blocks */}
          {laidOut.map(({ cls, time, col, colCount }) => {
            const blockTop    = toTop(time.startMin) + BLOCK_GAP;
            const rawH        = (time.endMin - time.startMin) * PX_PER_MIN;
            const blockH      = Math.max(rawH - BLOCK_GAP, MIN_BLOCK_PX);
            const duration    = time.endMin - time.startMin;
            const dotColor    = cls.color ?? "#d4edd9";
            const isActive    = nowMinutes >= time.startMin && nowMinutes < time.endMin;

            // Overlap column geometry (percentage-based, with small pixel gap)
            const colW   = 100 / colCount;
            const leftPct = col * colW;
            const gapL   = col > 0           ? 2 : 0; // px gap on left  edge
            const gapR   = col < colCount - 1 ? 2 : 0; // px gap on right edge

            const startStr = cls.startTime || (cls.meetings?.[0]?.startTime ?? "");
            const endStr   = cls.endTime   || (cls.meetings?.[0]?.endTime   ?? "");

            return (
              <div
                key={cls.id}
                className={`group absolute overflow-hidden rounded-xl border-l-4 transition-shadow hover:shadow-md ${
                  isActive ? "ring-1 ring-inset ring-accent-green-foreground/25" : ""
                }`}
                style={{
                  top:    blockTop,
                  height: blockH,
                  left:   `calc(${leftPct}% + ${gapL}px)`,
                  right:  `calc(${100 - leftPct - colW}% + ${gapR}px)`,
                  backgroundColor: `${dotColor}${isActive ? "40" : "28"}`,
                  borderLeftColor: dotColor,
                }}
              >
                <div className="flex h-full items-start justify-between gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs font-semibold leading-tight text-foreground">
                        {cls.name}
                      </span>

                      {/* "Now" pill — only shown on the active block */}
                      {isActive && (
                        <span className="shrink-0 rounded-full bg-accent-green/30 px-1.5 py-px text-[9px] font-bold text-accent-green-foreground">
                          now
                        </span>
                      )}

                      {formatRotationBadge(cls.rotationDays, cls.scheduleLabel) && !isActive && (
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                            getClassRotationDays(cls).length === 2
                              ? "bg-accent-green text-accent-green-foreground"
                              : cls.scheduleLabel === "A"
                              ? "bg-accent-blue text-accent-blue-foreground"
                              : "bg-accent-purple text-accent-purple-foreground"
                          }`}
                        >
                          {formatRotationBadge(cls.rotationDays, cls.scheduleLabel)}
                        </span>
                      )}
                      {cls.isApCourse && (
                        <span className="shrink-0 rounded-full bg-accent-amber px-1.5 py-0.5 text-[9px] font-bold text-accent-amber-foreground">
                          AP
                        </span>
                      )}
                    </div>

                    {duration >= 40 && (cls.teacherName || cls.room) && (
                      <p className="mt-0.5 truncate text-[10px] text-muted">
                        {[cls.teacherName, cls.room].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {duration >= 30 && startStr && (
                      <p className="mt-0.5 text-[10px] tabular-nums text-muted">
                        {formatTimeRange(startStr, endStr)}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Link
                      href={`/chat?q=${encodeURIComponent(`Help me with ${cls.name}. What should I focus on and how can I do well in this class?`)}`}
                      title="Ask assistant about this class"
                      className="flex items-center justify-center rounded-full bg-black/10 p-1 text-foreground/70 hover:bg-black/20"
                    >
                      <span className="text-[9px] leading-none">✦</span>
                    </Link>
                    {onKnowledge && (
                      <button
                        type="button"
                        onClick={() => onKnowledge(cls)}
                        title="Class knowledge"
                        className={`rounded-full p-1 hover:bg-black/10 ${
                          cls.syllabusText || cls.classNotes || cls.isApCourse
                            ? "text-accent-green-foreground"
                            : "text-muted"
                        }`}
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar at the bottom of an active block */}
                {isActive && time.endMin > time.startMin && (
                  <div className="absolute inset-x-0 bottom-0 h-0.5 bg-black/5">
                    <div
                      className="h-full rounded-full bg-accent-green-foreground/50"
                      style={{
                        width: `${Math.min(100, ((nowMinutes - time.startMin) / (time.endMin - time.startMin)) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Untimed classes — shown below the grid */}
      {untimedClasses.length > 0 && (
        <UntimedSection
          classes={untimedClasses}
          onKnowledge={onKnowledge}
          className="mt-6 border-t border-border/40 pt-4"
        />
      )}
    </div>
  );
}

// ─── Untimed section ─────────────────────────────────────────────────────────
// Renders classes that have no times as a clean list below (or instead of) the grid.

function UntimedSection({
  classes,
  onKnowledge,
  className = "",
}: {
  classes: SchoolClass[];
  onKnowledge?: (cls: SchoolClass) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted/60">
        No time set
      </p>
      <div className="space-y-px">
        {classes.map((cls) => {
          const hasKnowledge = !!(cls.syllabusText || cls.classNotes || cls.isApCourse);
          return (
            <div
              key={cls.id}
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface/60"
            >
              <div
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: cls.color ?? "#d4edd9" }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold text-foreground">{cls.name}</span>
                  {formatRotationBadge(cls.rotationDays, cls.scheduleLabel) && (
                    <span
                      className={`rounded-full px-1.5 py-px text-[9px] font-bold ${
                        getClassRotationDays(cls).length === 2
                          ? "bg-accent-green text-accent-green-foreground"
                          : cls.scheduleLabel === "A"
                          ? "bg-accent-blue text-accent-blue-foreground"
                          : "bg-accent-purple text-accent-purple-foreground"
                      }`}
                    >
                      {formatRotationBadge(cls.rotationDays, cls.scheduleLabel)}
                    </span>
                  )}
                  {cls.isApCourse && (
                    <span className="rounded-full bg-accent-amber px-1.5 py-px text-[9px] font-bold text-accent-amber-foreground">
                      AP
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {[cls.teacherName, cls.room].filter(Boolean).join(" · ") || "No time or room set"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-all group-hover:opacity-100">
                <Link
                  href={`/chat?q=${encodeURIComponent(`Help me with ${cls.name}. What should I focus on and how can I do well?`)}`}
                  title="Ask assistant about this class"
                  className="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] font-medium text-muted hover:border-sidebar-accent/40 hover:text-foreground transition-colors"
                >
                  <span className="text-[9px] text-sidebar-accent">✦</span>
                  Ask
                </Link>
                {onKnowledge && (
                  <button
                    type="button"
                    onClick={() => onKnowledge(cls)}
                    title="Class knowledge"
                    className={`rounded-full p-1 hover:bg-surface ${
                      hasKnowledge ? "text-accent-green-foreground" : "text-muted"
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day-type schedule view ──────────────────────────────────────────────────

const DAY_LABEL_STYLE: Record<string, { bg: string; text: string }> = {
  A: { bg: "bg-accent-blue", text: "text-accent-blue-foreground" },
  B: { bg: "bg-accent-purple", text: "text-accent-purple-foreground" },
};

function getDayLabelStyle(label: string) {
  return DAY_LABEL_STYLE[label] ?? { bg: "bg-surface", text: "text-muted" };
}

function sortByStartTime(a: SchoolClass, b: SchoolClass): number {
  const aMin = getClassDisplayTime(a)?.startMin ?? 0;
  const bMin = getClassDisplayTime(b)?.startMin ?? 0;
  return aMin - bMin;
}

type DayLabel = "A" | "B";

function DayTypeScheduleView({
  classes,
  onKnowledge,
}: {
  classes: SchoolClass[];
  onKnowledge?: (cls: SchoolClass) => void;
}) {
  const dayLabels: DayLabel[] = Array.from(
    new Set(
      classes.flatMap((c) => getClassRotationDays(c))
    )
  ).sort();

  const everyday = [...classes.filter((c) => getClassRotationDays(c).length === 0)].sort(sortByStartTime);
  const hasRotation = dayLabels.length > 0;

  const [activeTab, setActiveTab] = useState<DayLabel | "">(dayLabels[0] ?? "");
  const effectiveTab: DayLabel | "" = (dayLabels as string[]).includes(activeTab)
    ? activeTab
    : dayLabels[0] ?? "";

  if (!hasRotation) {
    return (
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">Schedule</h2>
          <span className="ml-auto text-xs text-muted">
            {everyday.length} {everyday.length === 1 ? "class" : "classes"}
          </span>
        </div>
        <ScheduleTimeline classes={everyday} onKnowledge={onKnowledge} />
      </div>
    );
  }

  // Rotation exists — tab-based view
  const rotationClasses = [...classes.filter((c) => effectiveTab && getClassRotationDays(c).includes(effectiveTab))].sort(sortByStartTime);
  const tabClasses = [...rotationClasses, ...everyday].sort(sortByStartTime);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-border">
        {dayLabels.map((label) => {
          const count = classes.filter((c) => getClassRotationDays(c).includes(label)).length;
          const isActive = label === effectiveTab;
          const { bg, text } = getDayLabelStyle(label);
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActiveTab(label as DayLabel)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${bg} ${text}`}
              >
                {label}
              </span>
              {label} Day
              <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-muted tabular-nums">
                {count + everyday.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tabClasses.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-muted">No classes on {effectiveTab} Day yet.</p>
          <p className="mt-1 text-xs text-muted">
            Add classes and label them &ldquo;{effectiveTab}-Day&rdquo; to see them here.
          </p>
        </div>
      ) : (
        <ScheduleTimeline classes={tabClasses} onKnowledge={onKnowledge} />
      )}
    </div>
  );
}

// ─── Class Knowledge Modal ───────────────────────────────────────────────────

type ClassKnowledgeModalProps = {
  schoolClass: SchoolClass;
  onSave: (updates: Partial<Omit<SchoolClass, "id">>) => Promise<void>;
  onClose: () => void;
};

function ClassKnowledgeModal({ schoolClass, onSave, onClose }: ClassKnowledgeModalProps) {
  const [syllabusText, setSyllabusText] = useState(schoolClass.syllabusText ?? "");
  const [classNotes, setClassNotes] = useState(schoolClass.classNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apTemplate = schoolClass.isApCourse && schoolClass.apCourseKey
    ? getApTemplate(schoolClass.apCourseKey)
    : null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        syllabusText: syllabusText.trim() || undefined,
        classNotes: classNotes.trim() || undefined,
      });
    } catch {
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  const textareaClass =
    "w-full resize-none rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground truncate">{schoolClass.name}</h2>
              {schoolClass.isApCourse && (
                <span className="inline-flex items-center rounded-full bg-accent-amber px-2 py-0.5 text-[10px] font-semibold text-accent-amber-foreground shrink-0">
                  AP
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted">
              Class Knowledge — helps the assistant give smarter, class-specific answers
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1 text-muted transition-colors hover:bg-surface hover:text-foreground"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* AP template info */}
        {apTemplate && (
          <div className="mx-6 mt-4 rounded-xl border border-accent-amber/40 bg-accent-amber/10 px-4 py-3">
            <p className="text-xs font-semibold text-accent-amber-foreground">{apTemplate.officialName}</p>
            <p className="mt-0.5 text-xs text-muted">{apTemplate.description}</p>
            <p className="mt-1.5 text-xs text-muted">
              <span className="font-medium text-foreground">Key topics:</span>{" "}
              {apTemplate.units.slice(0, 4).join(", ")}{apTemplate.units.length > 4 ? "…" : ""}
            </p>
          </div>
        )}

        {schoolClass.isApCourse && !apTemplate && (
          <div className="mx-6 mt-4 rounded-xl border border-accent-amber/40 bg-accent-amber/10 px-4 py-3">
            <p className="text-xs text-muted">
              AP course detected. No built-in template available — add your syllabus below for the best assistant experience.
            </p>
          </div>
        )}

        {/* Fields */}
        <div className="space-y-4 px-6 py-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              Syllabus / course overview
              <span className="ml-1.5 text-xs font-normal text-muted">(optional)</span>
            </span>
            <textarea
              value={syllabusText}
              onChange={(e) => setSyllabusText(e.target.value)}
              placeholder="Paste key parts of your syllabus — topics covered, grading breakdown, important policies…"
              rows={4}
              className={textareaClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              Your notes about this class
              <span className="ml-1.5 text-xs font-normal text-muted">(optional)</span>
            </span>
            <textarea
              value={classNotes}
              onChange={(e) => setClassNotes(e.target.value)}
              placeholder="Anything the assistant should know — study tips, how the teacher grades, what topics are hardest…"
              rows={3}
              className={textareaClass}
            />
          </label>

          <ClassMaterialsPanel classId={schoolClass.id} />

          {error && (
            <p className="rounded-xl border border-accent-rose bg-accent-rose px-4 py-2.5 text-sm text-accent-rose-foreground">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted">
              This info helps the assistant give smarter answers.
            </p>
            <Link
              href={`/chat?q=${encodeURIComponent(`Let's talk about my ${schoolClass.name} class. Help me understand what I should focus on and how to do well.`)}`}
              className="flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-sidebar-accent/40 hover:text-foreground"
              onClick={onClose}
            >
              <span className="text-[10px] text-sidebar-accent">✦</span>
              Ask assistant
            </Link>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-accent-green-foreground px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
