import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssistantAttachment,
  AssistantAttachmentAnalysisStatus,
  AssistantAttachmentProcessingStatus,
  AssistantAttachmentType,
} from "../types";

export const ASSISTANT_ATTACHMENTS_BUCKET = "assistant-attachments";
export const MAX_ASSISTANT_ATTACHMENT_BYTES = 8 * 1024 * 1024;

const ATTACHMENT_TYPES: AssistantAttachmentType[] = ["image", "file", "audio", "document"];
const ANALYSIS_STATUSES: AssistantAttachmentAnalysisStatus[] = [
  "pending",
  "completed",
  "failed",
  "not_requested",
];
const PROCESSING_STATUSES: AssistantAttachmentProcessingStatus[] = [
  "uploaded",
  "processing",
  "completed",
  "failed",
];

export type DbAssistantAttachmentRow = {
  id: string;
  user_id: string;
  session_id: string | null;
  message_id: string | null;
  class_id: string | null;
  task_id: string | null;
  attachment_type: AssistantAttachmentType;
  title: string;
  file_name: string | null;
  mime_type: string | null;
  storage_path: string;
  file_size_bytes: number | null;
  extracted_text: string | null;
  extraction_error: string | null;
  processing_status: AssistantAttachmentProcessingStatus;
  analysis_status: AssistantAttachmentAnalysisStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
};

export type AssistantAttachmentInput = {
  sessionId?: string;
  messageId?: string;
  classId?: string;
  taskId?: string;
  attachmentType?: AssistantAttachmentType;
  title?: string;
  fileName?: string;
  mimeType?: string;
  storagePath?: string;
  fileSizeBytes?: number;
  extractedText?: string;
  extractionError?: string;
  processingStatus?: AssistantAttachmentProcessingStatus;
  analysisStatus?: AssistantAttachmentAnalysisStatus;
  metadata?: Record<string, unknown>;
};

export type AssistantAttachmentMultimodalReference = {
  attachmentId: string;
  attachmentType: AssistantAttachmentType;
  fileName?: string;
  mimeType?: string;
  storagePath: string;
  extractedText?: string;
  dataUrl: string;
};

export function mapDbAssistantAttachment(row: DbAssistantAttachmentRow): AssistantAttachment {
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id ?? undefined,
    messageId: row.message_id ?? undefined,
    classId: row.class_id ?? undefined,
    taskId: row.task_id ?? undefined,
    attachmentType: row.attachment_type,
    title: row.title,
    fileName: row.file_name ?? undefined,
    mimeType: row.mime_type ?? undefined,
    storagePath: row.storage_path,
    fileSizeBytes: row.file_size_bytes ?? undefined,
    extractedText: row.extracted_text ?? undefined,
    extractionError: row.extraction_error ?? undefined,
    processingStatus: row.processing_status,
    analysisStatus: row.analysis_status,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

export function normalizeAssistantAttachmentInput(input: AssistantAttachmentInput) {
  const attachmentType = input.attachmentType;
  if (!attachmentType || !ATTACHMENT_TYPES.includes(attachmentType)) {
    throw new Error("attachmentType must be image, file, audio, or document.");
  }

  const title = input.title?.trim();
  if (!title) {
    throw new Error("Attachment title is required.");
  }

  const storagePath = input.storagePath?.trim();
  if (!storagePath) {
    throw new Error("storagePath is required.");
  }

  const analysisStatus = input.analysisStatus ?? "pending";
  if (!ANALYSIS_STATUSES.includes(analysisStatus)) {
    throw new Error("analysisStatus is invalid.");
  }

  const processingStatus = input.processingStatus ?? "uploaded";
  if (!PROCESSING_STATUSES.includes(processingStatus)) {
    throw new Error("processingStatus is invalid.");
  }

  if (input.fileSizeBytes !== undefined && input.fileSizeBytes < 0) {
    throw new Error("fileSizeBytes must be a positive number.");
  }

  return {
    session_id: emptyToNull(input.sessionId),
    message_id: emptyToNull(input.messageId),
    class_id: emptyToNull(input.classId),
    task_id: emptyToNull(input.taskId),
    attachment_type: attachmentType,
    title,
    file_name: emptyToNull(input.fileName),
    mime_type: emptyToNull(input.mimeType),
    storage_path: storagePath,
    file_size_bytes: input.fileSizeBytes ?? null,
    extracted_text: emptyToNull(input.extractedText),
    extraction_error: emptyToNull(input.extractionError),
    processing_status: processingStatus,
    analysis_status: analysisStatus,
    metadata: input.metadata ?? {},
  };
}

export function inferAssistantAttachmentType(params: {
  fileName?: string | null;
  mimeType?: string | null;
}): AssistantAttachmentType {
  const fileName = params.fileName?.toLowerCase() ?? "";
  const mimeType = params.mimeType?.toLowerCase() ?? "";

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    fileName.endsWith(".pdf") ||
    fileName.endsWith(".txt") ||
    fileName.endsWith(".md") ||
    fileName.endsWith(".markdown")
  ) {
    return "document";
  }

  return "file";
}

