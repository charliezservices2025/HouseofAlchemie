import type { ChatUsage } from "./types";

export function UsageMeter({ usage }: { usage: ChatUsage }) {
  const fill = usage.overCap ? "bg-danger" : usage.warn ? "bg-gold" : "bg-sage";
  const width = Math.max(0, Math.min(100, usage.percent));
  return (
    <div className="w-[7.5rem] shrink-0 text-right">
      <p className={`text-xs ${usage.overCap ? "text-danger" : "text-ink-muted"}`}>{usage.percent}% of this month</p>
      <div
        className="mt-1.5 h-0.5 w-full bg-line"
        role="progressbar"
        aria-label="Monthly allowance used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
      >
        <div className={`h-full ${fill}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
