"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Clock, Radio, RefreshCw, Zap } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface HealthCheck {
  id: number;
  status: string;
  tcpPingMs: number | null;
  codebaseRetrievalMs: number | null;
  errorMessage: string | null;
  createdAt: string;
}

interface HistoryResponse {
  history: HealthCheck[];
  stats: {
    successCount: number;
    totalCount: number;
  };
  nextCheckAt: string | null;
}

export default function StatusPage() {
  const router = useRouter();
  const { user, isLoading } = useCurrentUser({ required: true });
  const [history, setHistory] = useState<HealthCheck[]>([]);
  const [stats, setStats] = useState<{ successCount: number; totalCount: number } | null>(null);
  const [nextCheckAt, setNextCheckAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/health/history?limit=20", { cache: "no-store" });
      if (!response.ok) return;
      const data: HistoryResponse = await response.json();
      setHistory(data.history);
      setStats(data.stats);
      setNextCheckAt(data.nextCheckAt);
    } catch (error) {
      console.error("获取状态失败:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!nextCheckAt) {
      setCountdown(null);
      return;
    }

    const timer = window.setInterval(() => {
      const diff = Math.max(0, Math.round((new Date(nextCheckAt).getTime() - Date.now()) / 1000));
      setCountdown(diff);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [nextCheckAt]);

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const latest = history[0] || null;
  const availability = useMemo(() => {
    if (!stats?.totalCount) return "—";
    return `${((stats.successCount / stats.totalCount) * 100).toFixed(2)}%`;
  }, [stats]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a] text-slate-400">
        加载中...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <DashboardHeader
        currentPath="/status"
        isAdmin={user.isAdmin}
        userName={user.name}
        onLogout={handleLogout}
        rightSlot={
          <Button variant="ghost" size="sm" onClick={fetchStatus}>
            <RefreshCw className={cn("h-4 w-4 text-slate-300", loading && "animate-spin")} />
          </Button>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">状态监控</h1>
            <p className="mt-2 text-sm text-slate-400">展示 relay 对上游 Augment 的 TCP 连通性与 codebase-retrieval 探测结果。</p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
            下次检查：{countdown === null ? "—" : `${countdown}s`}
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          {[
            {
              label: "整体状态",
              value: latest?.status === "success" ? "正常" : latest?.status === "error" ? "异常" : "检测中",
              icon: Activity,
            },
            {
              label: "TCP Ping",
              value: latest?.tcpPingMs ? `${latest.tcpPingMs} ms` : "—",
              icon: Radio,
            },
            {
              label: "ContextEngine",
              value: latest?.codebaseRetrievalMs ? `${latest.codebaseRetrievalMs} ms` : "—",
              icon: Zap,
            },
            {
              label: "近 7 天可用率",
              value: availability,
              icon: Clock,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="border-white/[0.06] bg-[#0d1424]/70 backdrop-blur-xl">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 text-slate-400">
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-white/[0.06] bg-[#0d1424]/70 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium">最近 20 次探测</h2>
                <p className="text-sm text-slate-400">按时间倒序显示最新健康检查记录。</p>
              </div>
            </div>

            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/40 p-6 text-center text-slate-400">
                  暂无健康检查数据
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/40 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-xs",
                              item.status === "success"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-red-500/15 text-red-300"
                            )}
                          >
                            {item.status}
                          </span>
                          <span className="text-xs text-slate-500">#{item.id}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-300">{new Date(item.createdAt).toLocaleString("zh-CN")}</p>
                      </div>
                      <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3 sm:text-right">
                        <span>TCP: {item.tcpPingMs ? `${item.tcpPingMs} ms` : "—"}</span>
                        <span>Retrieval: {item.codebaseRetrievalMs ? `${item.codebaseRetrievalMs} ms` : "—"}</span>
                        <span className="text-red-300">{item.errorMessage || "无错误"}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