export function buildAssistantAttachmentStoragePath(userId: string, fileName: string) {
  const safeName = fileName
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "upload";

  return `${userId}/${Date.now()}-${safeName}`;
}

export function formatAttachmentContextForPrompt(attachments: AssistantAttachment[]) {
  if (attachments.length === 0) {
    return "No session attachments were included with this request.";
  }

  return attachments
    .map((attachment, index) => {
      const parts = [
        `${index + 1}. ${attachment.title} [${attachment.attachmentType}]`,
        attachment.fileName ? `file=${attachment.fileName}` : null,
        attachment.mimeType ? `mime=${attachment.mimeType}` : null,
        attachment.classId ? `classId=${attachment.classId}` : null,
        attachment.taskId ? `taskId=${attachment.taskId}` : null,
        `processing=${attachment.processingStatus}`,
        `analysis=${attachment.analysisStatus}`,
      ].filter(Boolean);

      const notes: string[] = [];
      if (attachment.extractedText?.trim()) {
        notes.push(`Extracted text:\n${attachment.extractedText.trim()}`);
      } else if (attachment.analysisStatus === "not_requested") {
        notes.push("No extracted text is available for this file type yet.");
      } else if (attachment.analysisStatus === "failed") {
        notes.push(
          attachment.extractionError?.trim()
            ? `Extraction failed: ${attachment.extractionError.trim()}`
            : "Extraction failed for this attachment.",
        );
      }

      return [parts.join(", "), ...notes].join("\n");
    })
    .join("\n\n");
}

export async function loadAssistantAttachmentsForRequest(
  supabase: SupabaseClient,
  userId: string,
  options: {
    attachmentIds?: string[];
    sessionId?: string;
  },
) {
  if ((options.attachmentIds?.length ?? 0) > 0) {
    const { data, error } = await supabase
      .from("assistant_attachments")
      .select("*")
      .eq("user_id", userId)
      .in("id", options.attachmentIds ?? [])
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return ((data ?? []) as DbAssistantAttachmentRow[]).map(mapDbAssistantAttachment);
  }

  if (!options.sessionId) {
    return [];
  }

  const { data, error } = await supabase
    .from("assistant_attachments")
    .select("*")
    .eq("user_id", userId)
    .eq("session_id", options.sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DbAssistantAttachmentRow[]).map(mapDbAssistantAttachment);
}

export async function getAssistantAttachmentById(
  supabase: SupabaseClient,
  userId: string,
  attachmentId: string,
) {
  const { data, error } = await supabase
    .from("assistant_attachments")
    .select("*")
    .eq("id", attachmentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapDbAssistantAttachment(data as DbAssistantAttachmentRow) : null;
}

export async function downloadAssistantAttachmentBytes(
  supabase: SupabaseClient,
  attachment: Pick<AssistantAttachment, "storagePath">,
) {
  const { data, error } = await supabase.storage
    .from(ASSISTANT_ATTACHMENTS_BUCKET)
    .download(attachment.storagePath);

  if (error) {
    throw new Error(error.message);
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function buildAssistantMultimodalReferences(
  supabase: SupabaseClient,
  attachments: AssistantAttachment[],
) {
  const references: AssistantAttachmentMultimodalReference[] = [];

  for (const attachment of attachments) {
    const mimeType = attachment.mimeType ?? "application/octet-stream";
    const bytes = await downloadAssistantAttachmentBytes(supabase, attachment);
    references.push({
      attachmentId: attachment.id,
      attachmentType: attachment.attachmentType,
      fileName: attachment.fileName,
      mimeType,
      storagePath: attachment.storagePath,
      extractedText: attachment.extractedText,
      dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
    });
  }

  return references;
}

function emptyToNull(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
