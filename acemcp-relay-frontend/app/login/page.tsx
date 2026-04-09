"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, KeyRound, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState("请输入管理员分配的 API Key 登录控制台。");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get("reason");
    if (reason === "disabled") {
      setHint("当前账号已被停用，请联系管理员。");
      return;
    }
    if (reason === "unauthorized") {
      setHint("登录状态已失效，请重新输入 API Key。");
      return;
    }
    setHint("请输入管理员分配的 API Key 登录控制台。");
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "登录失败");
        return;
      }

      router.push("/console");
      router.refresh();
    } catch (loginError) {
      console.error("Login failed:", loginError);
      setError("无法连接服务器，请稍后再试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0f1a] px-4 animate-page-fade-in">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute left-1/4 top-1/3 h-[260px] w-[360px] rounded-full bg-cyan-500/25 blur-[110px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[220px] w-[320px] rounded-full bg-blue-500/20 blur-[100px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="relative w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#0d1424]/90 p-8 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">
            <KeyRound className="h-6 w-6 text-cyan-300" />
            ACE Relay
          </Link>
          <p className="mt-3 text-sm font-light text-slate-400">{hint}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="apiKey" className="text-sm text-slate-300">
              API Key
            </label>
            <input
              id="apiKey"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="ace_xxxxxxxxxxxxxxxxx"
              className="w-full rounded-xl border border-white/[0.08] bg-[#0a0f1a]/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            variant="gradient"
            size="lg"
            disabled={loading || !apiKey.trim()}
            className="w-full rounded-xl"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {loading ? "登录中..." : "使用 API Key 登录"}
          </Button>
        </form>

        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-xs leading-6 text-slate-400">
          <p>• LinuxDo OAuth 已停用</p>
          <p>• 新用户需由管理员在用户管理后台创建</p>
          <p>• 如忘记密钥，请联系管理员重置</p>
        </div>

        <div className="mt-8 text-center">
          <Button
            variant="ghost"
            asChild
            className="rounded-full border border-white/[0.06] bg-white/[0.02] font-light text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
          >
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
