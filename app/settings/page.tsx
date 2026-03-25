"use client";

import { useState } from "react";
import { useTheme } from "../../lib/theme-context";
import { ACCENT_META } from "../../lib/theme-context";
import type { ThemeMode, AccentColor } from "../../lib/theme-context";
import { useReminderStore } from "../../lib/reminder-store";
import { loadProfile, saveProfile } from "../../lib/profile";
import type { StudentProfile, AssistantTone } from "../../lib/profile";

// ── Tab system ────────────────────────────────────────────────────────────────

type Tab = "appearance" | "notifications" | "profile";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "appearance",    label: "Appearance",    icon: "◑" },
  { id: "notifications", label: "Notifications", icon: "◎" },
  { id: "profile",       label: "Profile",       icon: "◉" },
];

// ── Mode picker card ──────────────────────────────────────────────────────────

function ModeCard({
  id,
  label,
  description,
  icon,
  selected,
  onClick,
}: {
  id: ThemeMode;
  label: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center gap-3 rounded-2xl border-2 p-5 text-center transition-all ${
        selected
          ? "border-sidebar-accent bg-sidebar-accent/10 shadow-card-md"
          : "border-border bg-card hover:border-border hover:bg-surface"
      }`}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-sidebar-accent text-[9px] font-bold text-[#0f2117]">
          ✓
        </span>
      )}
      <div
        className={`flex h-12 w-full items-center justify-center rounded-xl text-2xl transition-colors ${
          selected ? "bg-sidebar-accent/20" : "bg-surface"
        }`}
      >
        {icon}
      </div>
      <div>
        <p className={`text-sm font-semibold ${selected ? "text-foreground" : "text-foreground"}`}>
          {label}
        </p>
        <p className="mt-0.5 text-[11px] text-muted">{description}</p>
      </div>
    </button>
  );
}

// ── Accent swatch ─────────────────────────────────────────────────────────────

function AccentSwatch({
  accent,
  hex,
  label,
  selected,
  onClick,
}: {
  accent: AccentColor;
  hex: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2"
      title={label}
    >
      <span
        className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-all ${
          selected ? "ring-2 ring-offset-2 ring-offset-card scale-110" : "hover:scale-105"
        }`}
        style={
          {
            backgroundColor: hex,
            "--tw-ring-color": selected ? hex : undefined,
          } as React.CSSProperties
        }
      >
        {selected && (
          <svg className="h-4 w-4 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span className={`text-[11px] font-medium ${selected ? "text-foreground" : "text-muted"}`}>
        {label}
      </span>
    </button>
  );
}

// ── Toggle row (reusable) ─────────────────────────────────────────────────────

function ToggleRow({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3.5 text-left transition hover:bg-surface"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{description}</span>
      </span>
      {/* Toggle switch */}
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          enabled ? "bg-sidebar-accent" : "bg-border"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </span>
    </button>
  );
}

// ── Appearance tab ────────────────────────────────────────────────────────────

function AppearanceTab() {
  const { mode, accent, setMode, setAccent } = useTheme();

  const modes: {
    id: ThemeMode;
    label: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "light",
      label: "Light",
      description: "Clean and bright",
      icon: (
        <svg className="h-6 w-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" strokeWidth={2} />
          <path strokeLinecap="round" strokeWidth={2} d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ),
    },
    {
      id: "dark",
      label: "Dark",
      description: "Easy on the eyes",
      icon: (
        <svg className="h-6 w-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      ),
    },
    {
      id: "system",
      label: "System",
      description: "Follows your device",
      icon: (
        <svg className="h-6 w-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth={2} />
          <path strokeLinecap="round" strokeWidth={2} d="M8 21h8M12 17v4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-10">
      {/* Mode picker */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">Appearance mode</h2>
          <p className="mt-1 text-sm text-muted">Choose how the app looks to you.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {modes.map((m) => (
            <ModeCard
              key={m.id}
              id={m.id}
              label={m.label}
              description={m.description}
              icon={m.icon}
              selected={mode === m.id}
              onClick={() => setMode(m.id)}
            />
          ))}
        </div>
      </section>

      {/* Accent color */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">Accent color</h2>
          <p className="mt-1 text-sm text-muted">
            Changes the navigation highlight and interactive accents.
          </p>
        </div>
        <div className="flex flex-wrap gap-6">
          {(Object.entries(ACCENT_META) as [AccentColor, typeof ACCENT_META[AccentColor]][]).map(
            ([key, meta]) => (
              <AccentSwatch
                key={key}
                accent={key}
                hex={meta.hex}
                label={meta.label}
                selected={accent === key}
                onClick={() => setAccent(key)}
              />
            )
          )}
        </div>

        {/* Live preview strip */}
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div
            className="h-8 w-8 shrink-0 rounded-full shadow-sm"
            style={{ backgroundColor: ACCENT_META[accent].hex }}
          />
          <div>
            <p className="text-sm font-medium text-foreground">
              {ACCENT_META[accent].label} theme active
            </p>
            <p className="text-xs text-muted">
              Navigation highlight and interactive elements use this accent.
            </p>
          </div>
        </div>
      </section>

      {/* About this section */}
      <section className="rounded-2xl border border-dashed border-border bg-surface/50 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">About</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your appearance preferences are saved to this browser. They&apos;ll be remembered
          across sessions. Sign-in sync and additional themes are coming in a future update.
        </p>
      </section>
    </div>
  );
}

// ── Notifications tab ─────────────────────────────────────────────────────────

function NotificationsTab() {
  const { preferences, updatePreferences } = useReminderStore();

  const toggle = (key: "dailySummaryEnabled" | "tonightSummaryEnabled" | "dueSoonRemindersEnabled") => {
    updatePreferences({ [key]: !preferences[key] });
  };

  return (
    <div className="space-y-8">
      {/* Summaries group */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">Summaries</h2>
          <p className="mt-1 text-sm text-muted">
            Get a daily or nightly overview of your work and upcoming classes.
          </p>
        </div>
        <div className="space-y-2">
          <ToggleRow
            title="Daily summary"
            description={
              preferences.dailySummaryEnabled
                ? `Enabled at ${preferences.dailySummaryTime ?? "a saved time"}`
                : "Off — toggle to enable a morning overview"
            }
            enabled={preferences.dailySummaryEnabled}
            onToggle={() => toggle("dailySummaryEnabled")}
          />
          <ToggleRow
            title="Tonight summary"
            description={
              preferences.tonightSummaryEnabled
                ? `Enabled at ${preferences.tonightSummaryTime ?? "a saved time"}`
                : "Off — toggle to enable an evening recap"
            }
            enabled={preferences.tonightSummaryEnabled}
            onToggle={() => toggle("tonightSummaryEnabled")}
          />
        </div>
      </section>

      {/* Reminders group */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">Due date reminders</h2>
          <p className="mt-1 text-sm text-muted">
            Get alerted before assignments and tests are due.
          </p>
        </div>
        <div className="space-y-2">
          <ToggleRow
            title="Due soon reminders"
            description={
              preferences.dueSoonRemindersEnabled
                ? `${preferences.dueSoonHoursBefore ?? 0} hours before due dates`
                : "Off — toggle to get reminded before deadlines"
            }
            enabled={preferences.dueSoonRemindersEnabled}
            onToggle={() => toggle("dueSoonRemindersEnabled")}
          />
        </div>
      </section>

      {/* Delivery note */}
      <section className="rounded-2xl border border-dashed border-border bg-surface/50 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">Delivery</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Reminders are delivered in-app. Email and push notification support is coming soon.
          You can also ask the assistant to create custom automations from the{" "}
          <a href="/automations" className="font-medium text-accent-green-foreground underline underline-offset-2">
            Automations
          </a>{" "}
          page.
        </p>
      </section>
    </div>
  );
}

// ── Profile tab ───────────────────────────────────────────────────────────────

const TONE_OPTIONS: { value: AssistantTone; label: string; description: string }[] = [
  { value: "balanced", label: "Balanced", description: "Calm and supportive" },
  { value: "chill",    label: "Chill",    description: "Relaxed and casual" },
  { value: "focused",  label: "Focused",  description: "Direct and efficient" },
];

function ProfileTab() {
  const [profile, setProfile] = useState<StudentProfile>(() => loadProfile());
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<StudentProfile>) => {
    setProfile((p) => ({ ...p, ...patch }));
    setSaved(false);
  };

  const handleSave = () => {
    saveProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Basic info */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">About you</h2>
          <p className="mt-1 text-sm text-muted">
            Help the assistant know a bit about you. All fields are optional.
          </p>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="displayName">
              Display name
            </label>
            <input
              id="displayName"
              type="text"
              value={profile.displayName ?? ""}
              onChange={(e) => update({ displayName: e.target.value || undefined })}
              placeholder="e.g. Connor"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted/50"
            />
          </div>

          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="gradeLevel">
              Grade level
            </label>
            <input
              id="gradeLevel"
              type="text"
              value={profile.gradeLevel ?? ""}
              onChange={(e) => update({ gradeLevel: e.target.value || undefined })}
              placeholder="e.g. 11th, Junior, Sophomore"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted/50"
            />
          </div>

          <div className="rounded-xl border border-border bg-background px-4 py-3.5">
            <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="goals">
              Goals
            </label>
            <textarea
              id="goals"
              value={profile.goals ?? ""}
              onChange={(e) => update({ goals: e.target.value || undefined })}
              placeholder="e.g. Raise my GPA, get better at math, stay on top of deadlines"
              rows={3}
              className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted/50"
            />
          </div>
        </div>
      </section>

      {/* Tone picker */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">Assistant tone</h2>
          <p className="mt-1 text-sm text-muted">Choose how the assistant communicates with you.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {TONE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ assistantTone: opt.value })}
              className={`relative flex flex-col gap-1.5 rounded-2xl border-2 p-4 text-left transition-all ${
                profile.assistantTone === opt.value
                  ? "border-sidebar-accent bg-sidebar-accent/10 shadow-card-md"
                  : "border-border bg-card hover:bg-surface"
              }`}
            >
              {profile.assistantTone === opt.value && (
                <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-sidebar-accent text-[9px] font-bold text-[#0f2117]">
                  ✓
                </span>
              )}
              <span className="text-sm font-semibold text-foreground">{opt.label}</span>
              <span className="text-[11px] text-muted">{opt.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-xl bg-hero px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-hero-mid"
        >
          {saved ? "Saved ✓" : "Save profile"}
        </button>
        <p className="text-xs text-muted">Stored locally in your browser.</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("appearance");

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="border-b border-border bg-card px-6 py-8 md:px-10">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[15px] leading-none opacity-70">⚙</span>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Settings</p>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Preferences
          </h1>
          <p className="mt-1.5 text-sm text-muted leading-relaxed">
            Customize how the app looks and behaves for you.
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border bg-card px-6 md:px-10">
        <div className="mx-auto max-w-2xl">
          <div className="flex gap-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-1 py-3.5 mr-6 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <span className="text-base leading-none opacity-70">{tab.icon}</span>
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-sidebar-accent" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-2xl px-6 py-8 md:px-10">
        {activeTab === "appearance" && <AppearanceTab />}
        {activeTab === "notifications" && <NotificationsTab />}
        {activeTab === "profile" && <ProfileTab />}
      </div>
    </div>
  );
}
