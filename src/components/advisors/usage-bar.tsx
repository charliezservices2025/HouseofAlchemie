import type { UsageSnapshot } from "@/lib/usage";

/** A hairline meter: how much of this month's allowance one advisor has used. */
export function UsageBar({ usage, name }: { usage: UsageSnapshot; name: string }) {
  const width = Math.min(100, usage.percent);
  const tone = usage.overCap ? "bg-danger" : usage.warn ? "bg-gold" : "bg-sage";
  const label = usage.overCap
    ? "This month's allowance is used up. It resets on the first of next month."
    : `${usage.percent}% of this month's allowance`;

  return (
    <div className="max-w-md">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
        aria-label={`${name}: ${usage.percent}% of this month's allowance used`}
        className="h-[3px] w-full bg-line-soft"
      >
        <div className={`h-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-ink-muted">{label}</p>
    </div>
  );
}
