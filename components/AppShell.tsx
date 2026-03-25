// UI redesign pass
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../lib/supabase/client";
import { useAuth } from "../lib/auth-context";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/chat", label: "Assistant", icon: "✦" },
  { href: "/tasks", label: "Tasks", icon: "✓" },
  { href: "/classes", label: "Classes", icon: "◈" },
  { href: "/calendar", label: "Calendar", icon: "◫" },
  { href: "/automations", label: "Automations", icon: "◉" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

// Shared nav list — used by both desktop sidebar and mobile slide-over
function NavLinks({ onLinkClick, pathname }: { onLinkClick?: () => void; pathname: string }) {
  return (
    <nav className="flex-1 space-y-0.5 px-3 py-4">
      {NAV_LINKS.map((link) => {
        const isActive =
          pathname === link.href || pathname.startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onLinkClick}
            className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              isActive
                ? "bg-sidebar-active font-medium text-white"
                : "text-sidebar-text hover:bg-white/5 hover:text-sidebar-hover"
            }`}
          >
            {/* Vivid green indicator bar on active item */}
            {isActive && (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-accent" />
            )}
            <span className="w-4 shrink-0 text-center text-[15px] leading-none opacity-90">
              {link.icon}
            </span>
            {link.label}
          </Link>
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

  // Auth pages get no shell — just the page content
  if (pathname.startsWith("/auth")) {
    return <>{children}</>;
  }

  async function handleSignOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 hidden w-[220px] flex-col bg-sidebar md:flex">
        {/* Brand mark */}
        <div className="flex items-center gap-2.5 border-b border-white/[0.08] px-5 py-[18px]">
          <span className="inline-block h-2 w-2 rounded-full bg-sidebar-accent" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white">
            Command Center
          </span>
        </div>

        <NavLinks pathname={pathname} />

        {/* Footer — user info + sign out + dev link */}
        <div className="border-t border-white/[0.08] px-4 py-3 space-y-1">
          {user && (
            <div className="mb-2 px-2">
              <p className="truncate text-[11px] text-sidebar-text/70">{user.email}</p>
              <button
                onClick={handleSignOut}
                className="mt-1 text-[11px] text-sidebar-text/50 hover:text-sidebar-text transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
          <Link
            href="/dev/parse-test"
            className={`block rounded px-2 py-1 text-[11px] transition-colors ${
              pathname.startsWith("/dev")
                ? "text-sidebar-hover"
                : "text-sidebar-text/50 hover:text-sidebar-text"
            }`}
          >
            Dev tools
          </Link>
          <p className="px-2 text-[11px] text-white/20">AI-powered assistant</p>
        </div>
      </aside>

      {/* ── Mobile top bar ───────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-sidebar px-4 py-3 md:hidden">
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-2 w-2 rounded-full bg-sidebar-accent" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white">
            Command Center
          </span>
        </div>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md p-1.5 text-sidebar-text transition-colors hover:text-white"
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

      {/* ── Mobile slide-over ─────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[220px] flex-col bg-sidebar shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-white/[0.08] px-5 py-[18px]">
              <span className="inline-block h-2 w-2 rounded-full bg-sidebar-accent" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white">
                Command Center
              </span>
            </div>
            <NavLinks pathname={pathname} onLinkClick={() => setMobileOpen(false)} />
            <div className="border-t border-white/[0.08] px-5 py-4 space-y-1">
              {user && (
                <div className="mb-2">
                  <p className="truncate text-[11px] text-sidebar-text/70">{user.email}</p>
                  <button
                    onClick={handleSignOut}
                    className="mt-1 text-[11px] text-sidebar-text/50 hover:text-sidebar-text transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
              <p className="text-[11px] text-white/20">AI-powered assistant</p>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────── */}
      <main className="md:ml-[220px]">{children}</main>
    </div>
  );
}
