const DEFAULT_WEB_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function parseDurationPart(unit: string): number {
  switch (unit) {
    case "ms":
      return 1;
    case "s":
      return 1000;
    case "m":
      return 60 * 1000;
    case "h":
      return 60 * 60 * 1000;
    case "d":
      return 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

export function parseDurationMs(
  value: string | undefined,
  fallbackMs: number = DEFAULT_WEB_SESSION_TTL_MS
): number {
  if (!value) return fallbackMs;

  const matches = [...value.matchAll(/(\d+)(ms|s|m|h|d)/g)];
  if (matches.length === 0) return fallbackMs;

  const consumed = matches.map((match) => match[0]).join("");
  if (consumed !== value) return fallbackMs;

  const totalMs = matches.reduce((total, match) => {
    const amount = Number.parseInt(match[1], 10);
    const multiplier = parseDurationPart(match[2]);
    return total + amount * multiplier;
  }, 0);

  return totalMs > 0 ? totalMs : fallbackMs;
}

export function getWebSessionTtlMs(): number {
  return parseDurationMs(process.env.WEB_SESSION_TTL, DEFAULT_WEB_SESSION_TTL_MS);
}

function splitCsv(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getConfiguredAdminUserIds(): string[] {
  const ids = new Set(splitCsv(process.env.ADMIN_USER_IDS));
  const bootstrapUserId = process.env.BOOTSTRAP_ADMIN_USER_ID?.trim() || "admin";

  if (process.env.BOOTSTRAP_ADMIN_API_KEY?.trim()) {
    ids.add(bootstrapUserId);
  }

  return [...ids];
}

export function isConfiguredAdminUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return getConfiguredAdminUserIds().includes(userId);
}

export function getBootstrapAdminConfig(): {
  userId: string;
  name: string;
  note: string;
  apiKey: string | null;
} {
  return {
    userId: process.env.BOOTSTRAP_ADMIN_USER_ID?.trim() || "admin",
    name: process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "ACE Admin",
    note: process.env.BOOTSTRAP_ADMIN_NOTE?.trim() || "Bootstrap administrator",
    apiKey: process.env.BOOTSTRAP_ADMIN_API_KEY?.trim() || null,
  };
}

export function getWebSessionSecret(): string {
  return (
    process.env.WEB_SESSION_SECRET?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    "ace-relay-dev-session-secret"
  );
}

export const WEB_SESSION_COOKIE_NAME = "ace_console_session";
export const SHANGHAI_TIMEZONE = "Asia/Shanghai";
export const CONTEXT_ENGINE_PATH = "/agents/codebase-retrieval";
