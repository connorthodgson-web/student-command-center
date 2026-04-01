const HEX_COLOR_PATTERN = /^#?(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/;

export const DEFAULT_CLASS_COLOR = "#D4EDD9";

export const CLASS_COLOR_OPTIONS = [
  { label: "Fern", value: "#D4EDD9" },
  { label: "Mint", value: "#BDEFD8" },
  { label: "Sage", value: "#B7E4C7" },
  { label: "Pine", value: "#99D9B7" },
  { label: "Moss", value: "#C8E7A2" },
  { label: "Olive", value: "#DCE7B3" },
  { label: "Lime", value: "#E4F6B7" },
  { label: "Clover", value: "#B9E88E" },
  { label: "Sky", value: "#D4E6F7" },
  { label: "Cyan", value: "#C8EEF7" },
  { label: "Aqua", value: "#BDEFF3" },
  { label: "Ocean", value: "#BFDFF8" },
  { label: "Denim", value: "#C8D6F2" },
  { label: "Ice", value: "#D9F2FF" },
  { label: "Cerulean", value: "#A8D6F5" },
  { label: "Periwinkle", value: "#DCE2FF" },
  { label: "Lavender", value: "#EBE0FD" },
  { label: "Violet", value: "#E7D5FF" },
  { label: "Lilac", value: "#F0D7FF" },
  { label: "Orchid", value: "#F3D4F2" },
  { label: "Iris", value: "#D8CCFF" },
  { label: "Plum", value: "#E3C7F9" },
  { label: "Rose", value: "#FDE0E0" },
  { label: "Berry", value: "#F5D3E2" },
  { label: "Blush", value: "#F5D8E6" },
  { label: "Coral", value: "#FFD9CC" },
  { label: "Salmon", value: "#FFCFC2" },
  { label: "Petal", value: "#FFD6E7" },
  { label: "Watermelon", value: "#FFCDD6" },
  { label: "Peach", value: "#FFE3C7" },
  { label: "Apricot", value: "#FFD8B5" },
  { label: "Amber", value: "#FDEFD3" },
  { label: "Gold", value: "#F7E7B5" },
  { label: "Butter", value: "#FFF0B3" },
  { label: "Honey", value: "#F9E1A8" },
  { label: "Melon", value: "#FFD2A6" },
  { label: "Sand", value: "#E9DFC9" },
  { label: "Slate", value: "#DDE3E8" },
  { label: "Steel", value: "#D3DAE7" },
  { label: "Stone", value: "#E7E3DB" },
  { label: "Mist", value: "#E5EBF0" },
  { label: "Cloud", value: "#EEF2F5" },
  { label: "Pebble", value: "#D7D3CC" },
  { label: "Ruby", value: "#F4B8C4" },
  { label: "Brick", value: "#F0B7AE" },
  { label: "Sunset", value: "#FFCAA7" },
  { label: "Cantaloupe", value: "#FFC894" },
  { label: "Seafoam", value: "#C9F3E4" },
  { label: "Teal", value: "#B6E7DC" },
  { label: "Robin", value: "#BEE6FF" },
  { label: "Indigo", value: "#CFCFFF" },
] as const;

export const CLASS_COLOR_GROUPS = [
  {
    label: "Fresh",
    options: ["#D4EDD9", "#BDEFD8", "#B7E4C7", "#99D9B7", "#C8E7A2", "#B9E88E"],
  },
  {
    label: "Cool",
    options: ["#D4E6F7", "#C8EEF7", "#BDEFF3", "#BFDFF8", "#D9F2FF", "#A8D6F5"],
  },
  {
    label: "Soft",
    options: ["#DCE2FF", "#EBE0FD", "#E7D5FF", "#F0D7FF", "#D8CCFF", "#E3C7F9"],
  },
  {
    label: "Warm",
    options: ["#FDE0E0", "#F5D3E2", "#F5D8E6", "#FFD9CC", "#FFD6E7", "#FFCDD6"],
  },
  {
    label: "Sunny",
    options: ["#FFE3C7", "#FFD8B5", "#FDEFD3", "#F7E7B5", "#F9E1A8", "#FFC894"],
  },
  {
    label: "Neutral",
    options: ["#E9DFC9", "#DDE3E8", "#D3DAE7", "#E7E3DB", "#E5EBF0", "#EEF2F5"],
  },
  {
    label: "Bold",
    options: ["#F4B8C4", "#F0B7AE", "#FFCAA7", "#C9F3E4", "#BEE6FF", "#CFCFFF"],
  },
] as const;

export const AI_CLASS_COLORS = CLASS_COLOR_GROUPS.flatMap((group) => group.options);

const CLASS_COLOR_LABELS: Map<string, string> = new Map(
  CLASS_COLOR_OPTIONS.map((option) => [option.value, option.label] as const),
);

export function normalizeClassColor(value: string | undefined | null): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!HEX_COLOR_PATTERN.test(trimmed)) return undefined;

  const raw = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  const normalized =
    raw.length === 3
      ? raw
          .split("")
          .map((part) => part + part)
          .join("")
      : raw;

  return `#${normalized.toUpperCase()}`;
}

export function resolveClassColor(value: string | undefined | null): string {
  return normalizeClassColor(value) ?? DEFAULT_CLASS_COLOR;
}

export function getClassColorLabel(value: string | undefined | null): string {
  const normalized = resolveClassColor(value);
  return CLASS_COLOR_LABELS.get(normalized) ?? "Custom";
}

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = normalizeClassColor(hex) ?? DEFAULT_CLASS_COLOR;
  const color = normalized.slice(1);
  const r = Number.parseInt(color.slice(0, 2), 16);
  const g = Number.parseInt(color.slice(2, 4), 16);
  const b = Number.parseInt(color.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
