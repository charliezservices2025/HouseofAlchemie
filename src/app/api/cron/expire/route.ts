import { db } from "@/lib/db";
import { safeEqual } from "@/lib/auth/crypto";

export const maxDuration = 30;

/**
 * GET /api/cron/expire
 *
 * Marks entitlements whose access window has closed as EXPIRED. Access
 * checks already ignore a past expiresAt, so this is bookkeeping: it keeps
 * Admin lists honest and makes "who lapsed this month" a plain query.
 * Runs daily from vercel.json. Vercel sends the CRON_SECRET as a bearer
 * token when that variable is set; without it the job is open but harmless.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token || !safeEqual(token, secret)) return new Response("forbidden", { status: 403 });
  }

  const now = new Date();
  const res = await db.entitlement.updateMany({
    where: { status: "ACTIVE", expiresAt: { lt: now } },
    data: { status: "EXPIRED" },
  });
  if (res.count) {
    await db.auditLog.create({
      data: { action: "entitlement.expire", targetType: "Entitlement", meta: { count: res.count, at: now.toISOString() } },
    });
  }
  return Response.json({ ok: true, expired: res.count, at: now.toISOString() });
}
