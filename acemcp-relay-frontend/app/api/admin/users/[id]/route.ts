import { NextResponse } from "next/server";
import { updateManagedUser } from "@/lib/db";
import { requireAdminUser } from "@/lib/route-auth";
import type { UserStatus } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminUser();
    if (!user) {
      return response!;
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const payload: { name?: string; note?: string | null; status?: UserStatus } = {};

    if (body.name !== undefined) {
      payload.name = String(body.name || "").trim();
      if (!payload.name) {
        return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
      }
    }

    if (body.note !== undefined) {
      payload.note = body.note ? String(body.note).trim() : null;
    }

    if (body.status !== undefined) {
      payload.status = body.status === "disabled" ? "disabled" : "active";
    }

    const updated = await updateManagedUser(id, payload);
    if (!updated) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: updated.id,
        name: updated.name,
        note: updated.note,
        status: updated.status,
        email: updated.email,
        image: updated.image,
        username: updated.username,
        trustLevel: updated.trustLevel,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("更新用户失败:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "服务器错误" }, { status: 500 });
  }
}
