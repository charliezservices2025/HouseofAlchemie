import "server-only";
import { db } from "@/lib/db";
import type { AuthTokenType } from "@/generated/prisma/client";
import { randomToken, sha256 } from "./crypto";

const TTL_MINUTES: Record<AuthTokenType, number> = {
  VERIFY_EMAIL: 60 * 24,
  RESET_PASSWORD: 60,
  SET_PASSWORD: 60 * 24 * 7,
};

/**
 * Issues a single use token. Any earlier unused tokens of the same type for
 * the user are invalidated, so only the most recent email link works.
 */
export async function issueToken(userId: string, type: AuthTokenType) {
  const raw = randomToken(32);
  const tokenHash = sha256(raw);
  const expiresAt = new Date(Date.now() + TTL_MINUTES[type] * 60 * 1000);

  await db.$transaction([
    db.authToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.authToken.create({ data: { userId, type, tokenHash, expiresAt } }),
  ]);

  return raw;
}

/**
 * Consumes a token. Returns the user id on success, null if the token is
 * unknown, expired, or already used. The consume is atomic so two tabs cannot
 * both succeed.
 */
export async function consumeToken(raw: string, type: AuthTokenType): Promise<string | null> {
  if (!raw || raw.length > 200) return null;
  const tokenHash = sha256(raw);
  const now = new Date();

  const result = await db.authToken.updateMany({
    where: { tokenHash, type, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (result.count !== 1) return null;

  const token = await db.authToken.findUnique({ where: { tokenHash }, select: { userId: true } });
  return token?.userId ?? null;
}

/** Looks without consuming, so a reset page can show a friendly error before the form. */
export async function peekToken(raw: string, type: AuthTokenType): Promise<boolean> {
  if (!raw || raw.length > 200) return false;
  const token = await db.authToken.findUnique({
    where: { tokenHash: sha256(raw) },
    select: { type: true, usedAt: true, expiresAt: true },
  });
  return !!token && token.type === type && !token.usedAt && token.expiresAt.getTime() > Date.now();
}
