"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../lib/supabase/client";
import { useAuth } from "../lib/auth-context";

// primary: true items get a slightly elevated treatment when inactive
const NAV_LINKS = [
  {
    href: "/chat",
    label: "Assistant",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    primary: true,
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 22V12h6v10" />
      </svg>
    ),
  },
  {
    href: "/tasks",
    label: "Tasks",
    dividerBefore: true,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/classes",
    label: "Classes",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    href: "/activities",
    label: "Activities",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={1.8} strokeLinecap="round" />
        <path strokeLinecap="round" strokeWidth={1.8} d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    href: "/automations",
    label: "Automations",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <circle cx="12" cy="12" r="3" strokeWidth={1.8} />
      </svg>
    ),
  },
];

// Derive user initials from email or name
function getUserInitials(email?: string | null): string {
  if (!email) return "?";
  const local = email.split("@")[0];
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

function NavLinks({
  onLinkClick,
  pathname,
}: {
  onLinkClick?: () => void;
  pathname: string;
}) {
  return (
    <nav className="flex-1 px-3 py-4">
      {NAV_LINKS.map((link) => {
        const isActive =
          pathname === link.href || pathname.startsWith(link.href + "/");
        const isPrimary = "primary" in link && link.primary;
        return (
          <div key={link.href}>
            {"dividerBefore" in link && link.dividerBefore && (
              <div className="mx-1 my-2 border-t border-white/[0.06]" />
            )}
            <Link
              href={link.href}
              onClick={onLinkClick}
              className={`group relative mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                isActive
                  ? "bg-sidebar-active font-medium text-white"
                  : isPrimary
                  ? "text-sidebar-text/90 hover:bg-white/[0.06] hover:text-white"
                  : "text-sidebar-text hover:bg-white/[0.06] hover:text-white/80"
              }`}
            >
              {/* Vivid accent indicator bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-accent" />
              )}
              <span
                className={`shrink-0 transition-colors ${
                  isActive
                    ? "text-sidebar-accent"
                    : isPrimary
                    ? "text-sidebar-accent/60 group-hover:text-sidebar-accent/80"
                    : "text-sidebar-text/70 group-hover:text-sidebar-text"
                }`}
              >
                {link.icon}
              </span>
              <span className="leading-none">{link.label}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auth pages: no shell
  if (pathname.startsWith("/auth")) {
    return <>{children}</>;
  }

  async function handleSignOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  const initials = getUserInitials(user?.email);

  const Sidebar = ({ onLinkClick }: { onLinkClick?: () => void }) => (
    <>
      {/* Brand mark */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-5 py-[18px]">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sidebar-accent/20">
          <span className="text-xs font-bold leading-none text-sidebar-accent">S</span>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
          Command Center
        </span>
      </div>

      <NavLinks pathname={pathname} onLinkClick={onLinkClick} />

      {/* Footer */}
      <div className="border-t border-white/[0.07] px-4 py-4 space-y-3">
        {user && (
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
            {/* User avatar with initials */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent/25 text-[10px] font-bold text-sidebar-accent">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-sidebar-text/80">
                {user.email}
              </p>
              <button
                onClick={handleSignOut}
                className="text-[10px] text-sidebar-text/40 hover:text-sidebar-text/70 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* Dev tools link — subtle */}
        <Link
          href="/dev/parse-test"
          className={`block rounded-lg px-2 py-1 text-[10px] transition-colors ${
            pathname.startsWith("/dev")
              ? "text-sidebar-text/60"
              : "text-sidebar-text/25 hover:text-sidebar-text/50"
          }`}
        >
          Dev tools
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 hidden w-[224px] flex-col bg-sidebar shadow-[1px_0_0_0_rgba(255,255,255,0.05)] md:flex">
        <Sidebar />
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/[0.07] bg-sidebar px-4 py-3 md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sidebar-accent/20">
            <span className="text-xs font-bold leading-none text-sidebar-accent">S</span>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
            Command Center
          </span>
        </div>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg p-1.5 text-sidebar-text/60 transition-colors hover:bg-white/5 hover:text-white"
          aria-label="Toggle menu"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* ── Mobile slide-over ────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[224px] flex-col bg-sidebar shadow-2xl">
            <Sidebar onLinkClick={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="md:ml-[224px]">{children}</main>
    </div>
  );
}
