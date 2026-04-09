import { NextResponse } from "next/server";
import { resetManagedUserApiKey } from "@/lib/db";
import { requireAdminUser } from "@/lib/route-auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminUser();
    if (!user) {
      return response!;
    }

    const { id } = await params;
    const key = await resetManagedUserApiKey(id);
    if (!key) {
      return NextResponse.json({ error: "用户不存在或尚未创建 API Key" }, { status: 404 });
    }

    return NextResponse.json({
      apiKey: key.api_key,
      createdAt: key.created_at,
      updatedAt: key.updated_at,
    });
  } catch (error) {
    console.error("重置 API Key 失败:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "服务器错误" }, { status: 500 });
  }
}
