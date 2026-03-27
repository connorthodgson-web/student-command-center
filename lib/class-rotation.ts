import type { SchoolClass } from "../types";

export type RotationDay = "A" | "B";

const ROTATION_DAY_ORDER: RotationDay[] = ["A", "B"];

export function normalizeRotationDays(
  rotationDays?: RotationDay[] | null,
  scheduleLabel?: SchoolClass["scheduleLabel"] | null,
): RotationDay[] {
  const fromRotationDays = (rotationDays ?? []).filter(
    (day): day is RotationDay => day === "A" || day === "B",
  );

  if (fromRotationDays.length > 0) {
    return Array.from(new Set(fromRotationDays)).sort(
      (first, second) =>
        ROTATION_DAY_ORDER.indexOf(first) - ROTATION_DAY_ORDER.indexOf(second),
    );
  }

  if (scheduleLabel === "A" || scheduleLabel === "B") {
    return [scheduleLabel];
  }

  return [];
}

export function getClassRotationDays(schoolClass: SchoolClass): RotationDay[] {
  return normalizeRotationDays(schoolClass.rotationDays, schoolClass.scheduleLabel);
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
): "" | RotationDay | "AB" {
  const normalized = normalizeRotationDays(rotationDays, scheduleLabel);

  if (normalized.length === 2) return "AB";
  return normalized[0] ?? "";
}

export function rotationSelectionToDays(
  value: "" | RotationDay | "AB",
): RotationDay[] {
  if (value === "AB") return ["A", "B"];
  if (value === "A" || value === "B") return [value];
  return [];
}

export function formatRotationBadge(
  rotationDays?: RotationDay[] | null,
  scheduleLabel?: SchoolClass["scheduleLabel"] | null,
): string | null {
  const normalized = normalizeRotationDays(rotationDays, scheduleLabel);

  if (normalized.length === 0) return null;
  if (normalized.length === 2) return "A+B";
  return `${normalized[0]}-Day`;
}

export function classHasRotationDay(
  schoolClass: SchoolClass,
  dayType: RotationDay,
): boolean {
  return getClassRotationDays(schoolClass).includes(dayType);
}
