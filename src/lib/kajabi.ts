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
  /** The first offer in the event. Kept on the event row for the admin list. */
  offerId: string | null;
  /** Every offer in the event. A Kajabi Cart order can carry several. */
  offerIds: string[];
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

function digArray(obj: unknown, paths: string[]): Record<string, unknown>[] {
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
    if (Array.isArray(cur)) return cur.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
  }
  return [];
}

/**
 * Kajabi's native webhooks (Payment Succeeded, Cart Purchase, Purchase
 * Created) send the member as `member` and the offer as `offer`, or for
 * Cart orders as an `order_items` array. Zapier or Make relays flatten
 * that into `email` and `offer_id`. Every path is tried so a change on
 * Kajabi's side degrades to an unmapped row, never a lost purchase. The
 * raw payload is kept on the KajabiEvent row for anything this misses.
 */
export function normaliseKajabiPayload(payload: unknown, headerEvent?: string | null): NormalisedKajabiEvent {
  const eventType = (
    headerEvent ??
    dig(payload, ["event", "event_type", "type", "topic", "name"]) ??
    "unknown"
  ).toLowerCase();

  const memberEmail = dig(payload, [
    "member.email", "Member.email", "data.member.email", "payload.member.email",
    "contact.email", "data.contact.email", "customer.email", "data.customer.email",
    "member_email", "data.member_email", "customer_email", "data.email", "email",
  ])?.toLowerCase() ?? null;
  const memberName = dig(payload, [
    "member.name", "Member.name", "data.member.name", "payload.member.name",
    "contact.name", "data.contact.name", "customer.name", "member_name", "name", "data.name",
  ]);
  const memberId = dig(payload, [
    "member.id", "Member.id", "data.member.id", "payload.member.id",
    "contact.id", "data.contact.id", "member_id", "data.member_id",
  ]);

  const singleOfferId = dig(payload, [
    "offer.id", "data.offer.id", "payload.offer.id", "offer_id", "data.offer_id", "payload.offer_id",
    "product.id", "data.product.id", "purchase.offer.id", "data.purchase.offer.id",
  ]);
  const singleOfferTitle = dig(payload, [
    "offer.title", "data.offer.title", "payload.offer.title", "offer.name", "data.offer.name",
    "offer_title", "product.title", "data.product.title",
  ]);

  // Cart orders: one event, several offers.
  const items = digArray(payload, ["order_items", "data.order_items", "payload.order_items", "order.order_items", "line_items", "items"]);
  const cartOffers = items
    .filter((it) => {
      const type = typeof it.type === "string" ? it.type.toLowerCase() : "";
      return !type || type.includes("offer");
    })
    .map((it) => ({ id: dig(it, ["id", "offer_id", "offer.id"]), title: dig(it, ["title", "name", "offer.title"]) }))
    .filter((it): it is { id: string; title: string | null } => !!it.id);

  const offerIds = Array.from(new Set([singleOfferId, ...cartOffers.map((c) => c.id)].filter((x): x is string => !!x)));
  const offerId = offerIds[0] ?? null;
  const offerTitle = singleOfferTitle ?? cartOffers[0]?.title ?? null;

  // Kajabi's own names are "payment.succeeded" and "order.created"; Zapier
  // relays use words like "purchase" and "cancel". Anything that reads as a
  // sale grants, anything that reads as an ending revokes, the rest is kept
  // but ignored.
  let action: NormalisedKajabiEvent["action"] = "ignore";
  if (/purchase|grant|created|activated|subscri|paid|succe|order/.test(eventType) && !/cancel|revok|refund|fail|expir|remov/.test(eventType)) {
    action = "grant";
  } else if (/cancel|revok|refund|expir|remov|deactivat|fail/.test(eventType)) {
    action = "revoke";
  }

  return { eventType, action, memberEmail, memberName, memberId, offerId, offerIds, offerTitle };
}

export function kajabiSecretMatches(provided: string | null): boolean {
  const expected = process.env.KAJABI_WEBHOOK_SECRET;
  if (!expected || !provided) return false;
  return safeEqual(provided, expected);
}

type Target = { advisorId?: string; suiteId?: string; name: string; offerId: string };

