import { NextResponse } from "next/server";
import { getApiKey, maskApiKey } from "@/lib/db";
import { requireCurrentUser } from "@/lib/route-auth";

export async function GET() {
  try {
    const { user, response } = await requireCurrentUser();
    if (!user) {
      return response!;
    }

    const keyRecord = await getApiKey(user.id);
    if (!keyRecord) {
      return NextResponse.json({
        hasKey: false,
        maskedKey: null,
        createdAt: null,
        updatedAt: null,
      });
    }

    return NextResponse.json({
      hasKey: true,
      maskedKey: maskApiKey(keyRecord.api_key),
      createdAt: keyRecord.created_at,
      updatedAt: keyRecord.updated_at,
    });
  } catch (error) {
    console.error("获取 API Key 失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "普通用户已禁用自助创建/重置 API Key，请联系管理员" },
    { status: 403 }
  );
}
