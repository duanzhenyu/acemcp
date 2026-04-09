"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Medal, RefreshCw, Trophy } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function getDateOptions() {
  const now = new Date();
  return Array.from({ length: 3 }).map((_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - index);
    return {
      date: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(date),
      label: new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "numeric",
        day: "numeric",
      }).format(date),
    };
  });
}

interface LeaderboardEntry {
  rank: number;
  userName: string;
  requestCount: number;
  isCurrentUser: boolean;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { user, isLoading } = useCurrentUser({ required: true });
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(false);

  const options = useMemo(() => getDateOptions(), []);

  const fetchLeaderboard = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/leaderboard?date=${date}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setEntries(data.entries || []);
    } catch (error) {
      console.error("获取排行榜失败:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedDate && options[0]) {
      setSelectedDate(options[0].date);
      fetchLeaderboard(options[0].date);
    }
  }, [fetchLeaderboard, options, selectedDate]);

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a] text-slate-400">
        加载中...
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-amber-400" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-slate-300" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="w-5 text-center text-sm text-slate-500">{rank}</span>;
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <DashboardHeader
        currentPath="/leaderboard"
        isAdmin={user.isAdmin}
        userName={user.name}
        onLogout={handleLogout}
        rightSlot={
          <Button variant="ghost" size="sm" onClick={() => fetchLeaderboard(selectedDate)}>
            <RefreshCw className={cn("h-4 w-4 text-slate-300", loading && "animate-spin")} />
          </Button>
        }
      />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-8 text-center">
          <Trophy className="mx-auto h-12 w-12 text-amber-400" />
          <h1 className="mt-4 text-3xl font-semibold">每日排行榜</h1>
          <p className="mt-2 text-sm text-slate-400">按 /agents/codebase-retrieval 成功调用量统计，每 30 分钟更新。</p>
        </div>

        <div className="mb-6 flex justify-center">
          <div className="inline-flex rounded-2xl border border-white/[0.06] bg-white/[0.03] p-1.5">
            {options.map((option) => (
              <button
                key={option.date}
                type="button"
                onClick={() => {
                  setSelectedDate(option.date);
                  fetchLeaderboard(option.date);
                }}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm transition",
                  selectedDate === option.date
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {loading && entries.length === 0 ? (
            <Card className="border-white/[0.06] bg-[#0d1424]/70 backdrop-blur-xl">
              <CardContent className="p-6 text-center text-slate-400">加载中...</CardContent>
            </Card>
          ) : entries.length === 0 ? (
            <Card className="border-white/[0.06] bg-[#0d1424]/70 backdrop-blur-xl">
              <CardContent className="p-6 text-center text-slate-400">暂无排行数据</CardContent>
            </Card>
          ) : (
            entries.map((entry) => (
              <Card
                key={entry.rank}
                className={cn(
                  "border-white/[0.06] bg-[#0d1424]/70 backdrop-blur-xl",
                  entry.isCurrentUser && "ring-1 ring-cyan-500/50"
                )}
              >
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-8">{getRankIcon(entry.rank)}</div>
                    <div>
                      <p className={cn("font-medium", entry.isCurrentUser ? "text-cyan-300" : "text-white")}>{entry.userName}</p>
                      <p className="text-xs text-slate-500">第 {entry.rank} 名</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold text-white">{entry.requestCount}</p>
                    <p className="text-xs text-slate-500">次调用</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
