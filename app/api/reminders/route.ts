import { NextResponse } from "next/server";
import { mockReminderPreference } from "../../../lib/mock-data";

export async function GET() {
  return NextResponse.json({ data: mockReminderPreference });
}
