import type {
  RotationDay,
  ScheduleArchitecture,
  ScheduleDayLabel,
} from "../types";

export const DEFAULT_ROTATION_LABELS: RotationDay[] = ["A", "B"];

export const DEFAULT_SCHEDULE_ARCHITECTURE: ScheduleArchitecture = {
  type: "rotation",
  rotationLabels: DEFAULT_ROTATION_LABELS,
};

export function normalizeScheduleDayLabel(
  value?: string | null,
): ScheduleDayLabel | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return normalized || null;
}

export function normalizeRotationLabels(labels?: string[] | null): RotationDay[] {
  const source = Array.isArray(labels) ? labels : DEFAULT_ROTATION_LABELS;
  const normalized = source
    .map((label) => normalizeScheduleDayLabel(label))
    .filter((label): label is RotationDay => Boolean(label));

  const unique = Array.from(new Set(normalized));
  return unique.length > 0 ? unique : DEFAULT_ROTATION_LABELS;
}

export function normalizeScheduleArchitecture(
  value?: Partial<ScheduleArchitecture> | null,
): ScheduleArchitecture {
  if (value?.type === "weekday") {
    return { type: "weekday" };
  }

  return {
    type: "rotation",
    rotationLabels: normalizeRotationLabels(
      value && "rotationLabels" in value ? value.rotationLabels : undefined,
    ),
  };
}

export function getRotationLabelsForArchitecture(
  architecture?: ScheduleArchitecture | null,
): RotationDay[] {
  const normalized = normalizeScheduleArchitecture(architecture);
  return normalized.type === "rotation" ? normalized.rotationLabels : [];
}

export function formatScheduleArchitectureLabel(
  architecture?: ScheduleArchitecture | null,
): string {
  const normalized = normalizeScheduleArchitecture(architecture);
  if (normalized.type === "weekday") {
    return "Weekday-based schedule";
  }
  return `Rotation schedule (${normalized.rotationLabels.join("/")})`;
}

export function isRotationArchitecture(
  architecture?: ScheduleArchitecture | null,
): boolean {
  return normalizeScheduleArchitecture(architecture).type === "rotation";
}
