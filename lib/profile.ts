export type AssistantTone = "balanced" | "chill" | "focused";
export type AiModel = "fast" | "balanced" | "powerful";
export type MainGoal = "organized" | "study" | "both";

export interface StudentProfile {
  displayName?: string;
  gradeLevel?: string;
  goals?: string;
  mainGoal?: MainGoal;
  focusClass?: string;
  assistantTone: AssistantTone;
  aiModel?: AiModel;
  onboardingComplete?: boolean;
}

const STORAGE_KEY = "scc_profile";

const DEFAULT_PROFILE: StudentProfile = {
  assistantTone: "balanced",
};

export function loadProfile(): StudentProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<StudentProfile>) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: StudentProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function buildProfilePrompt(profile: StudentProfile | undefined): string {
  if (!profile) return "";

  const lines: string[] = [];

  if (profile.displayName) {
    lines.push(`The student's name is ${profile.displayName}. Use it naturally once or twice per conversation — not in every message.`);
  }

  if (profile.gradeLevel) {
    lines.push(`Grade level: ${profile.gradeLevel}.`);
  }

  if (profile.goals) {
    lines.push(`Student's goals: ${profile.goals}`);
  }

  if (profile.mainGoal) {
    const goalMap: Record<MainGoal, string> = {
      organized: "Primary focus: staying organized and on top of deadlines.",
      study: "Primary focus: studying more effectively and understanding material.",
      both: "Primary focus: staying organized and studying more effectively.",
    };
    lines.push(goalMap[profile.mainGoal]);
  }

  if (profile.focusClass) {
    lines.push(`The student's most important or challenging class right now is ${profile.focusClass}. Give extra care and detail when this class comes up.`);
  }

  const toneMap: Record<AssistantTone, string> = {
    balanced: "Tone: calm, supportive, and clear — match the energy of the question.",
    chill: "Tone: relaxed and conversational. Keep it casual but still helpful.",
    focused: "Tone: direct and efficient. Skip preamble. Get to the point fast.",
  };

  lines.push(toneMap[profile.assistantTone ?? "balanced"]);

  return lines.join("\n");
}
