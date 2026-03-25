// UI redesign pass
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
        background: "#f5f7f5",
        foreground: "#111b17",
        muted: "#627069",
        card: "#ffffff",
        border: "#dce4de",
        accent: {
          green: {
            DEFAULT: "#d4edd9",
            foreground: "#1a4028",
          },
          blue: {
            DEFAULT: "#d4e6f7",
            foreground: "#173354",
          },
          amber: {
            DEFAULT: "#fdefd3",
            foreground: "#4a3000",
          },
          rose: {
            DEFAULT: "#fde0e0",
            foreground: "#4a1010",
          },
          purple: {
            DEFAULT: "#ebe0fd",
            foreground: "#2e1054",
          },
        },
        surface: "#eef2f0",

        // Deep forest green — used for hero sections and dark cards
        hero: "#0f2117",
        "hero-mid": "#163020",
        "hero-light": "#1d3e28",

        // Sidebar design tokens (mirrors hero palette + vivid brand accents)
        sidebar: {
          DEFAULT: "#0f2117",
          active: "#1d3e28",
          text: "#7aab8a",
          hover: "#c8e8d0",
          accent: "#4ade80",
        },
      },
    },
  },
  plugins: [],
};

export default config;
