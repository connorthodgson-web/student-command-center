"use client";

import Link from "next/link";
import { useAutomations } from "../../lib/stores/automationStore";
import { useClasses } from "../../lib/stores/classStore";
import type { Automation, AutomationType } from "../../types";

// ─── Type metadata ───────────────────────────────────────────────────────────

const TYPE_LABELS: Record<AutomationType, string> = {
  tonight_summary: "Tonight's Summary",
  morning_summary: "Morning Briefing",
  due_soon: "Due Soon Alert",
  study_reminder: "Study Reminder",
  class_reminder: "Class Reminder",
  custom: "Custom",
};

const TYPE_COLORS: Record<AutomationType, string> = {
  tonight_summary: "bg-accent-amber/20 text-accent-amber-foreground",
  morning_summary: "bg-accent-blue/20 text-accent-blue-foreground",
  due_soon: "bg-accent-rose/20 text-accent-rose-foreground",
  study_reminder: "bg-accent-green/50 text-accent-green-foreground",
  class_reminder: "bg-accent-purple/20 text-accent-purple-foreground",
  custom: "bg-surface text-muted",
};

const TYPE_ACCENT: Record<AutomationType, string> = {
  tonight_summary: "bg-accent-amber-foreground",
  morning_summary: "bg-accent-blue-foreground",
  due_soon: "bg-accent-rose-foreground",
  study_reminder: "bg-accent-green-foreground",
  class_reminder: "bg-accent-purple-foreground",
  custom: "bg-border",
};

// ─── Example prompts ─────────────────────────────────────────────────────────

const EXAMPLE_PROMPTS = [
  "Remind me to study chemistry every Sunday at 6 PM",
  "Give me a summary every school night at 7:30 PM",
  "Alert me 2 days before any assignment is due",
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={enabled}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent focus-visible:ring-offset-2 ${
        enabled ? "bg-sidebar-accent" : "bg-border"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

function AutomationCard({
  automation,
  className: relatedClassName,
  onToggle,
  onRemove,
}: {
  automation: Automation;
  className?: string;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const accentBar = TYPE_ACCENT[automation.type] ?? "bg-border";
  const typeBadge = TYPE_COLORS[automation.type] ?? "bg-surface text-muted";
  const typeLabel = TYPE_LABELS[automation.type] ?? automation.type;

  return (
    <div
      className={`group relative flex gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-opacity ${
        automation.enabled ? "opacity-100" : "opacity-60"
      }`}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full ${accentBar}`} />

      {/* Content */}
      <div className="ml-2 flex flex-1 flex-col gap-1.5 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-foreground leading-snug truncate">
            {automation.title}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <ToggleSwitch enabled={automation.enabled} onToggle={onToggle} />
          </div>
        </div>

        <p className="text-xs text-muted">{automation.scheduleDescription}</p>

        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          {/* Type badge */}
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${typeBadge}`}>
            {typeLabel}
          </span>

          {/* Related class label */}
          {relatedClassName && (
            <span className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-muted">
              {relatedClassName}
            </span>
          )}
        </div>
      </div>

      {/* Remove button — visible on hover */}
      <button
        onClick={onRemove}
        className="absolute right-3 top-3 flex rounded p-1 text-muted opacity-0 transition-opacity hover:bg-surface hover:text-foreground group-hover:opacity-100 active:opacity-100 focus-visible:opacity-100"
        aria-label="Remove automation"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 px-8 py-14 text-center">
      {/* Icon */}
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-green/40">
        <svg className="h-6 w-6 text-accent-green-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <p className="text-sm font-medium text-foreground">No automations yet</p>
      <p className="mt-1 max-w-xs text-xs text-muted">
        Ask the assistant to set up a reminder or summary and it will appear here.
      </p>

      <Link
        href="/chat"
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-80"
      >
        <span className="text-[13px] leading-none">✦</span>
        Open assistant
      </Link>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const { automations, toggleAutomation, removeAutomation } = useAutomations();
  const { classes } = useClasses();

  const active = automations.filter((a) => a.enabled);
  const inactive = automations.filter((a) => !a.enabled);

  function getClassName(classId?: string) {
    if (!classId) return undefined;
    return classes.find((c) => c.id === classId)?.name;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Page header ──────────────────────────────────────── */}
      <div className="border-b border-border bg-card px-6 py-8 md:px-10">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[15px] leading-none opacity-70">◉</span>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Automations
            </p>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Reminders &amp; Automations
          </h1>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            The assistant can set up recurring reminders, nightly summaries, and
            study nudges for you. Active automations are shown below.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-8 md:px-10 space-y-10">

        {/* ── Assistant CTA ─────────────────────────────────── */}
        <div className="rounded-2xl border border-sidebar-accent/30 bg-hero px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent/20">
              <span className="text-sm leading-none text-sidebar-accent">✦</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">
                Ask the assistant to set one up
              </p>
              <p className="mt-1 text-xs text-white/60 leading-relaxed">
                Just describe what you want in plain English. The assistant will create
                and save it for you.
              </p>

              {/* Example chips */}
              <div className="mt-3 flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <Link
                    key={prompt}
                    href={`/chat?q=${encodeURIComponent(prompt)}`}
                    className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/70 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                  >
                    &ldquo;{prompt}&rdquo;
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Active automations ────────────────────────────── */}
        {automations.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {active.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Active — {active.length}
                </h2>
                <div className="space-y-3">
                  {active.map((automation) => (
                    <AutomationCard
                      key={automation.id}
                      automation={automation}
                      className={getClassName(automation.relatedClassId)}
                      onToggle={() => toggleAutomation(automation.id)}
                      onRemove={() => removeAutomation(automation.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {inactive.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Paused — {inactive.length}
                </h2>
                <div className="space-y-3">
                  {inactive.map((automation) => (
                    <AutomationCard
                      key={automation.id}
                      automation={automation}
                      className={getClassName(automation.relatedClassId)}
                      onToggle={() => toggleAutomation(automation.id)}
                      onRemove={() => removeAutomation(automation.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── Delivery note ─────────────────────────────────── */}
        <p className="text-center text-[11px] text-muted/60">
          Reminders currently delivered in-app only. Email &amp; push notifications coming soon.
        </p>
      </div>
    </div>
  );
}
