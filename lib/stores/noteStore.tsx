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
import type { StudentNote } from "../../types";

type NoteCreateInput = {
  content: string;
  title?: string | null;
  classId?: string | null;
};

type NoteUpdateInput = Partial<NoteCreateInput>;

type NoteStoreContextValue = {
  notes: StudentNote[];
  loading: boolean;
  reloadNotes: () => Promise<void>;
  addNote: (note: NoteCreateInput) => Promise<StudentNote>;
  updateNote: (noteId: string, updates: NoteUpdateInput) => Promise<StudentNote>;
  deleteNote: (noteId: string) => Promise<void>;
};

const NoteStoreContext = createContext<NoteStoreContextValue | null>(null);

export function NoteStoreProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotes = useCallback(async () => {
    if (!user) {
      setNotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/notes", { cache: "no-store" });
      const json = (await response.json()) as { data?: StudentNote[]; error?: string };

      if (!response.ok) {
        throw new Error(json.error ?? "Failed to load notes.");
      }

      setNotes(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void loadNotes();
  }, [authLoading, loadNotes]);

  const addNote = useCallback(async (note: NoteCreateInput) => {
    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const json = (await response.json()) as { data?: StudentNote; error?: string };

    if (!response.ok || !json.data) {
      throw new Error(json.error ?? "Failed to save note.");
    }

    setNotes((prev) => [json.data as StudentNote, ...prev]);
    return json.data;
  }, []);

  const updateNote = useCallback(async (noteId: string, updates: NoteUpdateInput) => {
    const response = await fetch("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: noteId, updates }),
    });
    const json = (await response.json()) as { data?: StudentNote; error?: string };

    if (!response.ok || !json.data) {
      throw new Error(json.error ?? "Failed to update note.");
    }

    setNotes((prev) => prev.map((note) => (note.id === noteId ? json.data! : note)));
    return json.data;
  }, []);

  const deleteNote = useCallback(async (noteId: string) => {
    const response = await fetch("/api/notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: noteId }),
    });
    const json = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(json.error ?? "Failed to delete note.");
    }

    setNotes((prev) => prev.filter((note) => note.id !== noteId));
  }, []);

  const value = useMemo(
    () => ({ notes, loading, reloadNotes: loadNotes, addNote, updateNote, deleteNote }),
    [notes, loading, loadNotes, addNote, updateNote, deleteNote],
  );

  return <NoteStoreContext.Provider value={value}>{children}</NoteStoreContext.Provider>;
}

export function useNotes(): NoteStoreContextValue {
  const ctx = useContext(NoteStoreContext);
  if (!ctx) {
    throw new Error("useNotes must be used inside NoteStoreProvider");
  }
  return ctx;
}
