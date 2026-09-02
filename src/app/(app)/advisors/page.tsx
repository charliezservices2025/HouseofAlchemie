import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { getAdvisorAccess } from "@/lib/entitlements";
import { getUsageSnapshot } from "@/lib/usage";
import { getSettings } from "@/lib/settings";
import { AdvisorList, type AdvisorRowData } from "@/components/advisors/advisor-list";
import { SuitesList, type SuiteRowData } from "@/components/advisors/suites-list";
import { EmptyState } from "@/components/advisors/empty-state";

export const metadata: Metadata = { title: "Your team" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdvisorsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/advisors");
  const params = await searchParams;
  const passwordReset = params.reset === "1";

  const [access, suites, ownedSuites, settings] = await Promise.all([
    getAdvisorAccess(user.id),
    db.suite.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { members: { include: { advisor: { select: { name: true, sortOrder: true } } } } },
    }),
    db.entitlement.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
        suiteId: { not: null },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { suiteId: true },
    }),
    getSettings(["brand.salesUrl", "brand.supportEmail"]),
  ]);

  const rows: AdvisorRowData[] = await Promise.all(
    access.map(async (a) => ({
      access: a,
      usage: a.unlocked ? await getUsageSnapshot(user.id, a.advisor.id, a.monthlyTokenCap) : null,
    })),
  );

  const ownedSuiteIds = new Set(ownedSuites.map((e) => e.suiteId).filter((id): id is string => Boolean(id)));
  const suiteRows: SuiteRowData[] = suites.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    tagline: s.tagline,
    members: [...s.members].sort((x, y) => x.advisor.sortOrder - y.advisor.sortOrder).map((m) => m.advisor.name),
    owned: ownedSuiteIds.has(s.id),
  }));

  const anyUnlocked = access.some((a) => a.unlocked);
  const salesUrl = settings["brand.salesUrl"];
  const supportEmail = settings["brand.supportEmail"];
  const firstName = user.name?.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <header>
        <p className="eyebrow">{firstName ? `Welcome back, ${firstName}` : "Welcome back"}</p>
        <h1 className="mt-1 text-3xl sm:text-4xl">Your team</h1>
        <p className="mt-3 max-w-prose leading-relaxed text-ink-soft">
          Five advisors, one shared memory. Whatever you tell one of them, the rest of the team remembers.
        </p>
      </header>

      {passwordReset ? (
        <p role="status" className="mt-6 border-l-2 border-sage bg-sage-whisper px-3 py-2 text-sm text-sage-deep">
          Password updated. You are signed in on this device only.
        </p>
      ) : null}

      {!anyUnlocked ? (
        <div className="mt-8">
          <EmptyState email={user.email} salesUrl={salesUrl} supportEmail={supportEmail} />
        </div>
      ) : null}

      <div className="mt-8">
        <AdvisorList rows={rows} salesUrl={salesUrl} />
      </div>

      <SuitesList suites={suiteRows} salesUrl={salesUrl} />
    </div>
  );
}
