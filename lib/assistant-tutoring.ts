import type {
  AssistantAttachment,
  ClassMaterial,
  SchoolClass,
  StudentTask,
  TutoringContext,
  TutoringMode,
} from "../types";
import {
  hasUsableMaterialText,
  normalizeExtractedText,
  retrieveRelevantMaterialExcerpts,
} from "./class-materials";

type TutoringPromptPolicy = {
  label: string;
  instructions: string[];
};

const TUTORING_MODE_POLICIES: Record<TutoringMode, TutoringPromptPolicy> = {
  explain: {
    label: "Explain",
    instructions: [
      "Explain concepts clearly in beginner-friendly language.",
      "Use the student's class materials and notes before general knowledge when available.",
      "Prefer short examples over long lectures.",
    ],
  },
  step_by_step: {
    label: "Step by Step",
    instructions: [
      "Break the work into small sequential steps.",
      "Do not jump straight to the full answer when the student appears to be solving homework.",
      "Check understanding between major steps when it feels natural.",
    ],
  },
  quiz: {
    label: "Quiz",
    instructions: [
      "Act like a tutor running a short quiz, not a lecturer.",
      "Ask one question at a time unless the student explicitly asks for more.",
      "Do not reveal the answer immediately unless the student asks or gets stuck.",
    ],
  },
  review: {
    label: "Review",
    instructions: [
      "Summarize the most important ideas and likely weak spots.",
      "Emphasize key takeaways, definitions, formulas, or vocab from the student's saved materials.",
      "Keep the review tight and practical.",
    ],
  },
  study_plan: {
    label: "Study Plan",
    instructions: [
      "Create a realistic study plan with clear phases or checkpoints.",
      "Use upcoming task or test context when available.",
      "Keep the plan grounded in the student's actual materials instead of generic study advice.",
    ],
  },
  homework_help: {
    label: "Homework Help",
    instructions: [
      "Help the student make progress without pretending to see information that is missing.",
      "Prefer hints, structure, and targeted explanation before full solutions when the request looks like active homework.",
      "When an uploaded worksheet, screenshot, or class material is available, treat that as the primary grounding context before falling back to general knowledge.",
      "Offer natural next-step options like explain, hint, check my work, or quiz me when that would help the student move forward.",
      "If the uploaded worksheet or screenshot is unreadable, say so plainly.",
    ],
  },
};

export type TutoringContextAssembly = {
  tutoringSection: string;
  groundingSection: string;
  materialSection: string;
  attachmentSection: string;
  taskSection: string;
  linkedClass: SchoolClass | null;
  linkedTask: StudentTask | null;
  selectedMaterials: ClassMaterial[];
  selectedAttachments: AssistantAttachment[];
  groundingStatus: "uploaded_materials" | "class_materials" | "limited_materials" | "general_only";
};

export function buildTutoringContextSection(params: {
  tutoringContext?: TutoringContext;
  classes: SchoolClass[];
}) {
  const tutoringContext = params.tutoringContext;
  if (!tutoringContext) return "";

  const lines: string[] = ["Tutoring context:"];
  const classMatch = tutoringContext.classId
    ? params.classes.find((schoolClass) => schoolClass.id === tutoringContext.classId)
    : null;

  if (classMatch) {
    lines.push(`- Class: ${classMatch.name}`);
  }
  if (tutoringContext.mode) {
    lines.push(`- Tutoring mode: ${TUTORING_MODE_POLICIES[tutoringContext.mode].label}`);
  }
  if (tutoringContext.topic) {
    lines.push(`- Topic: ${tutoringContext.topic}`);
  }
  if (tutoringContext.goal) {
    lines.push(`- Goal: ${tutoringContext.goal}`);
  }
  if (tutoringContext.studyFocus) {
    lines.push(`- Study focus: ${tutoringContext.studyFocus}`);
  }
  if ((tutoringContext.materialIds?.length ?? 0) > 0) {
    lines.push(`- Linked material count: ${tutoringContext.materialIds?.length ?? 0}`);
  }
  if ((tutoringContext.attachmentIds?.length ?? 0) > 0) {
    lines.push(`- Linked attachment count: ${tutoringContext.attachmentIds?.length ?? 0}`);
  }

  lines.push(
    "- When tutoring context is present, behave like a grounded academic tutor anchored to the student's real classes, notes, and uploaded files.",
  );

  const policy = tutoringContext.mode
    ? buildTutoringModePolicySection(tutoringContext.mode)
    : "";

  return [lines.join("\n"), policy].filter(Boolean).join("\n\n");
}

