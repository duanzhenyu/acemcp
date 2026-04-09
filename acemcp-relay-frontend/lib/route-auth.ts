import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/session";

export async function requireCurrentUser() {
  const user = await getCurrentSessionUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "未登录或账号已停用" }, { status: 401 }),
    };
  }

  return { user, response: null };
}

export async function requireAdminUser() {
  const result = await requireCurrentUser();
  if (!result.user) {
    return result;
  }

  if (!result.user.isAdmin) {
    return {
      user: null,
      response: NextResponse.json({ error: "需要管理员权限" }, { status: 403 }),
    };
  }

  return result;
}
