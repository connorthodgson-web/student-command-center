"use client";

import Link from "next/link";
import { useState } from "react";
import { useAutomations } from "../../lib/stores/automationStore";
import { useClasses } from "../../lib/stores/classStore";
import { usePlanningStore } from "../../lib/stores/planningStore";
import type { Automation, AutomationType } from "../../types";

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

const EXAMPLE_PROMPTS = [
  "Remind me to study chemistry every Sunday at 6 PM",
  "Give me a summary every school night at 7:30 PM",
  "Alert me 2 days before any assignment is due",
];

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const accentBar = TYPE_ACCENT[automation.type] ?? "bg-border";
  const typeBadge = TYPE_COLORS[automation.type] ?? "bg-surface text-muted";
  const typeLabel = TYPE_LABELS[automation.type] ?? automation.type;

  const createdDate = new Date(automation.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className={`group relative flex gap-4 rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:shadow-card-md ${
        automation.enabled ? "opacity-100" : "opacity-60"
      }`}
    >
      <div className={`absolute bottom-4 left-0 top-4 w-[3px] rounded-r-full ${accentBar}`} />

      <div className="ml-2 flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium leading-snug text-foreground">{automation.title}</p>
          <div className="flex shrink-0 items-center gap-2">
            <ToggleSwitch enabled={automation.enabled} onToggle={onToggle} />
          </div>
        </div>

        <p className="text-xs text-muted">{automation.scheduleDescription}</p>

        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${typeBadge}`}>
            {typeLabel}
          </span>

          {relatedClassName && (
            <span className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-muted">
              {relatedClassName}
            </span>
          )}

          <span className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-muted">
            {automation.deliveryChannel === "sms" ? "SMS" : "In-app"}
          </span>

          <span className="ml-auto text-[11px] text-muted/60">Added {createdDate}</span>
        </div>

        {confirmDelete && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-accent-rose/40 bg-accent-rose/10 px-3 py-2">
            <p className="flex-1 text-xs text-accent-rose-foreground">Remove this automation?</p>
            <button
              onClick={() => {
                onRemove();
                setConfirmDelete(false);
              }}
              className="rounded px-2 py-1 text-xs font-medium text-accent-rose-foreground transition-colors hover:bg-accent-rose/20"
            >
              Remove
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded px-2 py-1 text-xs text-muted transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {!confirmDelete && (
        <button
          onClick={() => setConfirmDelete(true)}
          className="absolute right-3 top-3 flex rounded p-1 text-muted/50 transition-all hover:bg-surface hover:text-foreground md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 focus-visible:opacity-100"
          aria-label="Remove automation"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 px-8 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-green/40">
        <svg className="h-6 w-6 text-accent-green-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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

export default function AutomationsPage() {
  const { automations, loading, toggleAutomation, removeAutomation } = useAutomations();
  const { classes } = useClasses();
  const { items: planningItems } = usePlanningStore();

  const active = automations.filter((a) => a.enabled);
  const inactive = automations.filter((a) => !a.enabled);
  const totalCount = automations.length;

  function getClassName(classId?: string) {
    if (!classId) return undefined;
    return classes.find((c) => c.id === classId)?.name;
  }

  return (
    <div className="min-h-dvh bg-background animate-page-enter">
      <div className="border-b border-border bg-card px-6 py-8 md:px-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[15px] leading-none opacity-70">◉</span>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Automations
            </p>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Reminders &amp; Automations
            </h1>
            {totalCount > 0 && (
              <span className="inline-flex items-center rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-muted">
                {totalCount} total · {active.length} active
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Your recurring reminders and assistant automations live here. Delivery preferences are in Settings.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-10 px-6 py-8 md:px-10">
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/settings?tab=notifications" className="rounded-2xl border border-border bg-card p-4 transition hover:bg-surface">
            <p className="text-sm font-semibold text-foreground">Reminder preferences</p>
            <p className="mt-1 text-xs text-muted">
              Choose delivery in Settings: in-app now, SMS when your number is verified.
            </p>
          </Link>
          <Link href="/activities" className="rounded-2xl border border-border bg-card p-4 transition hover:bg-surface">
            <p className="text-sm font-semibold text-foreground">Activities &amp; events</p>
            <p className="mt-1 text-xs text-muted">
              You have {planningItems.length} saved commitment{planningItems.length === 1 ? "" : "s"} the assistant can plan around.
            </p>
          </Link>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">This page</p>
            <p className="mt-1 text-xs text-muted">
              Reminder rules only. Practices, shifts, and appointments belong in Activities.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-sidebar-accent/30 bg-hero px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent/20">
              <span className="text-sm leading-none text-sidebar-accent">✦</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">Ask the assistant to set one up</p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">
                Just describe what you want in plain English. The assistant will create and save it
                for you.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-white/45">
                If you are trying to save a practice, shift, or appointment instead, use{" "}
                <Link href="/activities" className="underline underline-offset-2">
                  Activities &amp; Events
                </Link>.
              </p>

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

        {loading ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface/50 px-8 py-14 text-center text-sm text-muted">
            Loading automations...
          </div>
        ) : automations.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {active.length === 0 && inactive.length > 0 && (
              <div className="rounded-xl border border-dashed border-border bg-surface/60 px-4 py-3 text-center">
                <p className="text-xs text-muted">
                  All automations are paused. Toggle one to re-enable it.
                </p>
              </div>
            )}

            {active.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Active · {active.length}
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
                  Paused · {inactive.length}
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

        <p className="text-center text-[11px] text-muted/60">
          Delivery channel comes from Settings. Automations defines what runs and when.
        </p>
      </div>
    </div>
  );
}
