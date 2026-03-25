"use client";

// TODO: Replace this in-memory store with Supabase-backed persistence once auth is wired up.
// TODO: Replace with Supabase-backed class persistence in a future sprint.

import { createContext, useContext, useState } from "react";
import { mockClasses } from "../mock-data";
import type { SchoolClass } from "../../types";

type ClassStoreContextValue = {
  classes: SchoolClass[];
  addClass: (schoolClass: Omit<SchoolClass, "id">) => void;
  addClasses: (schoolClasses: Omit<SchoolClass, "id">[]) => void;
  updateClass: (id: string, updates: Partial<SchoolClass>) => void;
  deleteClass: (id: string) => void;
};

const ClassStoreContext = createContext<ClassStoreContextValue | null>(null);

export function ClassStoreProvider({ children }: { children: React.ReactNode }) {
  // Initialize with mockClasses so existing class data is visible immediately
  const [classes, setClasses] = useState<SchoolClass[]>(mockClasses);

  const addClass = (schoolClass: Omit<SchoolClass, "id">) => {
    const newClass: SchoolClass = {
      ...schoolClass,
      id: crypto.randomUUID(),
    };
    setClasses((prev) => [...prev, newClass]);
  };

  const addClasses = (schoolClasses: Omit<SchoolClass, "id">[]) => {
    const withIds = schoolClasses.map((c) => ({ ...c, id: crypto.randomUUID() }));
    setClasses((prev) => [...prev, ...withIds]);
  };

  const updateClass = (id: string, updates: Partial<SchoolClass>) => {
    setClasses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const deleteClass = (id: string) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <ClassStoreContext.Provider value={{ classes, addClass, addClasses, updateClass, deleteClass }}>
      {children}
    </ClassStoreContext.Provider>
  );
}

export function useClasses(): ClassStoreContextValue {
  const ctx = useContext(ClassStoreContext);
  if (!ctx) {
    throw new Error("useClasses must be used inside ClassStoreProvider");
  }
  return ctx;
}
