import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getWebSessionSecret, getWebSessionTtlMs, WEB_SESSION_COOKIE_NAME } from "@/lib/config";
import { getManagedUserById, initDB } from "@/lib/db";
import { isConfiguredAdminUserId } from "@/lib/config";
import type { CurrentUser } from "@/lib/types";

interface SessionPayload {
  userId: string;
  expiresAt: number;
}

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(payloadBase64: string): string {
  return crypto
    .createHmac("sha256", getWebSessionSecret())
    .update(payloadBase64)
    .digest("base64url");
}

export function createSessionToken(userId: string): string {
  const payload: SessionPayload = {
    userId,
    expiresAt: Date.now() + getWebSessionTtlMs(),
  };
  const payloadBase64 = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;

  const [payloadBase64, signature] = token.split(".");
  if (!payloadBase64 || !signature) return null;

  const expectedSignature = signPayload(payloadBase64);
  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(signature);

  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(payloadBase64)) as SessionPayload;
    if (!payload.userId || !payload.expiresAt || payload.expiresAt <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function normalizeCurrentUser(user: Awaited<ReturnType<typeof getManagedUserById>>): CurrentUser | null {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    note: user.note,
    status: user.status,
    isAdmin: isConfiguredAdminUserId(user.id),
    email: user.email,
    image: user.image,
    username: user.username,
    trustLevel: user.trustLevel,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function getCurrentSessionUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(WEB_SESSION_COOKIE_NAME)?.value;
  const payload = verifySessionToken(token);

  if (!payload) {
    return null;
  }

  await initDB();
  const user = await getManagedUserById(payload.userId);
  if (!user || user.status !== "active") {
    return null;
  }

  return normalizeCurrentUser(user);
}

export function applySessionCookie(response: NextResponse, userId: string) {
  const maxAge = Math.floor(getWebSessionTtlMs() / 1000);
  response.cookies.set({
    name: WEB_SESSION_COOKIE_NAME,
    value: createSessionToken(userId),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: WEB_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