export function buildTutoringModePolicySection(mode?: TutoringMode) {
  if (!mode) return "";

  const policy = TUTORING_MODE_POLICIES[mode];
  return [
    `Tutoring mode policy: ${policy.label}`,
    ...policy.instructions.map((instruction) => `- ${instruction}`),
  ].join("\n");
}

export function assembleTutoringContext(params: {
  message: string;
  classes: SchoolClass[];
  tasks: StudentTask[];
  attachments: AssistantAttachment[];
  tutoringContext?: TutoringContext;
  classId?: string;
  taskId?: string;
}) : TutoringContextAssembly {
  const tutoringContext = params.tutoringContext;
  const linkedClass =
    (tutoringContext?.classId ?? params.classId)
      ? params.classes.find(
          (schoolClass) => schoolClass.id === (tutoringContext?.classId ?? params.classId),
        ) ?? null
      : null;
  const linkedTask =
    (tutoringContext?.taskId ?? params.taskId)
      ? params.tasks.find((task) => task.id === (tutoringContext?.taskId ?? params.taskId)) ?? null
      : null;

  const selectedMaterials = selectTutoringMaterials({
    linkedClass,
    tutoringContext,
    linkedTask,
    message: params.message,
  });
  const selectedAttachments = selectTutoringAttachments({
    attachments: params.attachments,
    tutoringContext,
    message: params.message,
  });

  const tutoringSection = buildTutoringContextSection({
    tutoringContext,
    classes: params.classes,
  });
  const groundingSection = buildTutoringGroundingSection({
    linkedClass,
    linkedTask,
    selectedMaterials,
    selectedAttachments,
  });
  const materialSection = formatSelectedMaterials(selectedMaterials);
  const attachmentSection = formatSelectedAttachments(selectedAttachments);
  const taskSection = linkedTask
    ? [
        "Linked task context:",
        `- Title: ${linkedTask.title}`,
        linkedTask.type ? `- Type: ${linkedTask.type}` : null,
        linkedTask.dueAt ? `- Due at: ${linkedTask.dueAt}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "Linked task context: none";

  return {
    tutoringSection,
    groundingSection,
    materialSection,
    attachmentSection,
    taskSection,
    linkedClass,
    linkedTask,
    selectedMaterials,
    selectedAttachments,
    groundingStatus: getTutoringGroundingStatus(selectedMaterials, selectedAttachments),
  };
}

function selectTutoringMaterials(params: {
  linkedClass: SchoolClass | null;
  linkedTask: StudentTask | null;
  tutoringContext?: TutoringContext;
  message: string;
}) {
  const classMaterials = params.linkedClass?.materials ?? [];

  if ((params.tutoringContext?.materialIds?.length ?? 0) > 0) {
    return classMaterials.filter((material) =>
      params.tutoringContext?.materialIds?.includes(material.id),
    );
  }

  if (params.linkedClass) {
    const query = [
      params.message,
      params.linkedTask?.title,
      params.linkedTask?.description,
      params.tutoringContext?.topic,
      params.tutoringContext?.goal,
      params.tutoringContext?.studyFocus,
    ]
      .filter(Boolean)
      .join(" ");
    const retrieval = retrieveRelevantMaterialExcerpts({
      message: query,
      classes: [params.linkedClass],
      maxExcerpts: 4,
    });

    const materialIds = new Set(retrieval.excerpts.map((excerpt) => excerpt.materialId));
    const matched = classMaterials.filter((material) => materialIds.has(material.id));
    if (matched.length > 0) {
      return prioritizeHomeworkHelpMaterials(matched, params.tutoringContext?.mode);
    }
  }

  return prioritizeHomeworkHelpMaterials(classMaterials, params.tutoringContext?.mode).slice(0, 3);
}

function selectTutoringAttachments(params: {
  attachments: AssistantAttachment[];
  tutoringContext?: TutoringContext;
  message: string;
}) {
  if ((params.tutoringContext?.attachmentIds?.length ?? 0) > 0) {
    return prioritizeTutoringAttachments(
      params.attachments.filter((attachment) =>
        params.tutoringContext?.attachmentIds?.includes(attachment.id),
      ),
      params.tutoringContext?.mode,
      params.message,
    );
  }

  return prioritizeTutoringAttachments(
    params.attachments,
    params.tutoringContext?.mode,
    params.message,
  ).slice(0, 3);
}

function formatSelectedMaterials(materials: ClassMaterial[]) {
  if (materials.length === 0) {
    return "Tutoring materials: no specifically linked class materials were available.";
  }

  return [
    "Tutoring materials:",
    ...materials.map((material, index) => {
      const text = normalizeExtractedText(material.extractedText ?? material.rawText ?? "");
      const status = text
        ? "usable text available"
        : material.extractionError
          ? `unusable text (${material.extractionError})`
          : "saved, but no usable text extracted";
      return [
        `${index + 1}. ${material.title} [${material.kind}] - ${status}`,
        text ? text.slice(0, 700) : "No usable text extracted from this material.",
      ].join("\n");
    }),
  ].join("\n\n");
}

function formatSelectedAttachments(attachments: AssistantAttachment[]) {
  if (attachments.length === 0) {
    return "Tutoring attachments: none linked.";
  }

  return [
    "Tutoring attachments:",
    ...attachments.map((attachment, index) => {
      const extracted = normalizeExtractedText(attachment.extractedText ?? "");
      const parts = [
        `${index + 1}. ${attachment.title} [${attachment.attachmentType}]`,
        attachment.fileName ? `file=${attachment.fileName}` : null,
        attachment.mimeType ? `mime=${attachment.mimeType}` : null,
        `processing=${attachment.processingStatus}`,
        `analysis=${attachment.analysisStatus}`,
      ]
        .filter(Boolean)
        .join(", ");

      return extracted
        ? `${parts}\n${extracted.slice(0, 900)}`
        : attachment.extractionError
          ? `${parts}\n${attachment.extractionError}`
          : `${parts}\nNo extracted text is currently available.`;
    }),
  ].join("\n\n");
}

function buildTutoringGroundingSection(params: {
  linkedClass: SchoolClass | null;
  linkedTask: StudentTask | null;
  selectedMaterials: ClassMaterial[];
  selectedAttachments: AssistantAttachment[];
}) {
  const groundingStatus = getTutoringGroundingStatus(
    params.selectedMaterials,
    params.selectedAttachments,
  );
  const usableMaterials = params.selectedMaterials.filter(hasUsableMaterialText);
  const usableAttachments = params.selectedAttachments.filter(hasUsableAttachmentText);

  const lines = ["Active tutoring grounding:"];
  lines.push(
    `- Linked class: ${params.linkedClass ? params.linkedClass.name : "none"}`,
  );
  lines.push(
    `- Linked task: ${params.linkedTask ? params.linkedTask.title : "none"}`,
  );
  lines.push(
    `- Selected class materials: ${summarizeItemList(params.selectedMaterials.map((material) => `${material.title}${hasUsableMaterialText(material) ? "" : " (saved, but no text)"}`))}`,
  );
  lines.push(
    `- Selected session files: ${summarizeItemList(params.selectedAttachments.map((attachment) => `${attachment.title}${hasUsableAttachmentText(attachment) ? "" : " (not readable yet)"}`))}`,
  );

  if (usableAttachments.length > 0) {
    lines.push(
      "- Grounding strength: answer from the uploaded session files first, then use class materials only if they help.",
    );
  } else if (usableMaterials.length > 0) {
    lines.push(
      "- Grounding strength: answer from the saved class materials first, then use general knowledge only to fill obvious gaps.",
    );
  } else if (params.selectedAttachments.length > 0 || params.selectedMaterials.length > 0) {
    lines.push(
      "- Grounding strength: limited. Materials are linked, but they do not currently provide enough readable text to rely on heavily.",
    );
  } else {
    lines.push(
      "- Grounding strength: none. No relevant readable materials are active, so any academic help must be general unless the student shares more context.",
    );
  }

  if (params.selectedAttachments.length + params.selectedMaterials.length > 1) {
    lines.push(
      "- If multiple files or materials could apply, name the specific file/material you are using. If the request is still ambiguous, ask which one the student means before pretending certainty.",
    );
  }

  if (groundingStatus === "limited_materials" || groundingStatus === "general_only") {
    lines.push(
      "- If you do not have enough readable material to verify a class-specific claim, say that plainly and switch to general help, a clarifying question, or a request for a clearer excerpt/upload.",
    );
  }

  return lines.join("\n");
}

function getTutoringGroundingStatus(
  materials: ClassMaterial[],
  attachments: AssistantAttachment[],
): "uploaded_materials" | "class_materials" | "limited_materials" | "general_only" {
  if (attachments.some(hasUsableAttachmentText)) {
    return "uploaded_materials";
  }

  if (materials.some(hasUsableMaterialText)) {
    return "class_materials";
  }

  if (attachments.length > 0 || materials.length > 0) {
    return "limited_materials";
  }

  return "general_only";
}

function hasUsableAttachmentText(attachment: AssistantAttachment) {
  return Boolean(normalizeExtractedText(attachment.extractedText ?? ""));
}

function summarizeItemList(items: string[]) {
  if (items.length === 0) return "none";
  if (items.length <= 3) return items.join(", ");
  return `${items.slice(0, 3).join(", ")}, +${items.length - 3} more`;
}

function prioritizeHomeworkHelpMaterials(
  materials: ClassMaterial[],
  mode?: TutoringMode,
) {
  if (mode !== "homework_help") {
    return materials;
  }

  return [...materials].sort((first, second) => {
    const firstScore = scoreHomeworkHelpLabel(first.title);
    const secondScore = scoreHomeworkHelpLabel(second.title);
    if (firstScore !== secondScore) {
      return secondScore - firstScore;
    }

    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
  });
}

function prioritizeTutoringAttachments(
  attachments: AssistantAttachment[],
  mode: TutoringMode | undefined,
  message: string,
) {
  const lowerMessage = message.toLowerCase();

  return [...attachments].sort((first, second) => {
    const firstScore = scoreAttachment(first, mode, lowerMessage);
    const secondScore = scoreAttachment(second, mode, lowerMessage);
    if (firstScore !== secondScore) {
      return secondScore - firstScore;
    }

    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
  });
}

function scoreAttachment(
  attachment: AssistantAttachment,
  mode: TutoringMode | undefined,
  lowerMessage: string,
) {
  let score = 0;

  if (attachment.analysisStatus === "completed") score += 5;
  if (attachment.attachmentType === "image") score += 2;
  if (attachment.attachmentType === "document") score += 3;

  if (mode === "homework_help") {
    score += 4;
    score += scoreHomeworkHelpLabel(
      [attachment.title, attachment.fileName, attachment.mimeType].filter(Boolean).join(" "),
    );
  }

  const extractedText = attachment.extractedText?.toLowerCase() ?? "";
  if (extractedText && lowerMessage) {
    for (const token of lowerMessage.split(/\W+/).filter((part) => part.length > 3)) {
      if (extractedText.includes(token)) {
        score += 1;
      }
    }
  }

  return score;
}

function scoreHomeworkHelpLabel(value: string) {
  const lowerValue = value.toLowerCase();
  let score = 0;
  for (const keyword of ["worksheet", "homework", "problem", "assignment", "study guide", "guide", "review"]) {
    if (lowerValue.includes(keyword)) {
      score += 3;
    }
  }

  return score;
}
