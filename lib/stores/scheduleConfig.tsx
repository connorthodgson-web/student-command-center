"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { RotationDay, ScheduleArchitecture } from "../../types";
import {
  DEFAULT_SCHEDULE_ARCHITECTURE,
  getRotationLabelsForArchitecture,
  normalizeScheduleArchitecture,
  normalizeScheduleDayLabel,
} from "../schedule-architecture";

const STORAGE_KEY = "scc_schedule_config_v2";
const LEGACY_DAY_TYPE_KEY = "scc_day_type_v1";

type PersistedScheduleConfig = {
  architecture?: ScheduleArchitecture;
  selectedScheduleDay?: RotationDay | null;
};

type ScheduleConfigContextValue = {
  scheduleArchitecture: ScheduleArchitecture;
  setScheduleArchitecture: (architecture: ScheduleArchitecture) => void;
  selectedScheduleDay: RotationDay | null;
  setSelectedScheduleDay: (label: RotationDay | null) => void;
  rotationLabels: RotationDay[];
  isRotationSchedule: boolean;
  todayDayType: RotationDay | null;
  setTodayDayType: (label: RotationDay | null) => void;
};

const ScheduleConfigContext = createContext<ScheduleConfigContextValue | null>(null);

export function ScheduleConfigProvider({ children }: { children: React.ReactNode }) {
  const [scheduleArchitecture, setScheduleArchitectureState] = useState<ScheduleArchitecture>(
    DEFAULT_SCHEDULE_ARCHITECTURE,
  );
  const [selectedScheduleDay, setSelectedScheduleDayState] = useState<RotationDay | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedScheduleConfig;
        const architecture = normalizeScheduleArchitecture(parsed.architecture);
        setScheduleArchitectureState(architecture);

        const normalizedSelectedDay = normalizeScheduleDayLabel(parsed.selectedScheduleDay);
        if (
          architecture.type === "rotation" &&
          normalizedSelectedDay &&
          architecture.rotationLabels.includes(normalizedSelectedDay)
        ) {
          setSelectedScheduleDayState(normalizedSelectedDay);
        }
        return;
      }

      const legacyDay = normalizeScheduleDayLabel(localStorage.getItem(LEGACY_DAY_TYPE_KEY));
      if (legacyDay) {
        setScheduleArchitectureState({
          type: "rotation",
          rotationLabels: ["A", "B"],
        });
        setSelectedScheduleDayState(legacyDay);
      }
    } catch {
      // Silently ignore storage errors
    }
  }, []);

  const persist = (nextArchitecture: ScheduleArchitecture, nextSelectedDay: RotationDay | null) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          architecture: nextArchitecture,
          selectedScheduleDay: nextSelectedDay,
        } satisfies PersistedScheduleConfig),
      );

      if (nextSelectedDay === "A" || nextSelectedDay === "B") {
        localStorage.setItem(LEGACY_DAY_TYPE_KEY, nextSelectedDay);
      } else {
        localStorage.removeItem(LEGACY_DAY_TYPE_KEY);
      }
    } catch {
      // Silently ignore storage errors
    }
  };

  const setScheduleArchitecture = useCallback((architecture: ScheduleArchitecture) => {
    const normalizedArchitecture = normalizeScheduleArchitecture(architecture);
    const nextSelectedDay =
      normalizedArchitecture.type === "rotation" &&
      selectedScheduleDay &&
      normalizedArchitecture.rotationLabels.includes(selectedScheduleDay)
        ? selectedScheduleDay
        : null;

    setScheduleArchitectureState(normalizedArchitecture);
    setSelectedScheduleDayState(nextSelectedDay);
    persist(normalizedArchitecture, nextSelectedDay);
  }, [selectedScheduleDay]);

  const setSelectedScheduleDay = useCallback((label: RotationDay | null) => {
    const normalizedLabel = normalizeScheduleDayLabel(label);
    const nextSelectedDay =
      scheduleArchitecture.type === "rotation" &&
      normalizedLabel &&
      scheduleArchitecture.rotationLabels.includes(normalizedLabel)
        ? normalizedLabel
        : null;

    setSelectedScheduleDayState(nextSelectedDay);
    persist(scheduleArchitecture, nextSelectedDay);
  }, [scheduleArchitecture]);

  const value = useMemo<ScheduleConfigContextValue>(() => {
    const normalizedArchitecture = normalizeScheduleArchitecture(scheduleArchitecture);
    return {
      scheduleArchitecture: normalizedArchitecture,
      setScheduleArchitecture,
      selectedScheduleDay,
      setSelectedScheduleDay,
      rotationLabels: getRotationLabelsForArchitecture(normalizedArchitecture),
      isRotationSchedule: normalizedArchitecture.type === "rotation",
      todayDayType: selectedScheduleDay,
      setTodayDayType: setSelectedScheduleDay,
    };
  }, [
    scheduleArchitecture,
    selectedScheduleDay,
    setScheduleArchitecture,
    setSelectedScheduleDay,
  ]);

  return (
    <ScheduleConfigContext.Provider value={value}>
      {children}
    </ScheduleConfigContext.Provider>
  );
}

export function useScheduleConfig(): ScheduleConfigContextValue {
  const ctx = useContext(ScheduleConfigContext);
  if (!ctx) throw new Error("useScheduleConfig must be used inside ScheduleConfigProvider");
  return ctx;
}
