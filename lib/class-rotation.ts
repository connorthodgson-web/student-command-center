import type { RotationDay, SchoolClass } from "../types";
import {
  DEFAULT_ROTATION_LABELS,
  getRotationLabelsForArchitecture,
  normalizeRotationLabels,
  normalizeScheduleDayLabel,
} from "./schedule-architecture";

export function normalizeRotationDays(
  rotationDays?: RotationDay[] | null,
  scheduleLabel?: SchoolClass["scheduleLabel"] | null,
  preferredOrder?: RotationDay[] | null,
): RotationDay[] {
  const order = normalizeRotationLabels(preferredOrder ?? DEFAULT_ROTATION_LABELS);
  const knownLabels = new Set(order);
  const fromRotationDays = (rotationDays ?? [])
    .map((day) => normalizeScheduleDayLabel(day))
    .filter((day): day is RotationDay => Boolean(day));

  if (fromRotationDays.length > 0) {
    return Array.from(new Set(fromRotationDays)).sort((first, second) => {
      const firstIndex = knownLabels.has(first) ? order.indexOf(first) : Number.MAX_SAFE_INTEGER;
      const secondIndex = knownLabels.has(second) ? order.indexOf(second) : Number.MAX_SAFE_INTEGER;
      if (firstIndex !== secondIndex) return firstIndex - secondIndex;
      return first.localeCompare(second);
    });
  }

  const normalizedScheduleLabel = normalizeScheduleDayLabel(scheduleLabel);
  if (normalizedScheduleLabel) {
    return [normalizedScheduleLabel];
  }

  return [];
}

export function getClassRotationDays(
  schoolClass: SchoolClass,
  preferredOrder?: RotationDay[] | null,
): RotationDay[] {
  return normalizeRotationDays(
    schoolClass.rotationDays,
    schoolClass.scheduleLabel,
    preferredOrder,
  );
}

export function deriveScheduleLabel(
  rotationDays?: RotationDay[] | null,
): SchoolClass["scheduleLabel"] | undefined {
  const normalized = normalizeRotationDays(rotationDays);
  return normalized.length === 1 ? normalized[0] : undefined;
}

export function getRotationSelectionValue(
  rotationDays?: RotationDay[] | null,
  scheduleLabel?: SchoolClass["scheduleLabel"] | null,
): RotationDay[] {
  const normalized = normalizeRotationDays(rotationDays, scheduleLabel);
  return normalized;
}

export function rotationSelectionToDays(
  value: RotationDay[] | RotationDay | "" | null | undefined,
): RotationDay[] {
  if (Array.isArray(value)) {
    return normalizeRotationDays(value);
  }
  const normalized = normalizeScheduleDayLabel(value);
  return normalized ? [normalized] : [];
}

export function formatRotationBadge(
  rotationDays?: RotationDay[] | null,
  scheduleLabel?: SchoolClass["scheduleLabel"] | null,
  preferredOrder?: RotationDay[] | null,
): string | null {
  const normalized = normalizeRotationDays(rotationDays, scheduleLabel, preferredOrder);

  if (normalized.length === 0) return null;
  if (normalized.length === 1) return `${normalized[0]}-Day`;
  return normalized.join("+");
}

export function classHasRotationDay(
  schoolClass: SchoolClass,
  dayType: RotationDay,
  preferredOrder?: RotationDay[] | null,
): boolean {
  const normalizedDay = normalizeScheduleDayLabel(dayType);
  if (!normalizedDay) return false;
  return getClassRotationDays(schoolClass, preferredOrder).includes(normalizedDay);
}

export function getRotationBadgeTone(label?: string | null): string {
  const normalized = normalizeScheduleDayLabel(label);
  if (normalized === "A") return "blue";
  if (normalized === "B") return "purple";
  return "green";
}

export function getArchitectureRotationDays(architectureLabels?: RotationDay[] | null) {
  return normalizeRotationLabels(
    architectureLabels ?? getRotationLabelsForArchitecture({ type: "rotation", rotationLabels: DEFAULT_ROTATION_LABELS }),
  );
}
