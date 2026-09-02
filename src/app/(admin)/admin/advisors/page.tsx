import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { updateAdvisorListing } from "@/app/(admin)/admin/actions";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader, Pill, Notice } from "@/components/admin/ui";
import { conversationsFromCap, formatNumber } from "@/components/admin/format";

export const metadata: Metadata = { title: "Advisors" };

export default async function AdminAdvisorsPage() {
  await requireAdmin();
  const advisors = await db.advisor.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { entitlements: { where: { status: "ACTIVE" } }, conversations: true } }, suites: { include: { suite: { select: { name: true } } } } },
  });
  const unmapped = advisors.filter((a) => a.kajabiOfferIds.length === 0);

  return (
    <>
      <PageHeader eyebrow="Advisors" title="The team" description="Switch advisors on or off, set the order they appear in, and open one to edit the voice, questions, model and Kajabi offers." />

      {unmapped.length > 0 && (
        <div className="mb-6">
          <Notice tone="warn">
            {unmapped.length === advisors.length ? "No advisor has a Kajabi offer id yet, so purchases cannot grant access." : `${unmapped.map((a) => a.name).join(", ")} ${unmapped.length === 1 ? "has" : "have"} no Kajabi offer id yet.`} Open an advisor and paste the offer ids from Kajabi. Remember every plan includes Evren.
          </Notice>
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {advisors.map((a) => (
          <li key={a.id} className="card flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-3">
              <span aria-hidden="true" className="mt-1.5 h-3 w-3 shrink-0" style={{ background: a.accentColor ?? "#2a544b" }} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-xl">
                    <Link href={`/admin/advisors/${a.slug}`} className="no-underline hover:text-sage">
                      {a.name}
                    </Link>
                  </h2>
                  <span className="text-sm text-ink-muted">{a.title}</span>
                  {a.isActive ? <Pill tone="ok">Active</Pill> : <Pill>Off</Pill>}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-ink-muted sm:grid-cols-4">
                  <div>
                    <dt className="inline">Model </dt>
                    <dd className="inline font-mono text-ink-soft">{a.model}</dd>
                  </div>
                  <div>
                    <dt className="inline">Cap </dt>
                    <dd className="inline text-ink-soft">
                      {formatNumber(a.monthlyTokenCap)}, {conversationsFromCap(a.monthlyTokenCap)}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">Kajabi offers </dt>
                    <dd className="inline text-ink-soft">{a.kajabiOfferIds.length || "none"}</dd>
                  </div>
                  <div>
                    <dt className="inline">Subscribers </dt>
                    <dd className="inline text-ink-soft">{formatNumber(a._count.entitlements)} direct</dd>
                  </div>
                  <div className="col-span-2 sm:col-span-4">
                    <dt className="inline">In suites </dt>
                    <dd className="inline text-ink-soft">{a.suites.length ? a.suites.map((s) => s.suite.name).join(", ") : "none"}</dd>
                  </div>
                </dl>
                <div className="mt-3">
                  <Link href={`/admin/advisors/${a.slug}`} className="inline-flex min-h-11 items-center text-sm text-sage underline underline-offset-4 hover:text-sage-deep">
                    Edit {a.name}
                  </Link>
                </div>
              </div>
            </div>

            <ActionForm action={updateAdvisorListing} submitLabel="Save" hidden={{ advisorId: a.id }} variant="btn btn-secondary" className="shrink-0 lg:w-64">
              <div className="flex items-end gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`sort-${a.id}`} className="text-sm">
                    Order
                  </label>
                  <input id={`sort-${a.id}`} name="sortOrder" type="number" inputMode="numeric" className="field w-24" defaultValue={a.sortOrder} min={0} max={999} />
                </div>
                <label htmlFor={`active-${a.id}`} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <input id={`active-${a.id}`} type="checkbox" name="isActive" value="on" defaultChecked={a.isActive} className="h-4 w-4 accent-sage" />
                  Active
                </label>
              </div>
            </ActionForm>
          </li>
        ))}
      </ol>
    </>
  );
}
