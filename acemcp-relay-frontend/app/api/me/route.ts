import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/route-auth";

export async function GET() {
  try {
    const { user, response } = await requireCurrentUser();
    if (!user) {
      return response!;
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("获取当前用户失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
