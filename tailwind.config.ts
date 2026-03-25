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
        background: "var(--bg)",
        foreground: "var(--fg)",
        muted:      "var(--muted)",
        card:       "var(--card)",
        border:     "var(--border)",
        surface:    "var(--surface)",

        // ── Hero / dark sections ──────────────────────────────────
        hero:         "var(--hero)",
        "hero-mid":   "var(--hero-mid)",
        "hero-light": "var(--hero-light)",

        // ── Sidebar tokens ────────────────────────────────────────
        // sidebar-text and sidebar-accent use RGB triplets so that
        // Tailwind's opacity modifier syntax (e.g. /20, /50) works correctly.
        sidebar: {
          DEFAULT: "var(--sidebar)",
          active:  "var(--sidebar-active)",
          hover:   "var(--sidebar-hover)",
          text:    "rgb(var(--sidebar-text) / <alpha-value>)",
          accent:  "rgb(var(--sidebar-accent) / <alpha-value>)",
        },

        // ── Semantic accent palettes ──────────────────────────────
        // DEFAULT uses RGB triplets for opacity modifier support.
        // foreground uses simple hex vars (no opacity modifiers on fg text).
        accent: {
          green: {
            DEFAULT:    "rgb(var(--accent-green) / <alpha-value>)",
            foreground: "var(--accent-green-fg)",
          },
          blue: {
            DEFAULT:    "rgb(var(--accent-blue) / <alpha-value>)",
            foreground: "var(--accent-blue-fg)",
          },
          amber: {
            DEFAULT:    "rgb(var(--accent-amber) / <alpha-value>)",
            foreground: "var(--accent-amber-fg)",
          },
          rose: {
            DEFAULT:    "rgb(var(--accent-rose) / <alpha-value>)",
            foreground: "var(--accent-rose-fg)",
          },
          purple: {
            DEFAULT:    "rgb(var(--accent-purple) / <alpha-value>)",
            foreground: "var(--accent-purple-fg)",
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

      animation: {
        "pulse-gentle": "pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
