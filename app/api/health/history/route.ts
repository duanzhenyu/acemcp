import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getHealthCheckHistory, getHealthCheckStats } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "60");

    const [history, stats] = await Promise.all([
      getHealthCheckHistory(limit),
      getHealthCheckStats(7),
    ]);

    const nextCheckAt = history.length > 0 ? history[0].next_check_at : null;

    return NextResponse.json({
      history: history.map((row) => ({
        id: row.id,
        status: row.status,
        tcpPingMs: row.tcp_ping_ms,
        codebaseRetrievalMs: row.codebase_retrieval_ms,
        errorMessage: row.error_message,
        createdAt: row.created_at,
      })),
      stats: {
        successCount: stats.successCount,
        totalCount: stats.totalCount,
      },
      nextCheckAt,
    });
  } catch (error) {
    console.error("获取健康检查历史失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
