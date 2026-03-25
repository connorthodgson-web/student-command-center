"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type DayType = "A" | "B" | null;

const STORAGE_KEY = "scc_day_type_v1";

type ScheduleConfigContextValue = {
  /** Whether today is an A-day, B-day, or not set (null = standard/unknown). */
  todayDayType: DayType;
  setTodayDayType: (type: DayType) => void;
};

const ScheduleConfigContext = createContext<ScheduleConfigContextValue | null>(null);

export function ScheduleConfigProvider({ children }: { children: React.ReactNode }) {
  const [todayDayType, setTodayDayTypeState] = useState<DayType>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "A" || stored === "B") {
        setTodayDayTypeState(stored);
      }
    } catch {
      // Silently ignore storage errors
    }
  }, []);

  const setTodayDayType = (type: DayType) => {
    setTodayDayTypeState(type);
    try {
      if (type === null) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, type);
      }
    } catch {
      // Silently ignore storage errors
    }
  };

  return (
    <ScheduleConfigContext.Provider value={{ todayDayType, setTodayDayType }}>
      {children}
    </ScheduleConfigContext.Provider>
  );
}

export function useScheduleConfig(): ScheduleConfigContextValue {
  const ctx = useContext(ScheduleConfigContext);
  if (!ctx) throw new Error("useScheduleConfig must be used inside ScheduleConfigProvider");
  return ctx;
}