/**
 * Applies a normalised event: grants or revokes the entitlements mapped to
 * the Kajabi offers in it. New subscribers are created without a password
 * and sent a set password link, so a person can buy on Kajabi and be talking
 * to their advisor within minutes. A renewal payment for something they
 * already hold is a no-op, so Payment Succeeded firing every month is safe.
 */
export async function applyKajabiEvent(eventId: string, ev: NormalisedKajabiEvent): Promise<string> {
  if (ev.action === "ignore") return `ignored event type "${ev.eventType}"`;
  if (!ev.memberEmail) return "no member email in payload";
  const offerIds = ev.offerIds.length ? ev.offerIds : ev.offerId ? [ev.offerId] : [];
  if (!offerIds.length) return "no offer id in payload";

  // One Kajabi offer can grant several things. Every specialist plan on the
  // sales page "includes Evren", so Lyra's offer id appears on both Lyra and
  // Evren, and a suite offer id appears on the suite.
  const [advisors, suites] = await Promise.all([
    db.advisor.findMany({ where: { kajabiOfferIds: { hasSome: offerIds } } }),
    db.suite.findMany({ where: { kajabiOfferIds: { hasSome: offerIds } } }),
  ]);

  const targets: Target[] = [];
  const unmapped: string[] = [];
  for (const offerId of offerIds) {
    const a = advisors.filter((x) => x.kajabiOfferIds.includes(offerId));
    const s = suites.filter((x) => x.kajabiOfferIds.includes(offerId));
    if (!a.length && !s.length) {
      unmapped.push(offerId);
      continue;
    }
    targets.push(...a.map((x) => ({ advisorId: x.id, name: x.name, offerId })));
    targets.push(...s.map((x) => ({ suiteId: x.id, name: x.name, offerId })));
  }
  if (!targets.length) {
    const first = offerIds[0];
    return `offer ${first}${ev.offerTitle ? ` (${ev.offerTitle})` : ""} is not mapped to an advisor or suite`;
  }
  const names = Array.from(new Set(targets.map((t) => t.name))).join(", ");
  const unmappedNote = unmapped.length ? `; offer ${unmapped.join(", ")} not mapped` : "";

  if (ev.action === "revoke") {
    let count = 0;
    for (const t of targets) {
      const res = await db.entitlement.updateMany({
        where: {
          user: { email: ev.memberEmail },
          status: "ACTIVE",
          source: "KAJABI",
          kajabiOfferId: t.offerId,
          ...(t.advisorId ? { advisorId: t.advisorId } : { suiteId: t.suiteId }),
        },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
      count += res.count;
    }
    return `revoked ${count} entitlement(s) for ${names}${unmappedNote}`;
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
      where: { userId: user.id, status: "ACTIVE", kajabiOfferId: t.offerId, ...(t.advisorId ? { advisorId: t.advisorId } : { suiteId: t.suiteId }) },
    });
    if (existing) continue;
    await db.entitlement.create({
      data: {
        userId: user.id,
        ...(t.advisorId ? { advisorId: t.advisorId } : { suiteId: t.suiteId }),
        source: "KAJABI",
        kajabiOfferId: t.offerId,
        kajabiMemberId: ev.memberId,
        note: ev.offerTitle ?? undefined,
      },
    });
    granted += 1;
  }

  // The most specific thing they bought is the one the welcome email names.
  const suiteNames = suites.map((s) => s.name);
  const specialist = advisors.find((a) => a.slug !== "evren")?.name;
  const headline = suiteNames[0] ?? specialist ?? advisors[0]?.name ?? "your advisor";

  // A person who has not set a password yet gets a fresh link when they gain
  // something new. A renewal for what they already hold sends nothing, so a
  // monthly charge never turns into a monthly email.
  if (isNew || (granted > 0 && !user.passwordHash)) {
    const raw = await issueToken(user.id, "SET_PASSWORD");
    await sendEmail(setPasswordMail(user.email, raw, headline));
    return `granted ${names}; ${isNew ? "created account and " : ""}sent set password email${unmappedNote}`;
  }
  return (granted ? `granted ${names}` : `already had ${names}`) + unmappedNote;
}
