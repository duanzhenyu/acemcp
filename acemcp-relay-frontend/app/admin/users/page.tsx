"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  UserCog,
  UserMinus,
  UserPlus,
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
import { cn } from "@/lib/utils";
import type { ContextUsagePoint, ManagedUserListItem, StatsRangePreset } from "@/lib/types";

interface UsersResponse {
  range: {
    preset: StatsRangePreset;
    label: string;
    startAt: string;
    endAt: string;
  };
  users: ManagedUserListItem[];
}

interface UserStatsResponse {
  range: {
    preset: StatsRangePreset;
    label: string;
    startAt: string;
    endAt: string;
  };
  totalCount: number;
  series: ContextUsagePoint[];
}

interface UserFormState {
  name: string;
  note: string;
  status: "active" | "disabled";
}

const presetOptions: Array<{ key: StatsRangePreset; label: string }> = [
  { key: "today", label: "今天" },
  { key: "7d", label: "近 7 天" },
  { key: "month", label: "本月" },
  { key: "custom", label: "自定义" },
];

function formatDateInput(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(date);
}

function makeDefaultCustomRange() {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  return {
    start: formatDateInput(sevenDaysAgo),
    end: formatDateInput(today),
  };
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, isLoading } = useCurrentUser({ required: true, adminOnly: true });
  const [users, setUsers] = useState<ManagedUserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [preset, setPreset] = useState<StatsRangePreset>("today");
  const [customRange, setCustomRange] = useState(makeDefaultCustomRange());
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUserListItem | null>(null);
  const [formState, setFormState] = useState<UserFormState>({ name: "", note: "", status: "active" });
  const [submitting, setSubmitting] = useState(false);
  const [secretNotice, setSecretNotice] = useState<{ title: string; apiKey: string } | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    | { type: "reset"; target: ManagedUserListItem }
    | { type: "toggle"; target: ManagedUserListItem }
    | null
  >(null);

  const rangeQuery = useMemo(() => {
    const params = new URLSearchParams({ preset });
    if (preset === "custom") {
      params.set("start", customRange.start);
      params.set("end", customRange.end);
    }
    return params.toString();
  }, [customRange.end, customRange.start, preset]);

  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedUserId) || null,
    [selectedUserId, users]
  );

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users?${rangeQuery}`, { cache: "no-store" });
      if (!response.ok) return;
      const data: UsersResponse = await response.json();
      setUsers(data.users || []);
      setSelectedUserId((current) => {
        if (current && data.users.some((item) => item.id === current)) {
          return current;
        }
        return data.users[0]?.id || null;
      });
    } catch (error) {
      console.error("获取用户列表失败:", error);
    } finally {
      setLoading(false);
    }
  }, [rangeQuery]);

  const fetchStats = useCallback(async (targetUserId: string) => {
    setStatsLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${targetUserId}/stats?${rangeQuery}`, { cache: "no-store" });
      if (!response.ok) return;
      const data: UserStatsResponse = await response.json();
      setStats(data);
    } catch (error) {
      console.error("获取用户统计失败:", error);
    } finally {
      setStatsLoading(false);
    }
  }, [rangeQuery]);

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [fetchUsers, user]);

  useEffect(() => {
    if (selectedUserId) {
      fetchStats(selectedUserId);
    } else {
      setStats(null);
    }
  }, [fetchStats, selectedUserId]);

  useEffect(() => {
    setSecretCopied(false);
  }, [secretNotice]);

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const handleCopySecret = async () => {
    if (!secretNotice) return;

    try {
      await navigator.clipboard.writeText(secretNotice.apiKey);
      setSecretCopied(true);
      window.setTimeout(() => setSecretCopied(false), 1500);
    } catch (error) {
      console.error("复制密钥失败:", error);
    }
  };

  const openCreateForm = () => {
    setEditingUser(null);
    setFormState({ name: "", note: "", status: "active" });
    setShowForm(true);
  };

  const openEditForm = (target: ManagedUserListItem) => {
    setEditingUser(target);
    setFormState({
      name: target.name,
      note: target.note || "",
      status: target.status,
    });
    setShowForm(true);
  };

  const handleSubmitForm = async () => {
    if (!formState.name.trim()) return;

    setSubmitting(true);
    try {
      if (editingUser) {
        const response = await fetch(`/api/admin/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formState),
        });
        if (!response.ok) return;
      } else {
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formState),
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data.apiKey) {
          setSecretNotice({ title: `新用户 ${data.user.name} 的 API Key`, apiKey: data.apiKey });
        }
      }

      setShowForm(false);
      await fetchUsers();
    } catch (error) {
      console.error("保存用户失败:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;

    try {
      if (pendingAction.type === "reset") {
        const response = await fetch(`/api/admin/users/${pendingAction.target.id}/reset-key`, {
          method: "POST",
        });
        if (!response.ok) return;
        const data = await response.json();
        setSecretNotice({ title: `${pendingAction.target.name} 的新 API Key`, apiKey: data.apiKey });
      }

      if (pendingAction.type === "toggle") {
        await fetch(`/api/admin/users/${pendingAction.target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: pendingAction.target.status === "active" ? "disabled" : "active",
          }),
        });
      }

      await fetchUsers();
      if (selectedUserId) {
        await fetchStats(selectedUserId);
      }
    } catch (error) {
      console.error("执行管理员操作失败:", error);
    } finally {
      setPendingAction(null);
    }
  };

  const summary = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((item) => item.status === "active").length,
      disabled: users.filter((item) => item.status === "disabled").length,
      contextTotal: users.reduce((total, item) => total + item.contextEngineCount, 0),
    };
  }, [users]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a] text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <DashboardHeader
        currentPath="/admin/users"
        isAdmin={user.isAdmin}
        userName={user.name}
        onLogout={handleLogout}
        rightSlot={
          <Button variant="ghost" size="sm" onClick={fetchUsers}>
            <RefreshCw className={cn("h-4 w-4 text-slate-300", loading && "animate-spin")} />
          </Button>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
              <Shield className="h-3.5 w-3.5" /> 管理员后台
            </div>
            <h1 className="mt-4 text-3xl font-semibold">用户管理</h1>
            <p className="mt-2 text-sm text-slate-400">创建、编辑、停用用户并查看 ContextEngine 调用统计。</p>
          </div>
          <Button variant="gradient" onClick={openCreateForm}>
            <Plus className="h-4 w-4" /> 新增用户
          </Button>
        </div>

        {secretNotice ? (
          <Card className="mb-6 border-emerald-500/20 bg-emerald-500/10 backdrop-blur-xl">
            <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-200">{secretNotice.title}</p>
                <p className="mt-2 break-all font-mono text-sm text-white">{secretNotice.apiKey}</p>
                <p className="mt-2 text-xs text-emerald-100/70">该密钥只在当前页面展示一次，请立即复制保存。</p>
              </div>
              <div className="flex gap-2">
                <Button variant="glass" onClick={handleCopySecret}>
                  <Copy className="h-4 w-4" /> {secretCopied ? "已复制" : "复制密钥"}
                </Button>
                <Button variant="ghost" onClick={() => setSecretNotice(null)}>
                  关闭
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          {[
            { label: "总用户数", value: summary.total, icon: UserCog },
            { label: "启用中", value: summary.active, icon: UserPlus },
            { label: "已停用", value: summary.disabled, icon: UserMinus },
            { label: "区间调用总数", value: summary.contextTotal, icon: KeyRound },
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

        <Card className="mb-6 border-white/[0.06] bg-[#0d1424]/70 backdrop-blur-xl">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-medium">统计筛选</h2>
              <p className="text-sm text-slate-400">范围仅统计 request_logs 中 /agents/codebase-retrieval 的全部请求。</p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex flex-wrap gap-2">
                {presetOptions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPreset(item.key)}
                    className={cn(
                      "rounded-xl border px-4 py-2 text-sm transition",
                      preset === item.key
                        ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-300"
                        : "border-white/[0.06] bg-white/[0.03] text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {preset === "custom" ? (
                <div className="flex flex-wrap gap-2">
                  <input
                    type="date"
                    value={customRange.start}
                    onChange={(event) => setCustomRange((current) => ({ ...current, start: event.target.value }))}
                    className="rounded-xl border border-white/[0.08] bg-[#0a0f1a]/60 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                  />
                  <input
                    type="date"
                    value={customRange.end}
                    onChange={(event) => setCustomRange((current) => ({ ...current, end: event.target.value }))}
                    className="rounded-xl border border-white/[0.08] bg-[#0a0f1a]/60 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                  />
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
          <Card className="border-white/[0.06] bg-[#0d1424]/70 backdrop-blur-xl">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium">用户列表</h2>
                  <p className="text-sm text-slate-400">点击用户查看当前筛选范围内的 ContextEngine 统计。</p>
                </div>
              </div>

              <div className="space-y-3">
                {loading && users.length === 0 ? (
                  <div className="rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/40 p-6 text-center text-slate-400">
                    用户数据加载中...
                  </div>
                ) : users.length === 0 ? (
                  <div className="rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/40 p-6 text-center text-slate-400">
                    暂无用户数据
                  </div>
                ) : (
                  users.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-2xl border p-4 transition",
                        selectedUserId === item.id
                          ? "border-cyan-400/40 bg-cyan-500/10"
                          : "border-white/[0.06] bg-[#0a0f1a]/40"
                      )}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <button
                          type="button"
                          className="flex-1 text-left"
                          onClick={() => setSelectedUserId(item.id)}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-medium text-white">{item.name}</p>
                            <Badge className={cn(
                              "px-2.5 py-0.5",
                              item.status === "active"
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                : "border-red-500/20 bg-red-500/10 text-red-300"
                            )}>
                              {item.status === "active" ? "启用" : "停用"}
                            </Badge>
                            {item.isAdmin ? (
                              <Badge className="border-purple-500/20 bg-purple-500/10 px-2.5 py-0.5 text-purple-300">
                                <Shield className="h-3 w-3" /> 管理员
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-slate-400">{item.note || "暂无备注"}</p>
                          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                            <span>ID: {item.id}</span>
                            <span>Key: {item.maskedApiKey || "未分配"}</span>
                            <span>调用数: {item.contextEngineCount}</span>
                          </div>
                        </button>

                        <div className="flex flex-wrap gap-2 lg:w-[280px] lg:justify-end">
                          <Button variant="glass" size="sm" onClick={() => openEditForm(item)}>
                            编辑
                          </Button>
                          <Button variant="warning" size="sm" onClick={() => setPendingAction({ type: "reset", target: item })}>
                            重置 Key
                          </Button>
                          <Button
                            variant={item.status === "active" ? "danger" : "glass"}
                            size="sm"
                            disabled={item.id === user.id}
                            onClick={() => setPendingAction({ type: "toggle", target: item })}
                          >
                            {item.status === "active" ? "停用" : "启用"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/[0.06] bg-[#0d1424]/70 backdrop-blur-xl">
            <CardContent className="space-y-4 p-6">
              <div>
                <h2 className="text-lg font-medium">用户统计</h2>
                <p className="text-sm text-slate-400">当前所选用户在筛选区间内的 ContextEngine 请求总数。</p>
              </div>

              {selectedUser ? (
                <>
                  <div className="rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/40 p-4">
                    <p className="text-xs text-slate-500">当前用户</p>
                    <p className="mt-2 text-xl font-semibold text-white">{selectedUser.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{selectedUser.id}</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/40 p-4">
                    <p className="text-xs text-slate-500">区间总调用数</p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      {statsLoading ? "..." : stats?.totalCount ?? 0}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{stats?.range.label || ""}</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/40 p-4">
                    <p className="text-sm font-medium text-white">按天分布</p>
                    <div className="mt-3 space-y-2">
                      {statsLoading ? (
                        <p className="text-sm text-slate-400">统计加载中...</p>
                      ) : stats?.series.length ? (
                        stats.series.map((point) => (
                          <div key={point.date} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-sm">
                            <span className="text-slate-400">{point.date}</span>
                            <span className="font-medium text-white">{point.count}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">当前时间范围内无请求。</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/40 p-6 text-center text-slate-400">
                  请选择左侧用户查看统计
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/[0.08] bg-[#0d1424] p-6 shadow-2xl shadow-cyan-950/20">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">{editingUser ? "编辑用户" : "新增用户"}</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {editingUser ? "修改名称、备注和启用状态。" : "创建用户后会自动生成一条 API Key。"}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setShowForm(false)}>关闭</Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-300">名称</label>
                <input
                  value={formState.name}
                  onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#0a0f1a]/60 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
                  placeholder="例如：Alice"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">备注</label>
                <textarea
                  value={formState.note}
                  onChange={(event) => setFormState((current) => ({ ...current, note: event.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#0a0f1a]/60 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
                  placeholder="可填写用途、来源或团队备注"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">状态</label>
                <select
                  value={formState.status}
                  onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as "active" | "disabled" }))}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#0a0f1a]/60 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
                >
                  <option value="active">启用</option>
                  <option value="disabled">停用</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="glass" onClick={() => setShowForm(false)}>
                取消
              </Button>
              <Button variant="gradient" disabled={submitting || !formState.name.trim()} onClick={handleSubmitForm}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingUser ? "保存修改" : "创建并生成 Key"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent className="border-white/[0.08] bg-[#0d1424] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === "reset" ? "确认重置 API Key？" : pendingAction?.target.status === "active" ? "确认停用用户？" : "确认启用用户？"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {pendingAction?.type === "reset"
                ? "旧密钥会立即失效，并清理 Redis 缓存。"
                : pendingAction?.target.status === "active"
                  ? "停用后该用户将无法登录前端，relay Bearer Token 也会失效。"
                  : "启用后该用户可以再次使用已分配的 API Key 登录和调用 relay。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]">
              取消
            </AlertDialogCancel>
            <AlertDialogAction className="bg-cyan-500 text-white hover:bg-cyan-400" onClick={handleConfirmAction}>
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
