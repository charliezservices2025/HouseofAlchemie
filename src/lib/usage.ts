import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";

export function currentPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function estimateCostMicros(model: string, tokensIn: number, tokensOut: number, pricing: Record<string, { inputPerMillion: number; outputPerMillion: number }>): bigint {
  const p = pricing[model] ?? { inputPerMillion: 3, outputPerMillion: 15 };
  const dollars = (tokensIn / 1_000_000) * p.inputPerMillion + (tokensOut / 1_000_000) * p.outputPerMillion;
  return BigInt(Math.round(dollars * 1_000_000));
}

/**
 * Records one request against the subscriber, the advisor, and the month.
 * One row per user, advisor and month. Subscriber and house totals are sums
 * over these rows; there is deliberately no null advisor "total" row, because
 * a null inside the compound unique key cannot be upserted.
 */
export async function recordUsage(args: { userId: string; advisorId: string; model: string; tokensIn: number; tokensOut: number }) {
  const period = currentPeriod();
  const pricing = await getSetting("usage.pricing");
  const costMicros = estimateCostMicros(args.model, args.tokensIn, args.tokensOut, pricing);

  await db.usageLedger.upsert({
    where: { userId_advisorId_period: { userId: args.userId, advisorId: args.advisorId, period } },
    create: { userId: args.userId, advisorId: args.advisorId, period, tokensIn: args.tokensIn, tokensOut: args.tokensOut, costMicros, requests: 1 },
    update: {
      tokensIn: { increment: args.tokensIn },
      tokensOut: { increment: args.tokensOut },
      costMicros: { increment: costMicros },
      requests: { increment: 1 },
    },
  });
}

/** Everything a subscriber used this month across all advisors. */
export async function getMonthlyTotals(userId: string, period = currentPeriod()) {
  const agg = await db.usageLedger.aggregate({
    where: { userId, period },
    _sum: { tokensIn: true, tokensOut: true, costMicros: true, requests: true },
  });
  return {
    tokensIn: agg._sum.tokensIn ?? 0,
    tokensOut: agg._sum.tokensOut ?? 0,
    costMicros: agg._sum.costMicros ?? BigInt(0),
    requests: agg._sum.requests ?? 0,
  };
}

export type UsageSnapshot = {
  period: string;
  used: number;
  cap: number;
  percent: number;
  overCap: boolean;
  warn: boolean;
};

/**
 * The hard cap. Tokens used this month against this advisor versus the cap
 * that the subscriber's entitlements allow. Input and output both count,
 * because both are billed.
 */
export async function getUsageSnapshot(userId: string, advisorId: string, cap: number): Promise<UsageSnapshot> {
  const period = currentPeriod();
  const [row, warnAt] = await Promise.all([
    db.usageLedger.findUnique({ where: { userId_advisorId_period: { userId, advisorId, period } } }),
    getSetting("usage.warnAtPercent"),
  ]);
  const used = (row?.tokensIn ?? 0) + (row?.tokensOut ?? 0);
  const percent = cap > 0 ? Math.min(999, Math.round((used / cap) * 100)) : 0;
  return { period, used, cap, percent, overCap: cap > 0 && used >= cap, warn: percent >= warnAt };
}
