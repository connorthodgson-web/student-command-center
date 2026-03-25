"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "../auth-context";
import type { ClassInsert, ClassUpdate } from "../classes";
import type { SchoolClass } from "../../types";

type ClassStoreContextValue = {
  classes: SchoolClass[];
  loading: boolean;
  addClass: (schoolClass: ClassInsert) => Promise<void>;
  addClasses: (schoolClasses: ClassInsert[]) => Promise<void>;
  updateClass: (id: string, updates: ClassUpdate) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
};

const ClassStoreContext = createContext<ClassStoreContextValue | null>(null);

export function ClassStoreProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);

  const loadClasses = useCallback(async () => {
    if (!user) {
      setClasses([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/classes", { cache: "no-store" });
      const json = (await response.json()) as { data?: SchoolClass[]; error?: string };

      if (!response.ok) {
        throw new Error(json.error ?? "Failed to load classes.");
      }

      setClasses(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void loadClasses();
  }, [authLoading, loadClasses]);

  const addClass = useCallback(async (schoolClass: ClassInsert) => {
    const response = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classes: [schoolClass] }),
    });
    const json = (await response.json()) as { data?: SchoolClass[]; error?: string };

    if (!response.ok) {
      throw new Error(json.error ?? "Failed to save class.");
    }

    const createdClass = json.data?.[0];
    if (createdClass) {
      setClasses((prev) => [...prev, createdClass]);
    }
  }, []);

  const addClasses = useCallback(async (schoolClasses: ClassInsert[]) => {
    const response = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classes: schoolClasses }),
    });
    const json = (await response.json()) as { data?: SchoolClass[]; error?: string };

    if (!response.ok) {
      throw new Error(json.error ?? "Failed to save classes.");
    }

    const createdClasses = json.data ?? [];
    if (createdClasses.length > 0) {
      setClasses((prev) => [...prev, ...createdClasses]);
    }
  }, []);

  const updateClass = useCallback(async (id: string, updates: ClassUpdate) => {
    const response = await fetch("/api/classes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, updates }),
    });
    const json = (await response.json()) as { data?: SchoolClass; error?: string };

    if (!response.ok || !json.data) {
      throw new Error(json.error ?? "Failed to update class.");
    }

    const updatedClass = json.data;
    setClasses((prev) => prev.map((c) => (c.id === id ? updatedClass : c)));
  }, []);

  const deleteClass = useCallback(async (id: string) => {
    const response = await fetch("/api/classes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(json.error ?? "Failed to delete class.");
    }

    setClasses((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const value = useMemo(
    () => ({ classes, loading, addClass, addClasses, updateClass, deleteClass }),
    [classes, loading, addClass, addClasses, updateClass, deleteClass]
  );

  return (
    <ClassStoreContext.Provider value={value}>
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
