import { NextResponse } from "next/server";
import { resolveDateRange } from "@/lib/date-range";
import { getManagedUserContextStats } from "@/lib/db";
import { requireAdminUser } from "@/lib/route-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminUser();
    if (!user) {
      return response!;
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const range = resolveDateRange({
      preset: searchParams.get("preset"),
      start: searchParams.get("start"),
      end: searchParams.get("end"),
    });

    const stats = await getManagedUserContextStats(id, range.startAt, range.endAt);
    return NextResponse.json({
      range: {
        preset: range.preset,
        label: range.label,
        startAt: range.startAt.toISOString(),
        endAt: range.endAt.toISOString(),
      },
      totalCount: stats.totalCount,
      series: stats.series,
    });
  } catch (error) {
    console.error("获取用户统计失败:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "服务器错误" }, { status: 500 });
  }
}
