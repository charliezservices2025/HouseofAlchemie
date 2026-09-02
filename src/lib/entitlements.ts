import { db } from "@/lib/db";
import type { Advisor } from "@/generated/prisma/client";

export type AdvisorAccess = {
  advisor: Advisor;
  unlocked: boolean;
  /** How access was granted, for the advisor dashboard and admin */
  via: Array<{ kind: "advisor" | "suite"; name: string; source: string }>;
  /** Highest monthly token cap across everything that grants this advisor */
  monthlyTokenCap: number;
};

/**
 * Resolves every active advisor into unlocked or locked for a subscriber.
 * A suite is five subscriptions in a trench coat: owning it unlocks each
 * member advisor. Owning an advisor directly as well as inside a suite is
 * simply a union, with the larger token cap winning.
 */
export async function getAdvisorAccess(userId: string): Promise<AdvisorAccess[]> {
  const [advisors, entitlements] = await Promise.all([
    db.advisor.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.entitlement.findMany({
      where: { userId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { advisor: true, suite: { include: { members: true } } },
    }),
  ]);

  return advisors.map((advisor) => {
    const via: AdvisorAccess["via"] = [];
    let cap = 0;

    for (const e of entitlements) {
      if (e.advisorId === advisor.id && e.advisor) {
        via.push({ kind: "advisor", name: e.advisor.name, source: e.source });
        cap = Math.max(cap, e.advisor.monthlyTokenCap);
      }
      if (e.suite && e.suite.members.some((m) => m.advisorId === advisor.id)) {
        via.push({ kind: "suite", name: e.suite.name, source: e.source });
        cap = Math.max(cap, e.suite.monthlyTokenCap);
      }
    }

    return { advisor, unlocked: via.length > 0, via, monthlyTokenCap: cap || advisor.monthlyTokenCap };
  });
}

export async function getUnlockedAdvisor(userId: string, slug: string): Promise<AdvisorAccess | null> {
  const all = await getAdvisorAccess(userId);
  const match = all.find((a) => a.advisor.slug === slug);
  return match && match.unlocked ? match : null;
}

export async function hasAnyAccess(userId: string): Promise<boolean> {
  const count = await db.entitlement.count({
    where: { userId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
  });
  return count > 0;
}
