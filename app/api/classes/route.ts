import { NextResponse } from "next/server";
import { mockClasses } from "../../../lib/mock-data";

export async function GET() {
  return NextResponse.json({ data: mockClasses });
}
