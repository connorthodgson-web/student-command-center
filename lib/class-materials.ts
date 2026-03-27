import type {
  ClassMaterial,
  ClassMaterialExtractionStatus,
  ClassMaterialKind,
  SchoolClass,
} from "../types";

export const CLASS_MATERIALS_BUCKET = "class-materials";

const MATERIAL_KINDS: ClassMaterialKind[] = ["file", "note"];
const MATERIAL_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "about",
  "based",
  "class",
  "do",
  "for",
  "from",
  "help",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "notes",
  "of",
  "on",
  "say",
  "should",
  "tell",
  "that",
  "the",
  "this",
  "to",
  "what",
  "with",
]);

export type DbClassMaterialRow = {
  id: string;
  user_id: string;
  class_id: string;
  kind: ClassMaterialKind;
  title: string;
  file_name: string | null;
  mime_type: string | null;
  storage_path: string | null;
  raw_text: string | null;
  extracted_text: string | null;
  extraction_status: ClassMaterialExtractionStatus | null;
  extraction_error: string | null;
  created_at: string;
};

export type ClassMaterialInput = {
  classId?: string;
  kind?: ClassMaterialKind;
  title?: string;
  fileName?: string;
  mimeType?: string;
  storagePath?: string;
  rawText?: string;
  extractedText?: string;
  extractionStatus?: ClassMaterialExtractionStatus;
  extractionError?: string;
};

export type MaterialExcerpt = {
  materialId: string;
  materialTitle: string;
  classId: string;
  className: string;
  kind: ClassMaterialKind;
  excerpt: string;
  score: number;
};

export type MaterialRetrievalResult = {
  mentionedClass: SchoolClass | null;
  excerpts: MaterialExcerpt[];
  searchedMaterialCount: number;
  usableMaterialCount: number;
  reason:
    | "class_match"
    | "keyword_match"
    | "class_materials_without_text"
    | "no_materials"
    | "no_matches";
};

export function mapDbClassMaterial(row: DbClassMaterialRow): ClassMaterial {
  return {
    id: row.id,
    userId: row.user_id,
    classId: row.class_id,
    kind: row.kind,
    title: row.title,
    fileName: row.file_name ?? undefined,
    mimeType: row.mime_type ?? undefined,
    storagePath: row.storage_path ?? undefined,
    rawText: row.raw_text ?? undefined,
    extractedText: row.extracted_text ?? undefined,
    extractionStatus: row.extraction_status ?? undefined,
    extractionError: row.extraction_error ?? undefined,
    createdAt: row.created_at,
  };
}

export function normalizeClassMaterialInput(input: ClassMaterialInput) {
  const classId = input.classId?.trim();
  if (!classId) {
    throw new Error("classId is required.");
  }

  const kind = input.kind;
  if (!kind || !MATERIAL_KINDS.includes(kind)) {
    throw new Error("Material kind must be file or note.");
  }

  const title = input.title?.trim();
  if (!title) {
    throw new Error("Material title is required.");
  }

  const extractionStatus =
    input.extractionStatus ??
    (kind === "note"
      ? "not_needed"
      : input.extractedText?.trim()
        ? "completed"
        : "not_supported");

  const payload: Partial<Omit<DbClassMaterialRow, "id" | "user_id" | "created_at">> = {
    class_id: classId,
    kind,
    title,
    file_name: emptyToNull(input.fileName),
    mime_type: emptyToNull(input.mimeType),
    storage_path: emptyToNull(input.storagePath),
    raw_text: emptyToNull(input.rawText),
    extracted_text: emptyToNull(input.extractedText),
    extraction_status: extractionStatus,
    extraction_error: emptyToNull(input.extractionError),
  };

  if (kind === "file" && !payload.storage_path) {
    throw new Error("storagePath is required for uploaded files.");
  }

  if (kind === "note" && !payload.raw_text) {
    throw new Error("rawText is required for pasted notes.");
  }

  if (kind === "note" && !payload.extracted_text && payload.raw_text) {
    payload.extracted_text = payload.raw_text;
  }

  return payload;
}

