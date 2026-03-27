import OpenAI from "openai";
import type {
  AssistantAttachmentAnalysisStatus,
  AssistantAttachmentProcessingStatus,
} from "../types";
import { extractTextFromFile } from "./class-materials-extraction";
import { normalizeExtractedText } from "./class-materials";

const client = new OpenAI();

type AssistantAttachmentProcessingResult = {
  extractedText?: string;
  extractionError?: string;
  processingStatus: AssistantAttachmentProcessingStatus;
  analysisStatus: AssistantAttachmentAnalysisStatus;
};

export async function processAssistantAttachment(params: {
  fileName?: string | null;
  mimeType?: string | null;
  bytes: Buffer;
}): Promise<AssistantAttachmentProcessingResult> {
  const fileName = params.fileName?.toLowerCase() ?? "";
  const mimeType = params.mimeType?.toLowerCase() ?? "";

  if (isTextLikeOrPdf(fileName, mimeType)) {
    const result = await extractTextFromFile({
      fileName,
      mimeType,
      bytes: params.bytes,
    });

    if (result.extractionStatus === "completed") {
      return {
        extractedText: result.extractedText,
        processingStatus: "completed",
        analysisStatus: "completed",
      };
    }

    if (result.extractionStatus === "failed") {
      return {
        extractionError: result.extractionError,
        processingStatus: "failed",
        analysisStatus: "failed",
      };
    }

    return {
      extractionError: result.extractionError,
      processingStatus: "completed",
      analysisStatus: "not_requested",
    };
  }

  if (mimeType.startsWith("image/")) {
    return extractTextFromImage({
      fileName,
      mimeType,
      bytes: params.bytes,
    });
  }

  return {
    extractionError: "This file is stored for assistant use, but text extraction is not supported yet.",
    processingStatus: "completed",
    analysisStatus: "not_requested",
  };
}

async function extractTextFromImage(params: {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<AssistantAttachmentProcessingResult> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      extractionError:
        "Image text extraction is not configured yet. The file is still saved and can be used later.",
      processingStatus: "completed",
      analysisStatus: "not_requested",
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content:
            "You are extracting useful study help context from a student's uploaded image. Read visible text faithfully. If there is a worksheet, assignment, schedule, or handwritten note, capture the readable text first, then add 1-3 short factual notes about layout or structure only when helpful. Keep it concise and plain text. Do not solve the problem.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the readable text and any short factual notes that would help a later academic assistant understand this upload.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${params.mimeType || "image/jpeg"};base64,${params.bytes.toString("base64")}`,
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0].message.content?.trim();
    if (!content) {
      return {
        extractionError: "No readable text or useful visual detail was returned for this image.",
        processingStatus: "failed",
        analysisStatus: "failed",
      };
    }

    return {
      extractedText: normalizeExtractedText(content),
      processingStatus: "completed",
      analysisStatus: "completed",
    };
  } catch (error) {
    return {
      extractionError:
        error instanceof Error
          ? error.message
          : "Image text extraction failed.",
      processingStatus: "failed",
      analysisStatus: "failed",
    };
  }
}

function isTextLikeOrPdf(fileName: string, mimeType: string) {
  return (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    fileName.endsWith(".pdf") ||
    fileName.endsWith(".txt") ||
    fileName.endsWith(".md") ||
    fileName.endsWith(".markdown")
  );
}
