import Link from "next/link";
import { Lock } from "lucide-react";
import type { AdvisorAccess } from "@/lib/entitlements";
import type { UsageSnapshot } from "@/lib/usage";
import { UsageBar } from "./usage-bar";

export type AdvisorRowData = {
  access: AdvisorAccess;
  usage: UsageSnapshot | null;
};

function describeVia(via: AdvisorAccess["via"]): string {
  const parts = Array.from(
    new Set(
      via.map((v) => {
        if (v.kind === "suite") return `via ${v.name}`;
        return v.source === "KAJABI" ? "on its own" : "added by the House";
      }),
    ),
  );
  if (parts.length === 0) return "";
  if (parts.length === 1) return `Yours ${parts[0]}`;
  return `Yours ${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function AdvisorList({ rows, salesUrl }: { rows: AdvisorRowData[]; salesUrl: string }) {
  return (
    <ul className="border-t border-line">
      {rows.map(({ access, usage }) => {
        const a = access.advisor;
        return (
          <li key={a.id} id={a.slug} className="scroll-mt-20 border-b border-line py-6 sm:py-8">
            <article className="flex gap-4 sm:gap-6">
              <span
                aria-hidden="true"
                className={`mt-1.5 w-0.5 shrink-0 self-stretch ${access.unlocked ? "" : "bg-line"}`}
                style={access.unlocked ? { background: a.accentColor ?? "var(--color-sage)" } : undefined}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="text-2xl sm:text-3xl">{a.name}</h2>
                  <p className="eyebrow">{a.title}</p>
                </div>
                <p className="mt-2 max-w-prose text-[0.9375rem] leading-relaxed text-ink-soft">{a.tagline}</p>

                {access.unlocked ? (
                  <div className="mt-4 flex flex-col gap-3">
                    <p className="text-sm text-ink-muted">{describeVia(access.via)}</p>
                    {usage ? <UsageBar usage={usage} name={a.name} /> : null}
                    <div className="pt-1">
                      <Link href={`/chat/${a.slug}`} className="btn w-full sm:w-auto">
                        Talk to {a.name}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col gap-3">
                    <p className="flex items-center gap-2 text-sm text-ink-muted">
                      <Lock className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                      Not in your plan yet
                    </p>
                    <div className="pt-1">
                      <a href={salesUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full sm:w-auto">
                        Add {a.name} on Kajabi
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
