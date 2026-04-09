import { NextResponse } from "next/server";
import { getHealthCheckHistory, getHealthCheckStats } from "@/lib/db";
import { requireCurrentUser } from "@/lib/route-auth";

export async function GET(request: Request) {
  try {
    const { user, response } = await requireCurrentUser();
    if (!user) {
      return response!;
    }

    const { searchParams } = new URL(request.url);
    const limit = Number.parseInt(searchParams.get("limit") || "60", 10);

    const [history, stats] = await Promise.all([
      getHealthCheckHistory(limit),
      getHealthCheckStats(7),
    ]);

    return NextResponse.json({
      history: history.map((row) => ({
        id: row.id,
        status: row.status,
        tcpPingMs: row.tcp_ping_ms,
        codebaseRetrievalMs: row.codebase_retrieval_ms,
        errorMessage: row.error_message,
        createdAt: row.created_at,
      })),
      stats,
      nextCheckAt: history[0]?.next_check_at || null,
    });
  } catch (error) {
    console.error("获取健康检查历史失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
