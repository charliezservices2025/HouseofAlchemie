import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "./crypto";

export const SESSION_COOKIE = "hoa_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_RENEW_BELOW_MS = 15 * 24 * 60 * 60 * 1000;
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export async function requestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : h.get("x-real-ip") ?? undefined;
  const userAgent = h.get("user-agent")?.slice(0, 255) ?? undefined;
  return { ip, userAgent };
}

/**
 * Creates a session row and sets the cookie. The database stores only the
 * SHA-256 of the raw token, so a database read cannot be replayed as a login.
 */
export async function createSession(userId: string) {
  const raw = randomToken(32);
  const id = sha256(raw);
  const { ip, userAgent } = await requestMeta();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({
    data: { id, userId, expiresAt, ip, userAgent },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    expires: expiresAt,
  });

  return { id, expiresAt };
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: 0,
  });
}

/**
 * Reads the cookie, validates the session, renews it when it is over half
 * used, and returns the user. Cached per request so layouts and pages share
 * one lookup.
 */
export const getSession = cache(async () => {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const id = sha256(raw);
  const session = await db.session.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  const now = Date.now();
  const updates: { expiresAt?: Date; lastSeenAt?: Date } = {};
  if (session.expiresAt.getTime() - now < SESSION_RENEW_BELOW_MS) {
    updates.expiresAt = new Date(now + SESSION_TTL_MS);
  }
  if (now - session.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
    updates.lastSeenAt = new Date(now);
  }
  if (Object.keys(updates).length > 0) {
    // Fire and forget. A failed touch must never block a page.
    db.session.update({ where: { id }, data: updates }).catch(() => {});
  }

  return { session, user: session.user, sessionId: id };
});

export async function revokeSession(sessionId: string) {
  await db.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await db.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

export async function listActiveSessions(userId: string) {
  return db.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, createdAt: true, lastSeenAt: true, userAgent: true, ip: true },
  });
}
