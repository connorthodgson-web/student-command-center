"use client";

import { createContext, useContext, useState } from "react";

export type DayType = "A" | "B" | null;

type ScheduleConfigContextValue = {
  /** Whether today is an A-day, B-day, or not set (null = standard/unknown). */
  todayDayType: DayType;
  setTodayDayType: (type: DayType) => void;
};

const ScheduleConfigContext = createContext<ScheduleConfigContextValue | null>(null);

export function ScheduleConfigProvider({ children }: { children: React.ReactNode }) {
  const [todayDayType, setTodayDayType] = useState<DayType>(null);

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
