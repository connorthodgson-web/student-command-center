"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  applyThemeToDocument,
  DEFAULT_THEME_PRESET,
  migrateLegacyThemePreset,
  resolveIsDark,
  THEME_PRESETS,
  THEME_STORAGE_KEYS,
  type ThemeMode,
  type ThemePreset,
} from "./theme-system";

interface ThemeContextValue {
  mode: ThemeMode;
  theme: ThemePreset;
  resolvedMode: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  setTheme: (theme: ThemePreset) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const THEME_META = Object.fromEntries(
  Object.entries(THEME_PRESETS).map(([key, value]) => [key, value]),
) as typeof THEME_PRESETS;

function applyTheme(mode: ThemeMode, theme: ThemePreset) {
  if (typeof document === "undefined") return;
  applyThemeToDocument(
    mode,
    theme,
    document.documentElement,
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [theme, setThemeState] = useState<ThemePreset>(DEFAULT_THEME_PRESET);
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedMode = (localStorage.getItem(THEME_STORAGE_KEYS.mode) as ThemeMode | null) ?? "system";
    const savedTheme =
      (localStorage.getItem(THEME_STORAGE_KEYS.preset) as ThemePreset | null) ??
      migrateLegacyThemePreset(
        localStorage.getItem(THEME_STORAGE_KEYS.accent),
        localStorage.getItem(THEME_STORAGE_KEYS.sidebar),
      );

    setModeState(savedMode);
    setThemeState(savedTheme);
    applyTheme(savedMode, savedTheme);
    setResolvedMode(resolveIsDark(savedMode) ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      applyTheme("system", theme);
      setResolvedMode(mq.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode, theme]);

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode);
    localStorage.setItem(THEME_STORAGE_KEYS.mode, nextMode);
    applyTheme(nextMode, theme);
    setResolvedMode(resolveIsDark(nextMode) ? "dark" : "light");
  };

  const setTheme = (nextTheme: ThemePreset) => {
    setThemeState(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEYS.preset, nextTheme);
    applyTheme(mode, nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ mode, theme, resolvedMode, setMode, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
