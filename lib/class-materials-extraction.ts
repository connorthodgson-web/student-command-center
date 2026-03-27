import { PDFParse } from "pdf-parse";
import type { ClassMaterialExtractionStatus } from "../types";
import { normalizeExtractedText } from "./class-materials";

const TEXT_FILE_EXTENSIONS = [".txt", ".md", ".markdown"];

export type MaterialExtractionResult = {
  extractedText?: string;
  extractionStatus: ClassMaterialExtractionStatus;
  extractionError?: string;
};

export async function extractTextFromFile(params: {
  fileName?: string | null;
  mimeType?: string | null;
  bytes: Buffer;
}): Promise<MaterialExtractionResult> {
  const fileName = params.fileName?.toLowerCase() ?? "";
  const mimeType = params.mimeType?.toLowerCase() ?? "";

  if (isPlainTextFile(fileName, mimeType)) {
    return {
      extractedText: normalizeExtractedText(params.bytes.toString("utf-8")),
      extractionStatus: "completed",
    };
  }

  if (isPdfFile(fileName, mimeType)) {
    try {
      const parser = new PDFParse({ data: params.bytes });
      const result = await parser.getText();
      await parser.destroy();
      const extractedText = normalizeExtractedText(result.text);
      return extractedText
        ? { extractedText, extractionStatus: "completed" }
        : {
            extractionStatus: "failed",
            extractionError: "The PDF did not contain extractable text.",
          };
    } catch (error) {
      return {
        extractionStatus: "failed",
        extractionError:
          error instanceof Error ? error.message : "PDF extraction failed.",
      };
    }
  }

  return {
    extractionStatus: "not_supported",
    extractionError: "This file type is stored, but text extraction is not supported yet.",
  };
}

function isPlainTextFile(fileName: string, mimeType: string) {
  return (
    mimeType.startsWith("text/") ||
    TEXT_FILE_EXTENSIONS.some((extension) => fileName.endsWith(extension))
  );
}

function isPdfFile(fileName: string, mimeType: string) {
  return mimeType === "application/pdf" || fileName.endsWith(".pdf");
}
