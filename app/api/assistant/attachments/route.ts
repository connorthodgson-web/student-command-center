import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ASSISTANT_ATTACHMENTS_BUCKET,
  MAX_ASSISTANT_ATTACHMENT_BYTES,
  buildAssistantAttachmentStoragePath,
  getAssistantAttachmentById,
  inferAssistantAttachmentType,
  mapDbAssistantAttachment,
  normalizeAssistantAttachmentInput,
  type AssistantAttachmentInput,
  type DbAssistantAttachmentRow,
} from "../../../../lib/assistant-attachments";
import { processAssistantAttachment } from "../../../../lib/assistant-attachments-processing";
import { appendAssistantSessionEvent } from "../../../../lib/assistant-sessions";
import { getAuthedSupabase } from "../../../../lib/supabase/route-auth";

export const runtime = "nodejs";

type CreateAssistantAttachmentRequest = {
  attachment?: AssistantAttachmentInput;
};

type DeleteAssistantAttachmentRequest = {
  id?: string;
};

export async function GET(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const sessionId = url.searchParams.get("sessionId");
  const messageId = url.searchParams.get("messageId");
  const classId = url.searchParams.get("classId");
  const taskId = url.searchParams.get("taskId");

  if (id) {
    try {
      const attachment = await getAssistantAttachmentById(auth.supabase, auth.userId, id);
      if (!attachment) {
        return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
      }

      return NextResponse.json({ data: attachment });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load attachment.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  let query = auth.supabase
    .from("assistant_attachments")
    .select("*")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }
  if (messageId) {
    query = query.eq("message_id", messageId);
  }
  if (classId) {
    query = query.eq("class_id", classId);
  }
  if (taskId) {
    query = query.eq("task_id", taskId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: ((data ?? []) as DbAssistantAttachmentRow[]).map(mapDbAssistantAttachment),
  });
}

export async function POST(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    return handleMultipartUpload(request, auth.supabase, auth.userId);
  }

  const body = (await request.json()) as CreateAssistantAttachmentRequest;
  if (!body.attachment) {
    return NextResponse.json({ error: "Attachment payload is required." }, { status: 400 });
  }

  try {
    await validateAttachmentRelations(auth.supabase, auth.userId, {
      classId: body.attachment.classId,
      taskId: body.attachment.taskId,
      sessionId: body.attachment.sessionId,
      messageId: body.attachment.messageId,
    });

    const payload = normalizeAssistantAttachmentInput(body.attachment);
    const { data, error } = await auth.supabase
      .from("assistant_attachments")
      .insert({
        user_id: auth.userId,
        ...payload,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const attachment = mapDbAssistantAttachment(data as DbAssistantAttachmentRow);
    await logAttachmentEventIfNeeded(auth.supabase, auth.userId, attachment);

    return NextResponse.json({ data: attachment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid attachment payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as DeleteAssistantAttachmentRequest;
  if (!body.id) {
    return NextResponse.json({ error: "Attachment id is required." }, { status: 400 });
  }

  const { data: attachment, error: loadError } = await auth.supabase
    .from("assistant_attachments")
    .select("*")
    .eq("id", body.id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (loadError || !attachment) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  const { error } = await auth.supabase
    .from("assistant_attachments")
    .delete()
    .eq("id", body.id)
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = attachment as DbAssistantAttachmentRow;
  if (row.storage_path) {
    await auth.supabase.storage
      .from(ASSISTANT_ATTACHMENTS_BUCKET)
      .remove([row.storage_path]);
  }

  return NextResponse.json({ success: true });
}

async function handleMultipartUpload(
  request: Request,
  supabase: SupabaseClient,
  userId: string,
) {
  try {
    const formData = await request.formData();
    const upload = formData.get("file");
    if (!(upload instanceof File)) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }

    const bytes = Buffer.from(await upload.arrayBuffer());
    if (bytes.length === 0) {
      return NextResponse.json({ error: "The uploaded file was empty." }, { status: 400 });
    }

    if (bytes.length > MAX_ASSISTANT_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: "Assistant attachments must be 8 MB or smaller for now." },
        { status: 400 },
      );
    }

    const fileName = upload.name || "upload";
    const mimeType = upload.type || "application/octet-stream";
    const title = parseOptionalString(formData.get("title")) ?? fileName;
    const classId = parseOptionalString(formData.get("classId")) ?? undefined;
    const taskId = parseOptionalString(formData.get("taskId")) ?? undefined;
    const sessionId = parseOptionalString(formData.get("sessionId")) ?? undefined;
    const messageId = parseOptionalString(formData.get("messageId")) ?? undefined;
    const metadata = parseMetadataField(formData.get("metadata"));
    const attachmentType =
      (parseOptionalString(formData.get("attachmentType")) as AssistantAttachmentInput["attachmentType"] | null)
      ?? inferAssistantAttachmentType({ fileName, mimeType });

    await validateAttachmentRelations(supabase, userId, {
      classId,
      taskId,
      sessionId,
      messageId,
    });

    const storagePath = buildAssistantAttachmentStoragePath(userId, fileName);
    const { error: uploadError } = await supabase.storage
      .from(ASSISTANT_ATTACHMENTS_BUCKET)
      .upload(storagePath, bytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const processing = await processAssistantAttachment({
      fileName,
      mimeType,
      bytes,
    });

    const payload = normalizeAssistantAttachmentInput({
      sessionId,
      messageId,
      classId,
      taskId,
      attachmentType,
      title,
      fileName,
      mimeType,
      storagePath,
      fileSizeBytes: bytes.length,
      extractedText: processing.extractedText,
      extractionError: processing.extractionError,
      processingStatus: processing.processingStatus,
      analysisStatus: processing.analysisStatus,
      metadata: {
        ...metadata,
        uploadSource: "multipart_form",
      },
    });

    const { data, error } = await supabase
      .from("assistant_attachments")
      .insert({
        user_id: userId,
        ...payload,
      })
      .select("*")
      .single();

    if (error) {
      await supabase.storage.from(ASSISTANT_ATTACHMENTS_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const attachment = mapDbAssistantAttachment(data as DbAssistantAttachmentRow);
    await logAttachmentEventIfNeeded(supabase, userId, attachment);

    return NextResponse.json(
      {
        data: attachment,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to process that upload. The file was not attached.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function validateAttachmentRelations(
  supabase: SupabaseClient,
  userId: string,
  input: {
    classId?: string;
    taskId?: string;
    sessionId?: string;
    messageId?: string;
  },
) {
  if (input.classId) {
    const { data, error } = await supabase
      .from("classes")
      .select("id")
      .eq("id", input.classId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      throw new Error("That class does not belong to this user.");
    }
  }

  if (input.taskId) {
    const { data, error } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", input.taskId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      throw new Error("That task does not belong to this user.");
    }
  }

  if (input.sessionId) {
    const { data, error } = await supabase
      .from("assistant_sessions")
      .select("id")
      .eq("id", input.sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      throw new Error("That assistant session does not belong to this user.");
    }
  }

  if (input.messageId) {
    const { data, error } = await supabase
      .from("assistant_session_messages")
      .select("id, session_id")
      .eq("id", input.messageId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      throw new Error("That assistant message does not belong to this user.");
    }

    if (input.sessionId && data.session_id !== input.sessionId) {
      throw new Error("messageId does not belong to the provided sessionId.");
    }
  }
}

async function logAttachmentEventIfNeeded(
  supabase: SupabaseClient,
  userId: string,
  attachment: ReturnType<typeof mapDbAssistantAttachment>,
) {
  if (!attachment.sessionId) return;

  await appendAssistantSessionEvent(supabase, {
    sessionId: attachment.sessionId,
    userId,
    eventType: "attachment_added",
    metadata: {
      attachmentId: attachment.id,
      attachmentType: attachment.attachmentType,
      classId: attachment.classId,
      taskId: attachment.taskId,
      processingStatus: attachment.processingStatus,
      analysisStatus: attachment.analysisStatus,
    },
  });
}

function parseOptionalString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseMetadataField(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return { raw: value.trim() };
  }
}
