"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { SchoolCalendarEntry } from "../../types";

const STORAGE_KEY = "scc_calendar_v1";

type CalendarContextValue = {
  entries: SchoolCalendarEntry[];
  addEntry: (entry: Omit<SchoolCalendarEntry, "id">) => void;
  removeEntry: (id: string) => void;
  getEntryForDate: (dateStr: string) => SchoolCalendarEntry | undefined;
};

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarStoreProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<SchoolCalendarEntry[]>([]);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEntries(JSON.parse(raw) as SchoolCalendarEntry[]);
    } catch {
      // Silently ignore parse or storage errors
    }
  }, []);

  const persist = useCallback((next: SchoolCalendarEntry[]) => {
    setEntries(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Silently ignore storage errors
    }
  }, []);

  const addEntry = useCallback(
    (entry: Omit<SchoolCalendarEntry, "id">) => {
      const id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      const newEntry: SchoolCalendarEntry = { ...entry, id };
      // Replace any existing entry for the same date, then re-sort
      const next = [...entries.filter((e) => e.date !== entry.date), newEntry].sort(
        (a, b) => a.date.localeCompare(b.date)
      );
      persist(next);
    },
    [entries, persist]
  );

  const removeEntry = useCallback(
    (id: string) => {
      persist(entries.filter((e) => e.id !== id));
    },
    [entries, persist]
  );

  const getEntryForDate = useCallback(
    (dateStr: string): SchoolCalendarEntry | undefined => {
      return entries.find((e) => e.date === dateStr);
    },
    [entries]
  );

  return (
    <CalendarContext.Provider value={{ entries, addEntry, removeEntry, getEntryForDate }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar(): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error("useCalendar must be used inside CalendarStoreProvider");
  return ctx;
}
