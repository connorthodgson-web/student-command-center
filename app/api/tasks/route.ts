import { NextResponse } from "next/server";
import { mockTasks } from "../../../lib/mock-data";

export async function GET() {
  return NextResponse.json({ data: mockTasks });
}
