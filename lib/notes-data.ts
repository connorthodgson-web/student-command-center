import type { StudentNote } from "../types";

export type DbNoteRow = {
  id: string;
  user_id: string;
  content: string;
  title: string | null;
  class_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NoteMutationInput = {
  content?: string;
  title?: string | null;
  classId?: string | null;
};

export function mapDbNoteToStudentNote(row: DbNoteRow): StudentNote {
  return {
    id: row.id,
    userId: row.user_id,
    content: row.content,
    title: row.title ?? undefined,
    classId: row.class_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeNoteInput(
  input: NoteMutationInput,
  options: { requireContent?: boolean } = {},
) {
  const content = input.content?.trim();

  if (options.requireContent && !content) {
    throw new Error("Note content is required.");
  }

  const payload: Partial<Omit<DbNoteRow, "id" | "user_id" | "created_at" | "updated_at">> = {};

  if ("content" in input) {
    if (!content) {
      throw new Error("Note content cannot be empty.");
    }
    payload.content = content;
  }

  if ("title" in input) {
    payload.title = normalizeOptionalString(input.title);
  }

  if ("classId" in input) {
    payload.class_id = normalizeOptionalString(input.classId);
  }

  return payload;
}

export function matchNote(
  notes: StudentNote[],
  params: { noteId?: string; noteTitle?: string; noteContent?: string },
): { match: StudentNote | null; ambiguous: boolean; candidates: StudentNote[] } {
  if (params.noteId) {
    const byId = notes.find((note) => note.id === params.noteId);
    if (byId) return { match: byId, ambiguous: false, candidates: [byId] };
  }

  const needles = [params.noteTitle, params.noteContent]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));

  if (needles.length === 0) {
    return { match: null, ambiguous: false, candidates: [] };
  }

  const exactMatches = notes.filter((note) =>
    needles.some(
      (needle) =>
        note.title?.trim().toLowerCase() === needle || note.content.trim().toLowerCase() === needle,
    ),
  );
  if (exactMatches.length === 1) {
    return { match: exactMatches[0], ambiguous: false, candidates: exactMatches };
  }
  if (exactMatches.length > 1) {
    return { match: null, ambiguous: true, candidates: exactMatches };
  }

  const partialMatches = notes.filter((note) =>
    needles.some((needle) => {
      const title = note.title?.toLowerCase() ?? "";
      const content = note.content.toLowerCase();
      return (
        title.includes(needle) ||
        content.includes(needle) ||
        needle.includes(title) ||
        needle.includes(content)
      );
    }),
  );

  if (partialMatches.length === 1) {
    return { match: partialMatches[0], ambiguous: false, candidates: partialMatches };
  }

  if (partialMatches.length > 1) {
    return { match: null, ambiguous: true, candidates: partialMatches };
  }

  return { match: null, ambiguous: false, candidates: [] };
}

function normalizeOptionalString(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
