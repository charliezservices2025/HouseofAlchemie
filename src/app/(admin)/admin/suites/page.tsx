import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { updateSuite } from "@/app/(admin)/admin/actions";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader, Pill, Field, Empty } from "@/components/admin/ui";
import { conversationsFromCap, formatNumber } from "@/components/admin/format";

export const metadata: Metadata = { title: "Suites" };

export default async function AdminSuitesPage() {
  await requireAdmin();
  const [suites, advisors] = await Promise.all([
    db.suite.findMany({ orderBy: { sortOrder: "asc" }, include: { members: true, _count: { select: { entitlements: { where: { status: "ACTIVE" } } } } } }),
    db.advisor.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader eyebrow="Suites" title="Bundles" description="A suite unlocks every advisor in it under one cap. Saving replaces the member list." />

      {suites.length === 0 ? (
        <Empty>No suites yet. They are created by the seed.</Empty>
      ) : (
        <div className="flex flex-col gap-6">
          {suites.map((s) => {
            const memberIds = new Set(s.members.map((m) => m.advisorId));
            return (
              <section key={s.id} className="card p-4 sm:p-6" aria-labelledby={`suite-${s.id}`}>
                <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 id={`suite-${s.id}`} className="text-2xl">
                    {s.name}
                  </h2>
                  <span className="text-sm text-ink-muted">{s.tagline}</span>
                  {s.isActive ? <Pill tone="ok">Active</Pill> : <Pill>Off</Pill>}
                  <span className="text-xs text-ink-muted">{formatNumber(s._count.entitlements)} active subscribers</span>
                </div>
                <ActionForm action={updateSuite} submitLabel="Save suite" hidden={{ suiteId: s.id }}>
                  <fieldset>
                    <legend className="mb-1 text-sm text-ink">Members</legend>
                    <p className="mb-1 text-xs text-ink-muted">Only active advisors are listed. An advisor switched off drops out of the suite when you save.</p>
                    <div className="flex flex-wrap gap-x-6">
                      {advisors.map((a) => (
                        <label key={a.id} htmlFor={`m-${s.id}-${a.id}`} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                          <input id={`m-${s.id}-${a.id}`} type="checkbox" name="members" value={a.id} defaultChecked={memberIds.has(a.id)} className="h-4 w-4 accent-sage" />
                          {a.name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Monthly token cap" htmlFor={`cap-${s.id}`} hint={`Currently ${formatNumber(s.monthlyTokenCap)}, ${conversationsFromCap(s.monthlyTokenCap)} across the suite.`}>
                      <input id={`cap-${s.id}`} name="monthlyTokenCap" type="number" inputMode="numeric" className="field" defaultValue={s.monthlyTokenCap} min={1000} max={100000000} step={1000} required />
                    </Field>
                    <Field label="Kajabi offer ids" htmlFor={`offers-${s.id}`} hint="One per line. Buying any of these grants the whole suite.">
                      <textarea id={`offers-${s.id}`} name="kajabiOfferIds" className="field font-mono" rows={3} defaultValue={s.kajabiOfferIds.join("\n")} spellCheck={false} />
                    </Field>
                  </div>
                  <label htmlFor={`active-${s.id}`} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                    <input id={`active-${s.id}`} type="checkbox" name="isActive" value="on" defaultChecked={s.isActive} className="h-4 w-4 accent-sage" />
                    Active, shown to subscribers
                  </label>
                </ActionForm>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
