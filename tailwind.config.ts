// Student Command Center — Tailwind config
// Colors reference CSS custom properties defined in globals.css.
// This lets dark mode and accent theming work by simply swapping CSS vars
// without touching any component classes.
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Main surface tokens ───────────────────────────────────
        // Simple vars — no opacity modifier needed on these
        background: "rgb(var(--bg) / <alpha-value>)",
        foreground: "rgb(var(--fg) / <alpha-value>)",
        muted:      "rgb(var(--muted) / <alpha-value>)",
        card:       "rgb(var(--card) / <alpha-value>)",
        border:     "rgb(var(--border) / <alpha-value>)",
        surface:    "rgb(var(--surface) / <alpha-value>)",

        // ── Hero / dark sections ──────────────────────────────────
        hero:         "rgb(var(--hero) / <alpha-value>)",
        "hero-mid":   "rgb(var(--hero-mid) / <alpha-value>)",
        "hero-light": "rgb(var(--hero-light) / <alpha-value>)",

        // ── Sidebar tokens ────────────────────────────────────────
        // sidebar-text and sidebar-accent use RGB triplets so that
        // Tailwind's opacity modifier syntax (e.g. /20, /50) works correctly.
        sidebar: {
          DEFAULT: "rgb(var(--sidebar) / <alpha-value>)",
          active:  "rgb(var(--sidebar-active) / <alpha-value>)",
          hover:   "rgb(var(--sidebar-hover) / <alpha-value>)",
          text:    "rgb(var(--sidebar-text) / <alpha-value>)",
          accent:  "rgb(var(--sidebar-accent) / <alpha-value>)",
        },

        // ── Semantic accent palettes ──────────────────────────────
        // DEFAULT uses RGB triplets for opacity modifier support.
        // foreground uses simple hex vars (no opacity modifiers on fg text).
        accent: {
          green: {
            DEFAULT:    "rgb(var(--accent-green) / <alpha-value>)",
            foreground: "rgb(var(--accent-green-fg) / <alpha-value>)",
          },
          blue: {
            DEFAULT:    "rgb(var(--accent-blue) / <alpha-value>)",
            foreground: "rgb(var(--accent-blue-fg) / <alpha-value>)",
          },
          amber: {
            DEFAULT:    "rgb(var(--accent-amber) / <alpha-value>)",
            foreground: "rgb(var(--accent-amber-fg) / <alpha-value>)",
          },
          rose: {
            DEFAULT:    "rgb(var(--accent-rose) / <alpha-value>)",
            foreground: "rgb(var(--accent-rose-fg) / <alpha-value>)",
          },
          purple: {
            DEFAULT:    "rgb(var(--accent-purple) / <alpha-value>)",
            foreground: "rgb(var(--accent-purple-fg) / <alpha-value>)",
          },
        },
      },

      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },

      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },

      boxShadow: {
        "card": "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-md": "0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.04)",
      },

      keyframes: {
        "page-enter": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
      },
      animation: {
        "pulse-gentle": "pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "page-enter":   "page-enter 0.18s ease-out both",
        "fade-in":      "fade-in 0.15s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
