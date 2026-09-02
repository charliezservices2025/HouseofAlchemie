import { db } from "@/lib/db";
import { applyKajabiEvent, kajabiSecretMatches, normaliseKajabiPayload } from "@/lib/kajabi";

export const maxDuration = 30;

/**
 * POST /api/kajabi/webhook?token=KAJABI_WEBHOOK_SECRET
 *
 * Kajabi does not sign webhooks, so the URL carries a long random secret.
 * Every call is stored verbatim before it is interpreted, which is what makes
 * a grant or revoke auditable later, and what lets an unmapped offer be mapped
 * in Admin and replayed.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const provided = url.searchParams.get("token") ?? req.headers.get("x-webhook-token");
  if (!kajabiSecretMatches(provided)) {
    return new Response("forbidden", { status: 403 });
  }

  let payload: unknown = null;
  const raw = await req.text();
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { unparsed: raw.slice(0, 4000) };
  }

  const ev = normaliseKajabiPayload(payload, req.headers.get("x-kajabi-event") ?? req.headers.get("x-event-type"));
  const row = await db.kajabiEvent.create({
    data: {
      eventType: ev.eventType,
      memberEmail: ev.memberEmail,
      offerId: ev.offerId,
      payload: (payload ?? {}) as object,
    },
  });

  let note: string;
  try {
    note = await applyKajabiEvent(row.id, ev);
    await db.kajabiEvent.update({ where: { id: row.id }, data: { processedAt: new Date(), error: ev.action === "ignore" ? null : (note.startsWith("offer") || note.startsWith("no ") ? note : null) } });
  } catch (err) {
    note = err instanceof Error ? err.message : "failed";
    await db.kajabiEvent.update({ where: { id: row.id }, data: { error: note } });
    // 200 so Kajabi does not retry storm; the row is flagged for admin.
  }

  return Response.json({ ok: true, id: row.id, result: note });
}

export async function GET() {
  return new Response("House of Alchemie Kajabi webhook. POST only.", { status: 405 });
}
