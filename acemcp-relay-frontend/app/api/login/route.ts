import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/db";
import { applySessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const apiKey = String(body.apiKey || "").trim();

    if (!apiKey) {
      return NextResponse.json({ error: "请输入 API Key" }, { status: 400 });
    }

    const authResult = await authenticateApiKey(apiKey);
    if (!authResult) {
      return NextResponse.json({ error: "API Key 无效或账号已停用" }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: authResult.user.id,
        name: authResult.user.name,
      },
    });
    applySessionCookie(response, authResult.user.id);
    return response;
  } catch (error) {
    console.error("API Key login failed:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
