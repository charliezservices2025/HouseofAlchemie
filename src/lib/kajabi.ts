import "server-only";
import { db } from "@/lib/db";
import { issueToken } from "@/lib/auth/tokens";
import { sendEmail, setPasswordMail } from "@/lib/email";
import { safeEqual } from "@/lib/auth/crypto";

export type NormalisedKajabiEvent = {
  eventType: string;
  action: "grant" | "revoke" | "ignore";
  memberEmail: string | null;
  memberName: string | null;
  memberId: string | null;
  offerId: string | null;
  offerTitle: string | null;
};

function dig(obj: unknown, paths: string[]): string | null {
  for (const path of paths) {
    let cur: unknown = obj;
    for (const key of path.split(".")) {
      if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[key];
      } else {
        cur = undefined;
        break;
      }
    }
    if (typeof cur === "string" && cur.trim()) return cur.trim();
    if (typeof cur === "number") return String(cur);
  }
  return null;
}

/**
 * Kajabi's webhook payloads vary by event and by how the automation was set
 * up, so the shape is discovered rather than assumed. The raw payload is kept
 * on the KajabiEvent row for anything this misses.
 */
export function normaliseKajabiPayload(payload: unknown, headerEvent?: string | null): NormalisedKajabiEvent {
  const eventType = (
    headerEvent ??
    dig(payload, ["event", "event_type", "type", "topic", "name"]) ??
    "unknown"
  ).toLowerCase();

  const memberEmail = dig(payload, [
    "data.member.email", "member.email", "data.contact.email", "contact.email", "data.email", "email", "customer.email", "data.customer.email", "payload.member.email",
  ])?.toLowerCase() ?? null;
  const memberName = dig(payload, ["data.member.name", "member.name", "data.contact.name", "contact.name", "name", "data.name", "customer.name"]);
  const memberId = dig(payload, ["data.member.id", "member.id", "data.contact.id", "contact.id", "member_id", "data.member_id"]);
  const offerId = dig(payload, ["data.offer.id", "offer.id", "data.offer_id", "offer_id", "data.product.id", "product.id", "purchase.offer.id", "data.purchase.offer.id"]);
  const offerTitle = dig(payload, ["data.offer.title", "offer.title", "data.offer.name", "offer.name", "data.product.title", "product.title"]);

  let action: NormalisedKajabiEvent["action"] = "ignore";
  if (/purchase|grant|created|activated|subscri|paid|success/.test(eventType) && !/cancel|revok|refund|fail|expir|remov/.test(eventType)) {
    action = "grant";
  } else if (/cancel|revok|refund|expir|remov|deactivat|fail/.test(eventType)) {
    action = "revoke";
  }

  return { eventType, action, memberEmail, memberName, memberId, offerId, offerTitle };
}

export function kajabiSecretMatches(provided: string | null): boolean {
  const expected = process.env.KAJABI_WEBHOOK_SECRET;
  if (!expected || !provided) return false;
  return safeEqual(provided, expected);
}

/**
 * Applies a normalised event: grants or revokes the entitlement mapped to
 * the Kajabi offer. New subscribers are created without a password and sent
 * a set password link, so a person can buy on Kajabi and be talking to their
 * advisor within minutes.
 */
export async function applyKajabiEvent(eventId: string, ev: NormalisedKajabiEvent): Promise<string> {
  if (ev.action === "ignore") return `ignored event type "${ev.eventType}"`;
  if (!ev.memberEmail) return "no member email in payload";
  if (!ev.offerId) return "no offer id in payload";

  // One Kajabi offer can grant several things. Every specialist plan on the
  // sales page "includes Evren", so Lyra's offer id appears on both Lyra and
  // Evren, and a suite offer id appears on the suite.
  const [advisors, suites] = await Promise.all([
    db.advisor.findMany({ where: { kajabiOfferIds: { has: ev.offerId } } }),
    db.suite.findMany({ where: { kajabiOfferIds: { has: ev.offerId } } }),
  ]);
  if (!advisors.length && !suites.length) {
    return `offer ${ev.offerId} (${ev.offerTitle ?? "untitled"}) is not mapped to an advisor or suite`;
  }

  const targets = [
    ...advisors.map((a) => ({ advisorId: a.id as string | undefined, suiteId: undefined as string | undefined, name: a.name })),
    ...suites.map((s) => ({ advisorId: undefined as string | undefined, suiteId: s.id as string | undefined, name: s.name })),
  ];
  const names = targets.map((t) => t.name).join(", ");

  if (ev.action === "revoke") {
    let count = 0;
    for (const t of targets) {
      const res = await db.entitlement.updateMany({
        where: {
          user: { email: ev.memberEmail },
          status: "ACTIVE",
          source: "KAJABI",
          kajabiOfferId: ev.offerId,
          ...(t.advisorId ? { advisorId: t.advisorId } : { suiteId: t.suiteId }),
        },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
      count += res.count;
    }
    return `revoked ${count} entitlement(s) for ${names}`;
  }

  // grant
  let user = await db.user.findUnique({ where: { email: ev.memberEmail } });
  let isNew = false;
  if (!user) {
    user = await db.user.create({
      data: { email: ev.memberEmail, name: ev.memberName, emailVerifiedAt: new Date() },
    });
    isNew = true;
  } else if (!user.emailVerifiedAt) {
    // A Kajabi purchase proves the address is real.
    user = await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  }

  let granted = 0;
  for (const t of targets) {
    const existing = await db.entitlement.findFirst({
      where: { userId: user.id, status: "ACTIVE", kajabiOfferId: ev.offerId, ...(t.advisorId ? { advisorId: t.advisorId } : { suiteId: t.suiteId }) },
    });
    if (existing) continue;
    await db.entitlement.create({
      data: {
        userId: user.id,
        ...(t.advisorId ? { advisorId: t.advisorId } : { suiteId: t.suiteId }),
        source: "KAJABI",
        kajabiOfferId: ev.offerId,
        kajabiMemberId: ev.memberId,
        note: ev.offerTitle ?? undefined,
      },
    });
    granted += 1;
  }

  // The most specific thing they bought is the one the welcome email names.
  const headline = suites[0]?.name ?? advisors.find((a) => a.slug !== "evren")?.name ?? advisors[0]?.name ?? "your advisor";

  if (isNew || !user.passwordHash) {
    const raw = await issueToken(user.id, "SET_PASSWORD");
    await sendEmail(setPasswordMail(user.email, raw, headline));
    return `granted ${names}; ${isNew ? "created account and " : ""}sent set password email`;
  }
  return granted ? `granted ${names}` : `already had ${names}`;
}
