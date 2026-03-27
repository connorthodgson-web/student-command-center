"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type AccentColor = "forest" | "ocean" | "amethyst" | "sunset" | "rose";
export type SidebarTheme = "forest" | "ocean" | "midnight" | "slate";

interface ThemeContextValue {
  mode: ThemeMode;
  accent: AccentColor;
  sidebar: SidebarTheme;
  resolvedMode: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  setSidebar: (sidebar: SidebarTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// RGB triplets for the sidebar/brand accent (used in CSS custom property)
export const ACCENT_VARS: Record<AccentColor, string> = {
  forest: "74 222 128",    // #4ade80 — vivid green
  ocean: "56 189 248",     // #38bdf8 — sky blue
  amethyst: "167 139 250", // #a78bfa — soft purple
  sunset: "251 146 60",    // #fb923c — warm orange
  rose: "244 114 182",     // #f472b6 — soft pink
};

export const ACCENT_META: Record<AccentColor, { label: string; hex: string; preview: string }> = {
  forest:   { label: "Forest",   hex: "#4ade80", preview: "bg-[#4ade80]" },
  ocean:    { label: "Ocean",    hex: "#38bdf8", preview: "bg-[#38bdf8]" },
  amethyst: { label: "Amethyst", hex: "#a78bfa", preview: "bg-[#a78bfa]" },
  sunset:   { label: "Sunset",   hex: "#fb923c", preview: "bg-[#fb923c]" },
  rose:     { label: "Rose",     hex: "#f472b6", preview: "bg-[#f472b6]" },
};

export const SIDEBAR_META: Record<SidebarTheme, { label: string; bg: string; preview: string }> = {
  forest:   { label: "Forest",   bg: "#0f2117", preview: "bg-[#0f2117]" },
  ocean:    { label: "Ocean",    bg: "#091829", preview: "bg-[#091829]" },
  midnight: { label: "Midnight", bg: "#080c14", preview: "bg-[#080c14]" },
  slate:    { label: "Slate",    bg: "#151820", preview: "bg-[#151820]" },
};

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "system" && typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

function applyTheme(mode: ThemeMode, accent: AccentColor, sidebar: SidebarTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark = resolveIsDark(mode);
  root.setAttribute("data-theme", dark ? "dark" : "light");
  root.setAttribute("data-sidebar", sidebar);
  root.style.setProperty("--sidebar-accent", ACCENT_VARS[accent]);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [accent, setAccentState] = useState<AccentColor>("forest");
  const [sidebar, setSidebarState] = useState<SidebarTheme>("forest");
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">("light");

  // On mount: load saved prefs and apply
  useEffect(() => {
    const savedMode = (localStorage.getItem("scc-theme-mode") as ThemeMode | null) ?? "light";
    const savedAccent = (localStorage.getItem("scc-theme-accent") as AccentColor | null) ?? "forest";
    const savedSidebar = (localStorage.getItem("scc-theme-sidebar") as SidebarTheme | null) ?? "forest";
    setModeState(savedMode);
    setAccentState(savedAccent);
    setSidebarState(savedSidebar);
    applyTheme(savedMode, savedAccent, savedSidebar);
    setResolvedMode(resolveIsDark(savedMode) ? "dark" : "light");
  }, []);

  // Respond to system preference changes when in "system" mode
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      applyTheme("system", accent, sidebar);
      setResolvedMode(mq.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode, accent, sidebar]);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem("scc-theme-mode", m);
    applyTheme(m, accent, sidebar);
    setResolvedMode(resolveIsDark(m) ? "dark" : "light");
  };

  const setAccent = (a: AccentColor) => {
    setAccentState(a);
    localStorage.setItem("scc-theme-accent", a);
    applyTheme(mode, a, sidebar);
  };

  const setSidebar = (s: SidebarTheme) => {
    setSidebarState(s);
    localStorage.setItem("scc-theme-sidebar", s);
    applyTheme(mode, accent, s);
  };

  return (
    <ThemeContext.Provider value={{ mode, accent, sidebar, resolvedMode, setMode, setAccent, setSidebar }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
