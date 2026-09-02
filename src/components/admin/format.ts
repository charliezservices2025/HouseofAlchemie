/**
 * Small formatting helpers for the admin screens. Everything renders on the
 * server, so dates are fixed to UTC and never depend on the viewer's locale.
 */

export const MICROS_PER_DOLLAR = 1_000_000;

/** Estimated tokens in one question and answer, used to turn caps into a human number. */
export const TOKENS_PER_EXCHANGE = 1200;

export function formatMoney(micros: bigint | number | null | undefined): string {
  const n = micros == null ? 0 : Number(micros) / MICROS_PER_DOLLAR;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNumber(n: number | bigint | null | undefined): string {
  return Number(n ?? 0).toLocaleString("en-US");
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "2026-09-02 14:03" in UTC, or a fallback when there is no date. */
export function formatDateTime(d: Date | null | undefined, fallback = "Never"): string {
  if (!d) return fallback;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function formatDate(d: Date | null | undefined, fallback = "None"): string {
  if (!d) return fallback;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-09" becomes "September 2026". */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return period;
  return `${MONTHS[m - 1]} ${y}`;
}

/** The current period and the months before it, newest first. */
export function recentPeriods(count: number, now = new Date()): string[] {
  const out: string[] = [];
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  for (let i = 0; i < count; i++) {
    out.push(`${y}-${pad(m + 1)}`);
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return out;
}

export function isPeriod(v: string | undefined): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function conversationsFromCap(cap: number): string {
  return `about ${formatNumber(Math.round(cap / TOKENS_PER_EXCHANGE))} conversations`;
}

export function percent(used: number, cap: number): number {
  if (cap <= 0) return 0;
  return Math.min(999, Math.round((used / cap) * 100));
}

/** Short, safe preview of a JSON value for an audit or event row. */
export function previewJson(value: unknown, max = 120): string {
  if (value == null) return "";
  let s: string;
  try {
    s = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    s = String(value);
  }
  return s.length > max ? `${s.slice(0, max)}...` : s;
}
