export type ThemeMode = "light" | "dark" | "system";
export type ThemePreset = "spruce" | "ocean" | "graphite" | "sunrise";

export type ThemeCssToken =
  | "bg"
  | "fg"
  | "muted"
  | "card"
  | "border"
  | "surface"
  | "hero"
  | "hero-mid"
  | "hero-light"
  | "sidebar"
  | "sidebar-active"
  | "sidebar-hover"
  | "sidebar-accent"
  | "sidebar-text"
  | "accent-green"
  | "accent-green-fg"
  | "accent-blue"
  | "accent-blue-fg"
  | "accent-amber"
  | "accent-amber-fg"
  | "accent-rose"
  | "accent-rose-fg"
  | "accent-purple"
  | "accent-purple-fg";

type ThemeTokenSet = Record<ThemeCssToken, string>;

export type ThemePresetDefinition = {
  label: string;
  description: string;
  preview: {
    panel: string;
    accent: string;
    surface: string;
  };
  light: ThemeTokenSet;
  dark: ThemeTokenSet;
};

const semanticLight = {
  "accent-green": "#d4edd9",
  "accent-green-fg": "#1a4028",
  "accent-blue": "#d4e6f7",
  "accent-blue-fg": "#173354",
  "accent-amber": "#fdefd3",
  "accent-amber-fg": "#4a3000",
  "accent-rose": "#fde0e0",
  "accent-rose-fg": "#4a1010",
  "accent-purple": "#ebe0fd",
  "accent-purple-fg": "#2e1054",
} as const;

const semanticDark = {
  "accent-green": "#1e3e24",
  "accent-green-fg": "#7dd98a",
  "accent-blue": "#142a44",
  "accent-blue-fg": "#7ab8e8",
  "accent-amber": "#3a280a",
  "accent-amber-fg": "#e8b854",
  "accent-rose": "#3a1414",
  "accent-rose-fg": "#e88080",
  "accent-purple": "#2a1a48",
  "accent-purple-fg": "#c090f0",
} as const;

function withSemantic(
  core: Omit<
    ThemeTokenSet,
    | "accent-green"
    | "accent-green-fg"
    | "accent-blue"
    | "accent-blue-fg"
    | "accent-amber"
    | "accent-amber-fg"
    | "accent-rose"
    | "accent-rose-fg"
    | "accent-purple"
    | "accent-purple-fg"
  >,
  semantic: Record<
    | "accent-green"
    | "accent-green-fg"
    | "accent-blue"
    | "accent-blue-fg"
    | "accent-amber"
    | "accent-amber-fg"
    | "accent-rose"
    | "accent-rose-fg"
    | "accent-purple"
    | "accent-purple-fg",
    string
  >,
): ThemeTokenSet {
  return {
    ...core,
    ...semantic,
  };
}

