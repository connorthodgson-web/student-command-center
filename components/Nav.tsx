"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/chat", label: "Chat", icon: "✦" },
  { href: "/tasks", label: "Tasks", icon: "✓" },
  { href: "/classes", label: "Classes", icon: "◈" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

// TODO: Read student name from Supabase user profile once auth is set up
const ONBOARDING_KEY = "scc-onboarding";

export function Nav() {
  const pathname = usePathname();
  const [studentName, setStudentName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ONBOARDING_KEY);
      if (raw) {
        const data = JSON.parse(raw) as { name?: string };
        setStudentName(data.name?.split(" ")[0] ?? null);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // No nav on auth or onboarding pages
  if (pathname.startsWith("/auth") || pathname.startsWith("/onboarding")) {
    return null;
  }

  return (
    <>
      {/* ── Desktop top nav ─────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 hidden h-14 items-center border-b border-border bg-card px-6 md:flex">
        {/* App name / greeting */}
        <Link
          href="/dashboard"
          className="mr-8 shrink-0 text-sm font-bold tracking-tight text-foreground"
        >
          {studentName ? `Hi, ${studentName}` : "Student Command Center"}
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-accent-green text-accent-green-foreground font-semibold"
                    : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Mobile fixed bottom nav ──────────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card md:hidden">
        <div className="flex items-stretch">
          {NAV_LINKS.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-1 flex-col items-center justify-center gap-1 py-3 transition-colors ${
                  isActive ? "text-accent-green-foreground" : "text-muted"
                }`}
              >
                <span className="text-base leading-none">{link.icon}</span>
                <span
                  className={`text-[10px] font-medium ${isActive ? "font-semibold" : ""}`}
                >
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
        {/* Safe area spacer for notched phones */}
        <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </nav>
    </>
  );
}
