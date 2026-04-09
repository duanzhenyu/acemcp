import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/db";
import { requireCurrentUser } from "@/lib/route-auth";
import { maskUsername } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const { user, response } = await requireCurrentUser();
    if (!user) {
      return response!;
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || undefined;
    const entries = await getLeaderboard(dateStr);
    const today = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Shanghai",
    }).format(new Date());

    return NextResponse.json({
      date: dateStr || today,
      entries: entries.map((entry) => ({
        rank: entry.rank,
        userName: maskUsername(entry.user_name),
        requestCount: Number(entry.request_count),
        isCurrentUser: entry.user_id === user.id,
      })),
    });
  } catch (error) {
    console.error("获取排行榜失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