export const THEME_PRESETS: Record<ThemePreset, ThemePresetDefinition> = {
  spruce: {
    label: "Spruce",
    description: "Quiet forest greens with the original Command Center feel.",
    preview: {
      panel: "#102216",
      accent: "#59d889",
      surface: "#f4f7f4",
    },
    light: withSemantic(
      {
        bg: "#f5f7f5",
        fg: "#111b17",
        muted: "#627069",
        card: "#ffffff",
        border: "#dce4de",
        surface: "#eef2f0",
        hero: "#0f2117",
        "hero-mid": "#163020",
        "hero-light": "#1d3e28",
        sidebar: "#0f2117",
        "sidebar-active": "#1d3e28",
        "sidebar-hover": "#c8e8d0",
        "sidebar-accent": "#4ade80",
        "sidebar-text": "#7aab8a",
      },
      semanticLight,
    ),
    dark: withSemantic(
      {
        bg: "#111815",
        fg: "#dce8df",
        muted: "#7a9480",
        card: "#192a1e",
        border: "#25392a",
        surface: "#1e3024",
        hero: "#0d1b13",
        "hero-mid": "#122319",
        "hero-light": "#193225",
        sidebar: "#0d1b13",
        "sidebar-active": "#193225",
        "sidebar-hover": "#223e2d",
        "sidebar-accent": "#69e191",
        "sidebar-text": "#8cb89c",
      },
      semanticDark,
    ),
  },
  ocean: {
    label: "Ocean",
    description: "Cool blue shell tones with crisp, airy surfaces.",
    preview: {
      panel: "#0b1c31",
      accent: "#3bb4f5",
      surface: "#f4f8fc",
    },
    light: withSemantic(
      {
        bg: "#f4f8fc",
        fg: "#132033",
        muted: "#62748a",
        card: "#ffffff",
        border: "#d8e3ee",
        surface: "#ecf3f9",
        hero: "#0b1c31",
        "hero-mid": "#0f2642",
        "hero-light": "#16314f",
        sidebar: "#0b1c31",
        "sidebar-active": "#16314f",
        "sidebar-hover": "#d8e7f5",
        "sidebar-accent": "#38bdf8",
        "sidebar-text": "#8db1cf",
      },
      semanticLight,
    ),
    dark: withSemantic(
      {
        bg: "#0f1620",
        fg: "#dde7f2",
        muted: "#8aa0b8",
        card: "#151f2d",
        border: "#213146",
        surface: "#182537",
        hero: "#091525",
        "hero-mid": "#0d1d31",
        "hero-light": "#122745",
        sidebar: "#091525",
        "sidebar-active": "#122745",
        "sidebar-hover": "#1c3554",
        "sidebar-accent": "#4fc7fb",
        "sidebar-text": "#9bb6d4",
      },
      semanticDark,
    ),
  },
  graphite: {
    label: "Graphite",
    description: "Neutral slate shell with a clean cyan accent.",
    preview: {
      panel: "#171b24",
      accent: "#65c7ff",
      surface: "#f5f6f8",
    },
    light: withSemantic(
      {
        bg: "#f5f6f8",
        fg: "#191c22",
        muted: "#6b7280",
        card: "#ffffff",
        border: "#d9dde4",
        surface: "#eef1f5",
        hero: "#171b24",
        "hero-mid": "#1f2430",
        "hero-light": "#2a3140",
        sidebar: "#171b24",
        "sidebar-active": "#2a3140",
        "sidebar-hover": "#dfe4eb",
        "sidebar-accent": "#66d0ff",
        "sidebar-text": "#a0a8ba",
      },
      semanticLight,
    ),
    dark: withSemantic(
      {
        bg: "#0f1116",
        fg: "#e4e7ec",
        muted: "#8b93a3",
        card: "#171b24",
        border: "#252b38",
        surface: "#1c2230",
        hero: "#10131a",
        "hero-mid": "#171b24",
        "hero-light": "#202637",
        sidebar: "#10131a",
        "sidebar-active": "#202637",
        "sidebar-hover": "#2a3246",
        "sidebar-accent": "#7ad5ff",
        "sidebar-text": "#aab4c8",
      },
      semanticDark,
    ),
  },
  sunrise: {
    label: "Sunrise",
    description: "Warm copper shell with softer neutrals and a bright accent.",
    preview: {
      panel: "#2a1b13",
      accent: "#f59f5a",
      surface: "#fbf6f1",
    },
    light: withSemantic(
      {
        bg: "#fbf6f1",
        fg: "#2d1f18",
        muted: "#7b6558",
        card: "#ffffff",
        border: "#ecdccf",
        surface: "#f6ede5",
        hero: "#2a1b13",
        "hero-mid": "#382219",
        "hero-light": "#4a2e21",
        sidebar: "#2a1b13",
        "sidebar-active": "#4a2e21",
        "sidebar-hover": "#f0ddd0",
        "sidebar-accent": "#fb923c",
        "sidebar-text": "#c79e81",
      },
      semanticLight,
    ),
    dark: withSemantic(
      {
        bg: "#17110e",
        fg: "#f0e3d8",
        muted: "#b79a88",
        card: "#201612",
        border: "#37261e",
        surface: "#281c16",
        hero: "#140d09",
        "hero-mid": "#22140e",
        "hero-light": "#321d15",
        sidebar: "#140d09",
        "sidebar-active": "#321d15",
        "sidebar-hover": "#42261b",
        "sidebar-accent": "#ffae63",
        "sidebar-text": "#d4a989",
      },
      semanticDark,
    ),
  },
};

export const DEFAULT_THEME_PRESET: ThemePreset = "spruce";
export const THEME_STORAGE_KEYS = {
  mode: "scc-theme-mode",
  preset: "scc-theme-preset",
  accent: "scc-theme-accent",
  sidebar: "scc-theme-sidebar",
} as const;

export function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "system" && typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

export function resolveThemeTokens(
  preset: ThemePreset,
  resolvedMode: "light" | "dark",
): ThemeTokenSet {
  const selected = THEME_PRESETS[preset] ?? THEME_PRESETS[DEFAULT_THEME_PRESET];
  return resolvedMode === "dark" ? selected.dark : selected.light;
}

export function hexToRgbTriplet(hex: string): string {
  const normalized = hex.trim().replace(/^#/, "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => part + part)
          .join("")
      : normalized;

  if (!/^[\da-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  const r = Number.parseInt(expanded.slice(0, 2), 16);
  const g = Number.parseInt(expanded.slice(2, 4), 16);
  const b = Number.parseInt(expanded.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function applyThemeToDocument(
  mode: ThemeMode,
  preset: ThemePreset,
  target: Pick<HTMLElement, "dataset" | "style">,
  systemPrefersDark?: boolean,
) {
  const resolvedMode =
    mode === "dark" || (mode === "system" && systemPrefersDark) ? "dark" : "light";
  const tokens = resolveThemeTokens(preset, resolvedMode);

  target.dataset.theme = resolvedMode;
  target.dataset.themePreset = preset;

  for (const [token, value] of Object.entries(tokens) as Array<[ThemeCssToken, string]>) {
    target.style.setProperty(`--${token}`, hexToRgbTriplet(value));
  }
}

export function migrateLegacyThemePreset(
  legacyAccent: string | null,
  legacySidebar: string | null,
): ThemePreset {
  if (legacySidebar === "ocean" || legacyAccent === "ocean") return "ocean";
  if (legacySidebar === "midnight" || legacySidebar === "slate") return "graphite";
  if (legacyAccent === "sunset" || legacyAccent === "rose") return "sunrise";
  return DEFAULT_THEME_PRESET;
}