export function retrieveRelevantMaterialExcerpts(params: {
  message: string;
  classes: SchoolClass[];
  maxExcerpts?: number;
}): MaterialRetrievalResult {
  const { message, classes } = params;
  const maxExcerpts = params.maxExcerpts ?? 3;
  const lowerMessage = message.toLowerCase();
  const mentionedClass = findMentionedClass(message, classes);
  const keywords = getMeaningfulKeywords(message, mentionedClass);

  const searchableMaterials = classes.flatMap((schoolClass) =>
    (schoolClass.materials ?? [])
      .map((material) => ({
        schoolClass,
        material,
        searchableText: buildSearchableText(material),
      }))
      .filter((entry) => entry.searchableText.length > 0),
  );

  if (classes.every((schoolClass) => (schoolClass.materials ?? []).length === 0)) {
    return {
      mentionedClass,
      excerpts: [],
      searchedMaterialCount: 0,
      usableMaterialCount: 0,
      reason: "no_materials",
    };
  }

  if (searchableMaterials.length === 0) {
    return {
      mentionedClass,
      excerpts: [],
      searchedMaterialCount: classes.reduce(
        (count, schoolClass) => count + (schoolClass.materials?.length ?? 0),
        0,
      ),
      usableMaterialCount: 0,
      reason: "class_materials_without_text",
    };
  }

  const scoredExcerpts = searchableMaterials
    .flatMap(({ schoolClass, material, searchableText }) =>
      splitMaterialIntoChunks(searchableText).map((chunk) => ({
        schoolClass,
        material,
        chunk,
        score: scoreExcerpt({
          chunk,
          lowerMessage,
          keywords,
          material,
          schoolClass,
          mentionedClass,
        }),
      })),
    )
    .filter((entry) => entry.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, maxExcerpts)
    .map((entry) => ({
      materialId: entry.material.id,
      materialTitle: entry.material.title,
      classId: entry.schoolClass.id,
      className: entry.schoolClass.name,
      kind: entry.material.kind,
      excerpt: entry.chunk,
      score: entry.score,
    }));

  return {
    mentionedClass,
    excerpts: scoredExcerpts,
    searchedMaterialCount: searchableMaterials.length,
    usableMaterialCount: searchableMaterials.length,
    reason:
      scoredExcerpts.length > 0
        ? mentionedClass
          ? "class_match"
          : "keyword_match"
        : "no_matches",
  };
}

export function formatMaterialRetrievalForPrompt(result: MaterialRetrievalResult) {
  if (result.excerpts.length === 0) {
    switch (result.reason) {
      case "no_materials":
        return "No saved class materials were found for this student.";
      case "class_materials_without_text":
        return "The student has saved class materials, but none currently have usable extracted text.";
      case "no_matches":
        return "No relevant class material excerpts matched this request.";
      default:
        return "No relevant class material excerpts were retrieved.";
    }
  }

  const classLine = result.mentionedClass
    ? `Mentioned class: ${result.mentionedClass.name}`
    : "Mentioned class: none detected";

  const excerptLines = result.excerpts.map(
    (excerpt, index) =>
      `${index + 1}. [${excerpt.className}] ${excerpt.materialTitle} (${excerpt.kind})\n"${excerpt.excerpt}"`,
  );

  return `${classLine}\nRetrieved excerpts:\n${excerptLines.join("\n")}`;
}

export function hasUsableMaterialText(material: ClassMaterial) {
  return Boolean(buildSearchableText(material));
}

function buildSearchableText(material: ClassMaterial) {
  return normalizeExtractedText(material.extractedText ?? material.rawText ?? "");
}

function splitMaterialIntoChunks(text: string) {
  const paragraphs = text
    .split(/\n\s*\n/g)
    .map((part) => normalizeExtractedText(part))
    .filter(Boolean);

  if (paragraphs.length > 0) {
    return paragraphs.flatMap((paragraph) => sliceLongChunk(paragraph, 320));
  }

  return sliceLongChunk(text, 320);
}

function sliceLongChunk(text: string, maxLength: number) {
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const next = text.slice(cursor, cursor + maxLength).trim();
    if (next) chunks.push(next);
    cursor += maxLength;
  }

  return chunks;
}

function scoreExcerpt(params: {
  chunk: string;
  lowerMessage: string;
  keywords: string[];
  material: ClassMaterial;
  schoolClass: SchoolClass;
  mentionedClass: SchoolClass | null;
}) {
  const chunkLower = params.chunk.toLowerCase();
  const titleLower = params.material.title.toLowerCase();
  let score = 0;

  if (params.mentionedClass?.id === params.schoolClass.id) {
    score += 6;
  }

  for (const keyword of params.keywords) {
    if (chunkLower.includes(keyword)) score += 4;
    if (titleLower.includes(keyword)) score += 2;
  }

  if (!params.mentionedClass && params.lowerMessage.includes(params.schoolClass.name.toLowerCase())) {
    score += 5;
  }

  if (params.material.kind === "note") {
    score += 1;
  }

  return score;
}

function findMentionedClass(message: string, classes: SchoolClass[]) {
  const lowerMessage = message.toLowerCase();
  return [...classes]
    .sort((first, second) => second.name.length - first.name.length)
    .find((schoolClass) => lowerMessage.includes(schoolClass.name.toLowerCase())) ?? null;
}

function getMeaningfulKeywords(message: string, mentionedClass: SchoolClass | null) {
  const classTokens = new Set(
    (mentionedClass?.name.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(Boolean),
  );

  return Array.from(
    new Set(
      (message.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
        (token) => token.length > 2 && !MATERIAL_STOPWORDS.has(token) && !classTokens.has(token),
      ),
    ),
  );
}

export function normalizeExtractedText(value: string) {
  return value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function emptyToNull(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
