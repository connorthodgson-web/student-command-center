"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "⌂" },
  { href: "/chat", label: "Chat", icon: "✦" },
  { href: "/tasks", label: "Tasks", icon: "✓" },
  { href: "/activities", label: "Activities", icon: "○" },
  { href: "/classes", label: "Classes", icon: "◇" },
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

  if (pathname.startsWith("/auth") || pathname.startsWith("/onboarding")) {
    return null;
  }

  return (
    <>
      <nav className="sticky top-0 z-30 hidden h-14 items-center border-b border-border bg-card px-6 md:flex">
        <Link
          href="/dashboard"
          className="mr-8 flex shrink-0 items-center gap-2.5"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-hero shadow-sm">
            <svg width="14" height="14" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="256" cy="256" r="164" fill="#59D889" />
              <circle cx="256" cy="256" r="118" fill="#102216" />
              <path d="M187 257.5C187 219.116 216.116 190 254.5 190C286.319 190 308.063 207.498 318.533 231.578L286.664 244.179C281.749 232.771 270.503 225 255.383 225C236.781 225 223 239.276 223 257.5C223 275.227 236.283 290 256.375 290C270.377 290 281.749 282.229 286.789 270.57L318.782 282.922C307.938 307.749 285.073 325 254.5 325C216.116 325 187 295.884 187 257.5Z" fill="#F5F7F5" />
              <path d="M273 189H307V325H273V189Z" fill="#F5F7F5" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {studentName ? `Hi, ${studentName}` : "Command Center"}
          </span>
        </Link>

        <div className="flex items-center gap-0.5">
          {NAV_LINKS.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent/20 text-sidebar-accent font-semibold"
                    : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card md:hidden">
        <div className="grid grid-cols-6 items-stretch">
          {NAV_LINKS.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                  isActive ? "text-sidebar-accent" : "text-muted"
                }`}
              >
                {isActive && (
                  <span className="absolute inset-x-3 top-0 h-[2px] rounded-b-full bg-sidebar-accent" />
                )}
                <span className="text-[17px] leading-none">{link.icon}</span>
                <span
                  className={`text-[11px] leading-tight ${isActive ? "font-semibold" : "font-medium"}`}
                >
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
        <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </nav>
    </>
  );
}
