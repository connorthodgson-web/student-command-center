import OpenAI from "openai";
import type { StudentProfile } from "./profile";

const client = new OpenAI();

/**
 * Generates a short Today Focus summary from a pre-formatted context string.
 * The context is built by formatTodayContextForPrompt() in assistant-context.ts.
 */
export async function generateTodayFocus(
  contextText: string,
  profile?: StudentProfile
): Promise<string> {
  const toneNote =
    profile?.assistantTone === "chill"
      ? "Keep the tone relaxed and casual."
      : profile?.assistantTone === "focused"
      ? "Keep the tone direct and efficient. No preamble."
      : "Keep the tone calm and clear.";

  const systemPrompt = `You are a helpful student assistant. Given the student's schedule and tasks for today, write a brief Today Focus.

Format — output exactly:
1. One overview sentence (no label, no heading)
2. 3–5 bullet points using "- " prefix

Rules:
- Reference specific tasks, classes, and activities by name
- If there are overdue tasks, mention them first
- If there's an activity tonight, suggest finishing schoolwork before it
- No motivational fluff, no hourly schedule, no elaborate planning
- Under 120 words total
- ${toneNote}`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 200,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: contextText },
    ],
  });

  return response.choices[0].message.content?.trim() ?? "Unable to generate focus summary.";
}
