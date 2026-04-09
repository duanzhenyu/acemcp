"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Copy,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  Shield,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Tab = "keys" | "docs" | "logs" | "profile";

interface RequestLog {
  id: string;
  status: string;
  statusCode: number | null;
  requestPath: string;
  requestMethod: string;
  requestTimestamp: string;
  responseDurationMs: number | null;
  clientIp: string;
}

interface LogsResponse {
  stats?: {
    successCount: number;
    failedCount: number;
    totalCount: number;
    contextEngineCount: number;
  };
  logs: RequestLog[];
  pagination: {
    page: number;
    limit: number;
    total?: number;
  };
}

interface LogDetailResponse {
  log: RequestLog;
  errors: Array<{
    id: number;
    source: string;
    error: string;
    createdAt: string;
  }>;
}

interface KeyInfo {
  hasKey: boolean;
  maskedKey: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0a0f1a]/40 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 break-all text-sm text-white">{value}</p>
    </div>
  );
}

export default function ConsolePage() {
  const router = useRouter();
  const { user, isLoading } = useCurrentUser({ required: true });
  const [activeTab, setActiveTab] = useState<Tab>("keys");
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null);
  const [fullKey, setFullKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [logsData, setLogsData] = useState<LogsResponse | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logDetail, setLogDetail] = useState<LogDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const installCommand = "npm install -g @augmentcode/auggie@latest";
  const relayUrl = (process.env.NEXT_PUBLIC_RELAY_URL || "https://ace-api.duanzhenyu.top:8003").replace(/\/+$/, "");
  const sessionAuth = useMemo(
    () =>
      JSON.stringify({
        accessToken: "your-access-token",
        tenantURL: relayUrl,
        scopes: ["email"],
      }),
    [relayUrl]
  );
  const mcpConfig = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            "augment-context-engine": {
              command: "auggie",
              args: ["--mcp", "--mcp-auto-workspace"],
              env: {
                AUGMENT_SESSION_AUTH: sessionAuth,
              },
            },
          },
        },
        null,
        2
      ),
    [sessionAuth]
  );

  const fetchKeyInfo = useCallback(async () => {
    const response = await fetch("/api/key", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      setKeyInfo(data);
    }
  }, []);

  const fetchLogs = useCallback(async (page = 1, withStats = false) => {
    setLogsLoading(true);
    try {
      const url = withStats || !logsData?.stats
        ? `/api/logs?page=${page}&limit=20&withStats=true`
        : `/api/logs?page=${page}&limit=20`;
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setLogsData((previous) => {
        if (!data.stats && previous?.stats) {
          return {
            ...data,
            stats: previous.stats,
            pagination: {
              ...data.pagination,
              total: previous.pagination.total,
            },
          };
        }
        return data;
      });
      setLogsPage(page);
    } catch (error) {
      console.error("获取请求日志失败:", error);
    } finally {
      setLogsLoading(false);
    }
  }, [logsData?.stats]);

  const fetchLogDetail = useCallback(async (logId: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/logs/${logId}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setLogDetail(data);
    } catch (error) {
      console.error("获取日志详情失败:", error);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchKeyInfo();
    }
  }, [fetchKeyInfo, user]);

  useEffect(() => {
    if (user && activeTab === "logs" && !logsData) {
      fetchLogs(1, true);
    }
  }, [activeTab, fetchLogs, logsData, user]);

  useEffect(() => {
    if (!autoRefresh || activeTab !== "logs") return;
    const timer = window.setInterval(() => {
      fetchLogs(1, true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeTab, autoRefresh, fetchLogs]);

  const handleRevealKey = async () => {
    if (showKey) {
      setShowKey(false);
      setFullKey(null);
      return;
    }

    const response = await fetch("/api/key/reveal", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setFullKey(data.apiKey);
    setShowKey(true);
  };

  const handleCopyKey = async () => {
    if (!keyInfo?.hasKey) return;
    let target = fullKey;
    if (!target) {
      const response = await fetch("/api/key/reveal", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      target = data.apiKey;
    }

    if (!target) return;
    await navigator.clipboard.writeText(target);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const copyText = async (value: string, setter: (value: boolean) => void) => {
    await navigator.clipboard.writeText(value);
    setter(true);
    window.setTimeout(() => setter(false), 1500);
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a] text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const stats = logsData?.stats;

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <div className="fixed left-1/4 top-0 h-[380px] w-[520px] rounded-full bg-cyan-500/5 blur-3xl pointer-events-none" />
      <DashboardHeader
        currentPath="/console"
        isAdmin={user.isAdmin}
        userName={user.name}
        onLogout={() => setShowLogoutConfirm(true)}
      />

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-3xl border border-white/[0.06] bg-[#0d1424]/70 p-6 backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">欢迎回来，{user.name}</h1>
              <p className="mt-2 text-sm text-slate-400">
                使用 API Key 登录的统一控制台。{user.isAdmin ? " 你拥有管理员权限。" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-cyan-300">
                状态：{user.status === "active" ? "启用" : "停用"}
              </Badge>
              {user.isAdmin ? (
                <Badge className="border-purple-500/20 bg-purple-500/10 px-3 py-1 text-purple-300">
                  <Shield className="h-3 w-3" /> 管理员
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)} className="gap-4">
          <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2">
            <TabsTrigger value="keys" className="rounded-xl data-[state=active]:bg-white/[0.08] data-[state=active]:text-white">
              密钥管理
            </TabsTrigger>
            <TabsTrigger value="docs" className="rounded-xl data-[state=active]:bg-white/[0.08] data-[state=active]:text-white">
              配置说明
            </TabsTrigger>
            <TabsTrigger value="logs" className="rounded-xl data-[state=active]:bg-white/[0.08] data-[state=active]:text-white">
              请求日志
            </TabsTrigger>
            <TabsTrigger value="profile" className="rounded-xl data-[state=active]:bg-white/[0.08] data-[state=active]:text-white">
              用户信息
            </TabsTrigger>
          </TabsList>

          <TabsContent value="keys">
            <Card className="border-white/[0.06] bg-[#0d1424]/70 backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <KeyRound className="h-5 w-5 text-cyan-300" />
                    <div>
                      <h2 className="text-lg font-medium">当前 API Key</h2>
                      <p className="text-sm text-slate-400">普通用户不再支持自助生成或重置密钥。</p>
                    </div>
                  </div>

                  {keyInfo?.hasKey ? (
                    <>
                      <div className="rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/50 p-4">
                        <p className="text-xs text-slate-500">API Key</p>
                        <p className="mt-2 break-all font-mono text-sm text-white">
                          {showKey && fullKey ? fullKey : keyInfo.maskedKey}
                        </p>
                        <p className="mt-3 text-xs text-slate-500">
                          更新时间 {keyInfo.updatedAt ? new Date(keyInfo.updatedAt).toLocaleString("zh-CN") : "-"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button variant="glass" onClick={handleRevealKey}>
                          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {showKey ? "隐藏" : "显示完整密钥"}
                        </Button>
                        <Button variant="glass" onClick={handleCopyKey}>
                          <Copy className="h-4 w-4" />
                          {copied ? "已复制" : "复制"}
                        </Button>
                        {user.isAdmin ? (
                          <Button variant="warning" asChild>
                            <Link href="/admin/users">前往用户管理</Link>
                          </Button>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                      该账号尚未分配 API Key，请联系管理员创建或重置。
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docs">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-white/[0.06] bg-[#0d1424]/70 backdrop-blur-xl">
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-center gap-3">
                    <Info className="h-5 w-5 text-cyan-300" />
                    <div>
                      <h2 className="text-lg font-medium">客户端安装</h2>
                      <p className="text-sm text-slate-400">安装 Auggie CLI 并写入 relay 地址。</p>
                    </div>
                  </div>
                  <pre className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/60 p-4 text-xs text-cyan-100">{installCommand}</pre>
                  <Button variant="glass" onClick={() => copyText(installCommand, setCopiedInstall)}>
                    <Copy className="h-4 w-4" />
                    {copiedInstall ? "已复制" : "复制安装命令"}
                  </Button>
                </CardContent>
              </Card>
              <Card className="border-white/[0.06] bg-[#0d1424]/70 backdrop-blur-xl">
                <CardContent className="space-y-4 p-6">
                  <div>
                    <h2 className="text-lg font-medium">MCP 配置</h2>
                    <p className="mt-1 text-sm text-slate-400">将下方配置复制到本地 MCP 配置文件。</p>
                  </div>
                  <pre className="max-h-[340px] overflow-auto rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/60 p-4 text-xs text-cyan-100">{mcpConfig}</pre>
                  <Button variant="glass" onClick={() => copyText(mcpConfig, setCopiedConfig)}>
                    <Copy className="h-4 w-4" />
                    {copiedConfig ? "已复制" : "复制配置"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  { label: "总请求", value: String(stats?.totalCount ?? "-") },
                  { label: "成功", value: String(stats?.successCount ?? "-") },
                  { label: "失败", value: String(stats?.failedCount ?? "-") },
                  { label: "ContextEngine", value: String(stats?.contextEngineCount ?? "-") },
                ].map((item) => (
                  <Card key={item.label} className="border-white/[0.06] bg-[#0d1424]/70 backdrop-blur-xl">
                    <CardContent className="p-5">
                      <p className="text-sm text-slate-400">{item.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-white/[0.06] bg-[#0d1424]/70 backdrop-blur-xl">
                <CardContent className="p-6">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-medium">请求日志</h2>
                      <p className="text-sm text-slate-400">最近请求明细与错误详情。</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm text-slate-400">
                        <input
                          type="checkbox"
                          checked={autoRefresh}
                          onChange={(event) => setAutoRefresh(event.target.checked)}
                          className="h-4 w-4 rounded border-white/[0.12] bg-transparent"
                        />
                        自动刷新
                      </label>
                      <Button variant="glass" size="sm" onClick={() => fetchLogs(logsPage || 1, true)}>
                        <RefreshCw className={cn("h-4 w-4", logsLoading && "animate-spin")} />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {logsLoading && !logsData ? (
                      <div className="rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/40 p-6 text-sm text-slate-400">
                        日志加载中...
                      </div>
                    ) : logsData?.logs.length ? (
                      logsData.logs.map((log) => (
                        <button
                          key={log.id}
                          type="button"
                          onClick={() => fetchLogDetail(log.id)}
                          className="w-full rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/40 p-4 text-left transition hover:border-cyan-400/40 hover:bg-[#0a0f1a]/60"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-medium text-white">{log.requestMethod} {log.requestPath}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {new Date(log.requestTimestamp).toLocaleString("zh-CN")} · {log.clientIp}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <Badge className={cn(
                                "px-3 py-1",
                                (log.statusCode || 0) >= 400
                                  ? "border-red-500/20 bg-red-500/10 text-red-300"
                                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                              )}>
                                {log.statusCode ?? log.status}
                              </Badge>
                              <span className="text-slate-400">{log.responseDurationMs ?? "-"} ms</span>
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/40 p-6 text-sm text-slate-400">
                        暂无请求日志。
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                    <span>
                      第 {logsPage} 页 {logsData?.pagination.total ? `· 共 ${logsData.pagination.total} 条` : ""}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="glass"
                        size="sm"
                        disabled={logsPage <= 1 || logsLoading}
                        onClick={() => fetchLogs(logsPage - 1)}
                      >
                        上一页
                      </Button>
                      <Button
                        variant="glass"
                        size="sm"
                        disabled={Boolean(logsData?.pagination.total && logsPage * 20 >= (logsData.pagination.total || 0)) || logsLoading}
                        onClick={() => fetchLogs(logsPage + 1)}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="profile">
            <div className="grid gap-4 md:grid-cols-2">
              <InfoItem label="用户 ID" value={user.id} />
              <InfoItem label="显示名称" value={user.name} />
              <InfoItem label="状态" value={user.status === "active" ? "启用" : "停用"} />
              <InfoItem label="管理员权限" value={user.isAdmin ? "是" : "否"} />
              <InfoItem label="备注" value={user.note || "-"} />
              <InfoItem label="注册时间" value={new Date(user.createdAt).toLocaleString("zh-CN")} />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="border-white/[0.08] bg-[#0d1424] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>确认退出登录？</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              退出后需要重新输入 API Key 才能访问控制台。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]">
              取消
            </AlertDialogCancel>
            <AlertDialogAction className="bg-red-500/80 text-white hover:bg-red-500" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> 退出登录
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {logDetail || detailLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-white/[0.08] bg-[#0d1424] p-6 shadow-2xl shadow-cyan-950/20">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">请求详情</h3>
                <p className="text-sm text-slate-400">查看错误详情与请求元数据。</p>
              </div>
              <Button variant="ghost" onClick={() => setLogDetail(null)}>关闭</Button>
            </div>
            {detailLoading && !logDetail ? (
              <div className="py-10 text-center text-slate-400">加载中...</div>
            ) : logDetail ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <InfoItem label="路径" value={logDetail.log.requestPath} />
                  <InfoItem label="方法" value={logDetail.log.requestMethod} />
                  <InfoItem label="状态码" value={String(logDetail.log.statusCode ?? logDetail.log.status)} />
                  <InfoItem label="耗时" value={`${logDetail.log.responseDurationMs ?? "-"} ms`} />
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/40 p-4">
                  <p className="text-sm font-medium text-white">错误详情</p>
                  {logDetail.errors.length ? (
                    <div className="mt-3 space-y-3">
                      {logDetail.errors.map((item) => (
                        <div key={item.id} className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
                          <p className="text-xs uppercase tracking-wide text-cyan-300">{item.source}</p>
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-200">{item.error}</pre>
                          <p className="mt-2 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("zh-CN")}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">该请求没有关联错误详情。</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
