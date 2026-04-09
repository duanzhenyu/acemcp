"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CurrentUser } from "@/lib/types";

interface UseCurrentUserOptions {
  required?: boolean;
  adminOnly?: boolean;
}

export function useCurrentUser(options: UseCurrentUserOptions = {}) {
  const { required = false, adminOnly = false } = options;
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/me", {
        cache: "no-store",
        credentials: "same-origin",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setUser(null);
        setStatusCode(response.status);
        setError(data.error || "获取当前用户失败");

        if (required && (response.status === 401 || response.status === 403)) {
          await fetch("/api/logout", {
            method: "POST",
            credentials: "same-origin",
          }).catch(() => undefined);

          const reason = response.status === 403 ? "disabled" : "unauthorized";
          router.replace(`/login?reason=${reason}`);
        }

        return;
      }

      setUser(data.user || data);
      setStatusCode(200);
    } catch (fetchError) {
      console.error("Failed to fetch current user:", fetchError);
      setUser(null);
      setStatusCode(500);
      setError("无法获取当前登录状态");
    } finally {
      setIsLoading(false);
    }
  }, [required, router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isLoading && user && adminOnly && !user.isAdmin) {
      router.replace("/console");
    }
  }, [adminOnly, isLoading, router, user]);

  return {
    user,
    isLoading,
    statusCode,
    error,
    refresh,
  };
}
