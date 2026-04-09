import { NextResponse } from "next/server";
import { getContextEngineCount, getRequestLogs, getRequestLogStats } from "@/lib/db";
import { requireCurrentUser } from "@/lib/route-auth";

export async function GET(request: Request) {
  try {
    const { user, response } = await requireCurrentUser();
    if (!user) {
      return response!;
    }

    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get("page") || "1", 10);
    const limit = Number.parseInt(searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;
    const withStats = searchParams.get("withStats") === "true";

    if (withStats) {
      const [logs, stats, contextEngineCount] = await Promise.all([
        getRequestLogs(user.id, limit, offset),
        getRequestLogStats(user.id),
        getContextEngineCount(user.id),
      ]);

      return NextResponse.json({
        stats: { ...stats, contextEngineCount },
        logs: logs.map((log) => ({
          id: log.id,
          status: log.status,
          statusCode: log.status_code,
          requestPath: log.request_path,
          requestMethod: log.request_method,
          requestTimestamp: log.request_timestamp,
          responseDurationMs: log.response_duration_ms,
          clientIp: log.client_ip,
        })),
        pagination: {
          page,
          limit,
          total: stats.totalCount,
        },
      });
    }

    const logs = await getRequestLogs(user.id, limit, offset);
    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        status: log.status,
        statusCode: log.status_code,
        requestPath: log.request_path,
        requestMethod: log.request_method,
        requestTimestamp: log.request_timestamp,
        responseDurationMs: log.response_duration_ms,
        clientIp: log.client_ip,
      })),
      pagination: { page, limit },
    });
  } catch (error) {
    console.error("获取请求日志失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
