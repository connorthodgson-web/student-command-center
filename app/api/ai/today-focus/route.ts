import { NextResponse } from "next/server";
import { generateTodayFocus } from "../../../../lib/today-focus";
import type { StudentProfile } from "../../../../lib/profile";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    contextText?: string;
    profile?: StudentProfile;
  };

  if (!body.contextText) {
    return NextResponse.json({ error: "contextText is required." }, { status: 400 });
  }

  try {
    const focus = await generateTodayFocus(body.contextText, body.profile);
    return NextResponse.json({ focus });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate Today Focus." },
      { status: 500 }
    );
  }
}
