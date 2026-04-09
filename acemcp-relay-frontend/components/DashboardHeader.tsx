"use client";

import Link from "next/link";
import { LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  currentPath: string;
  isAdmin?: boolean;
  userName?: string | null;
  onLogout?: () => void;
  rightSlot?: React.ReactNode;
}

const navItems = [
  { href: "/console", label: "控制台" },
  { href: "/leaderboard", label: "排行榜" },
  { href: "/status", label: "状态监控" },
  { href: "/admin/users", label: "用户管理", adminOnly: true },
];

export function DashboardHeader({
  currentPath,
  isAdmin = false,
  userName,
  onLogout,
  rightSlot,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0f1a]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-3 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link
            href="/"
            className="text-lg font-semibold whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400 sm:text-xl"
          >
            ACE Relay
          </Link>
          <nav className="flex items-center gap-0.5 overflow-x-auto sm:gap-1">
            {navItems
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => {
                const active = currentPath === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "px-2 py-1.5 text-xs whitespace-nowrap border-b-2 transition-colors sm:px-3 sm:text-sm",
                      active
                        ? "text-white border-cyan-400"
                        : "text-slate-400 border-transparent hover:text-slate-200"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {userName ? (
            <div className="hidden items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 sm:flex">
              {isAdmin ? <Shield className="h-3.5 w-3.5 text-cyan-400" /> : null}
              <span className="max-w-32 truncate">{userName}</span>
            </div>
          ) : null}
          {rightSlot}
          {onLogout ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="text-slate-400 hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
