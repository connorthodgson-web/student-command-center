import type {
  AssistantAttachment,
  ClassMaterial,
  SchoolClass,
  StudentTask,
  TutoringContext,
  TutoringMode,
} from "../types";
import { normalizeExtractedText, retrieveRelevantMaterialExcerpts } from "./class-materials";

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
      "If the uploaded worksheet or screenshot is unreadable, say so plainly.",
    ],
  },
};

export type TutoringContextAssembly = {
  tutoringSection: string;
  materialSection: string;
  attachmentSection: string;
  taskSection: string;
  linkedClass: SchoolClass | null;
  linkedTask: StudentTask | null;
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
    message: params.message,
  });
  const selectedAttachments = selectTutoringAttachments({
    attachments: params.attachments,
    tutoringContext,
  });

  const tutoringSection = buildTutoringContextSection({
    tutoringContext,
    classes: params.classes,
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
    materialSection,
    attachmentSection,
    taskSection,
    linkedClass,
    linkedTask,
  };
}

function selectTutoringMaterials(params: {
  linkedClass: SchoolClass | null;
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
      return matched;
    }
  }

  return classMaterials.slice(0, 3);
}

function selectTutoringAttachments(params: {
  attachments: AssistantAttachment[];
  tutoringContext?: TutoringContext;
}) {
  if ((params.tutoringContext?.attachmentIds?.length ?? 0) > 0) {
    return params.attachments.filter((attachment) =>
      params.tutoringContext?.attachmentIds?.includes(attachment.id),
    );
  }

  return params.attachments.slice(0, 3);
}

function formatSelectedMaterials(materials: ClassMaterial[]) {
  if (materials.length === 0) {
    return "Tutoring materials: no specifically linked class materials were available.";
  }

  return [
    "Tutoring materials:",
    ...materials.map((material, index) => {
      const text = normalizeExtractedText(material.extractedText ?? material.rawText ?? "");
      return [
        `${index + 1}. ${material.title} [${material.kind}]`,
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
