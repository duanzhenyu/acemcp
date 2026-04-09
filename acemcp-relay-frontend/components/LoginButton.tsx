"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { CurrentUser } from "@/lib/types";

interface LoginButtonProps {
  user?: CurrentUser | null;
}

export function LoginButton({ user }: LoginButtonProps) {
  if (user) {
    return (
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8 ring-1 ring-white/10">
          <AvatarImage src={user.image || undefined} alt={user.name || "User avatar"} />
          <AvatarFallback className="bg-slate-800 text-xs text-slate-300">
            {user.name?.charAt(0)?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-light text-slate-400 sm:inline">{user.name}</span>
        <Button variant="link" asChild className="px-4 text-cyan-400 hover:text-cyan-300">
          <Link href={user.isAdmin ? "/admin/users" : "/console"}>
            {user.isAdmin ? "管理台" : "控制台"}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <Button variant="gradient" asChild className="rounded-lg">
      <Link href="/login">登录</Link>
    </Button>
  );
}
