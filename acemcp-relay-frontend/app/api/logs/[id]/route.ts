import { NextResponse } from "next/server";
import { getErrorDetailsByRequestId, getRequestLogById } from "@/lib/db";
import { requireCurrentUser } from "@/lib/route-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireCurrentUser();
    if (!user) {
      return response!;
    }

    const { id } = await params;
    const log = await getRequestLogById(user.id, id);
    if (!log) {
      return NextResponse.json({ error: "日志不存在" }, { status: 404 });
    }

    const errors = await getErrorDetailsByRequestId(id);

    return NextResponse.json({
      log: {
        id: log.id,
        status: log.status,
        statusCode: log.status_code,
        requestPath: log.request_path,
        requestMethod: log.request_method,
        requestTimestamp: log.request_timestamp,
        responseDurationMs: log.response_duration_ms,
        clientIp: log.client_ip,
      },
      errors: errors.map((item) => ({
        id: item.id,
        source: item.source,
        error: item.error,
        createdAt: item.created_at,
      })),
    });
  } catch (error) {
    console.error("获取日志详情失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
