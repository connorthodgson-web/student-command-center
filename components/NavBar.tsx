"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/dashboard", label: "Home" },
  {
    href: "/chat",
    label: "Assistant",
    icon: "✦",
    primary: true,
  },
  { href: "/tasks", label: "Tasks" },
  { href: "/classes", label: "Classes" },
  { href: "/settings", label: "Settings" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center px-6">
        {/* Brand */}
        <Link
          href="/dashboard"
          className="mr-5 shrink-0 py-3 text-sm font-bold tracking-tight text-foreground"
        >
          SCC
        </Link>

        {/* Nav links */}
        <div className="flex flex-1 items-center gap-0.5">
          {NAV_LINKS.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(link.href + "/");

            if (link.primary) {
              // Assistant gets a special highlighted pill treatment
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`mx-1 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-sidebar-accent/20 text-sidebar-accent ring-1 ring-sidebar-accent/30"
                      : "bg-sidebar-accent/10 text-sidebar-accent/70 hover:bg-sidebar-accent/15 hover:text-sidebar-accent"
                  }`}
                >
                  <span className="text-[11px]">{link.icon}</span>
                  {link.label}
                </Link>
              );
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`border-b-2 px-3 py-3 text-sm transition-colors ${
                  isActive
                    ? "border-sidebar-accent font-semibold text-foreground"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

      </div>
    </nav>
  );
}
