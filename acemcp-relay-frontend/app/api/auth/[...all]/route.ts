import { NextResponse } from "next/server";

function disabled() {
  return NextResponse.json({ error: "LinuxDo OAuth 已停用" }, { status: 404 });
}

export const GET = disabled;
export const POST = disabled;
