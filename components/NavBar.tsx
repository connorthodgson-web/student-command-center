"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tasks", label: "Tasks" },
  { href: "/chat", label: "Chat" },
  { href: "/classes", label: "Classes" },
  { href: "/settings", label: "Settings" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="bg-card border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-6 py-0">
        <span className="mr-4 py-3 text-sm font-semibold text-foreground">
          Student Command Center
        </span>
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`border-b-2 px-3 py-3 text-sm transition-colors ${
                isActive
                  ? "border-accentForeground font-semibold text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          );
        })}

        {/* Dev utility link — separated by auto margin, more muted than primary nav */}
        {/* TODO: Remove this link before any public release */}
        <div className="ml-auto">
          <Link
            href="/dev/parse-test"
            className={`px-3 py-3 text-xs transition-colors ${
              pathname.startsWith("/dev")
                ? "font-medium text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            Dev
          </Link>
        </div>
      </div>
    </nav>
  );
}
