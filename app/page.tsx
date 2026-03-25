import Link from "next/link";
import { SectionHeader } from "../components/SectionHeader";

const appAreas = [
  {
    href: "/dashboard",
    title: "Dashboard",
    description: "See your next task, grouped workload, and quick assistant capture in one place.",
    icon: "⊞",
  },
  {
    href: "/chat",
    title: "Assistant",
    description: "Ask what is due, what to work on tonight, or how to make sense of the week.",
    icon: "✦",
  },
  {
    href: "/tasks",
    title: "Tasks",
    description: "Capture school work naturally and review the structured task list behind it.",
    icon: "✓",
  },
  {
    href: "/classes",
    title: "Classes",
    description: "Set up class context so the assistant understands your academic life better.",
    icon: "◈",
  },
  {
    href: "/settings",
    title: "Settings",
    description: "Manage reminder preferences for daily summaries, tonight check-ins, and due-soon nudges.",
    icon: "⚙",
  },
];

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Dark hero matching dashboard */}
      <div className="bg-hero px-8 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-sidebar-text">
            Student Command Center
          </p>
          <h1 className="mt-3 text-[2.5rem] font-bold tracking-tight text-white leading-tight">
            Your AI-powered<br />academic assistant.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/60">
            Talk naturally. Capture tasks. Ask about your workload. Built around the way students actually think.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-full bg-sidebar-accent px-5 py-2.5 text-sm font-semibold text-hero transition hover:opacity-90"
            >
              Go to Dashboard →
            </Link>
            <Link
              href="/chat"
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10"
            >
              Open Assistant
            </Link>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-8 py-10">
        {/* How it works */}
        <section>
          <SectionHeader
            title="How It Works"
            description="Student Command Center is designed around natural capture, workload clarity, and AI-powered help — without planner complexity."
          />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Capture naturally",
                body: 'Type things like "Bio test next Friday" or "Remind me to study chemistry tonight."',
              },
              {
                step: "2",
                title: "Structure the mess",
                body: "The app turns messy inputs into structured tasks with class context, due dates, and reminders.",
              },
              {
                step: "3",
                title: "Ask for help",
                body: "Chat with the assistant about workload, upcoming tests, unfinished work, and what to do next.",
              },
            ].map((item) => (
              <div key={item.step} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <span className="inline-block rounded-full bg-accent-green px-2 py-0.5 text-[11px] font-semibold text-accent-green-foreground">
                  Step {item.step}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Main areas grid */}
        <section>
          <SectionHeader
            title="Main Areas"
            description="The MVP stays focused on assistant usefulness, not planner complexity."
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {appAreas.map((area) => (
              <Link
                key={area.href}
                href={area.href}
                className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-base text-muted group-hover:bg-accent-green group-hover:text-accent-green-foreground transition-colors">
                  {area.icon}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{area.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-muted">{area.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
