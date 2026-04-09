import { NextResponse } from "next/server";
import { resolveDateRange } from "@/lib/date-range";
import { createManagedUser, listManagedUsersWithContextStats, maskApiKey } from "@/lib/db";
import { requireAdminUser } from "@/lib/route-auth";
import { isConfiguredAdminUserId } from "@/lib/config";
import type { UserStatus } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const { user, response } = await requireAdminUser();
    if (!user) {
      return response!;
    }

    const { searchParams } = new URL(request.url);
    const range = resolveDateRange({
      preset: searchParams.get("preset"),
      start: searchParams.get("start"),
      end: searchParams.get("end"),
    });

    const users = await listManagedUsersWithContextStats(range.startAt, range.endAt);

    return NextResponse.json({
      range: {
        preset: range.preset,
        label: range.label,
        startAt: range.startAt.toISOString(),
        endAt: range.endAt.toISOString(),
      },
      users: users.map((item) => ({
        id: item.id,
        name: item.name,
        note: item.note,
        status: item.status,
        isAdmin: isConfiguredAdminUserId(item.id),
        email: item.email,
        image: item.image,
        username: item.username,
        trustLevel: item.trustLevel,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        maskedApiKey: item.maskedApiKey,
        hasApiKey: item.hasApiKey,
        apiKeyCreatedAt: item.apiKeyCreatedAt?.toISOString() || null,
        apiKeyUpdatedAt: item.apiKeyUpdatedAt?.toISOString() || null,
        contextEngineCount: item.contextEngineCount,
      })),
    });
  } catch (error) {
    console.error("获取用户列表失败:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "服务器错误" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAdminUser();
    if (!user) {
      return response!;
    }

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const note = body.note ? String(body.note).trim() : null;
    const status = (body.status === "disabled" ? "disabled" : "active") as UserStatus;

    if (!name) {
      return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
    }

    const created = await createManagedUser({ name, note, status });
    return NextResponse.json({
      user: {
        id: created.user.id,
        name: created.user.name,
        note: created.user.note,
        status: created.user.status,
        email: created.user.email,
        image: created.user.image,
        username: created.user.username,
        trustLevel: created.user.trustLevel,
        createdAt: created.user.createdAt.toISOString(),
        updatedAt: created.user.updatedAt.toISOString(),
      },
      apiKey: created.key.api_key,
      maskedApiKey: maskApiKey(created.key.api_key),
    });
  } catch (error) {
    console.error("创建用户失败:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "服务器错误" }, { status: 500 });
  }
}
