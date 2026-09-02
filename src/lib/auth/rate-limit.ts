import "server-only";
import { db } from "@/lib/db";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_PER_EMAIL = 5;
const MAX_FAILED_PER_IP = 25;
const LOCKOUT_MS = 15 * 60 * 1000;

export type RateDecision =
  | { allowed: true }
  | { allowed: false; reason: "email" | "ip" | "locked"; retryAt: Date };

/**
 * Sign in protection, all server side:
 *  - five failed attempts for one email inside fifteen minutes locks that account for fifteen minutes
 *  - twenty five failed attempts from one IP inside fifteen minutes blocks that IP for fifteen minutes
 * Success resets the account counter. Nothing here depends on the browser behaving.
 */
export async function checkSignInAllowed(email: string, ip?: string): Promise<RateDecision> {
  const since = new Date(Date.now() - WINDOW_MS);

  const user = await db.user.findUnique({
    where: { email },
    select: { lockedUntil: true },
  });
  if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return { allowed: false, reason: "locked", retryAt: user.lockedUntil };
  }

  const [emailFails, ipFails] = await Promise.all([
    db.loginAttempt.count({ where: { key: `email:${email}`, succeeded: false, createdAt: { gt: since } } }),
    ip ? db.loginAttempt.count({ where: { key: `ip:${ip}`, succeeded: false, createdAt: { gt: since } } }) : 0,
  ]);

  if (emailFails >= MAX_FAILED_PER_EMAIL) {
    return { allowed: false, reason: "email", retryAt: new Date(Date.now() + LOCKOUT_MS) };
  }
  if (ipFails >= MAX_FAILED_PER_IP) {
    return { allowed: false, reason: "ip", retryAt: new Date(Date.now() + LOCKOUT_MS) };
  }
  return { allowed: true };
}

export async function recordSignInAttempt(email: string, ip: string | undefined, succeeded: boolean) {
  const rows = [{ key: `email:${email}`, succeeded }];
  if (ip) rows.push({ key: `ip:${ip}`, succeeded });
  await db.loginAttempt.createMany({ data: rows });

  if (succeeded) {
    await db.user.updateMany({
      where: { email },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    return;
  }

  const user = await db.user.findUnique({ where: { email }, select: { id: true, failedLoginCount: true } });
  if (!user) return;
  const failed = user.failedLoginCount + 1;
  await db.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: failed,
      lockedUntil: failed >= MAX_FAILED_PER_EMAIL ? new Date(Date.now() + LOCKOUT_MS) : null,
    },
  });
}

/**
 * Generic per key limiter for other sensitive endpoints (password reset
 * requests, verification resends). Returns true when the call may proceed.
 */
export async function allowAction(key: string, maxInWindow: number, windowMs = WINDOW_MS): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const count = await db.loginAttempt.count({ where: { key, createdAt: { gt: since } } });
  if (count >= maxInWindow) return false;
  await db.loginAttempt.create({ data: { key, succeeded: true } });
  return true;
}

/** Housekeeping, safe to call from a cron. */
export async function pruneOldAttempts() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
