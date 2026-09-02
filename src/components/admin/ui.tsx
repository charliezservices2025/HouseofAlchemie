import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Server safe building blocks for the admin screens. Dense, quiet, sharp
 * cornered, so a working screen still looks like it came from the House.
 */

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-3xl leading-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, description, children, actions, id }: { title: string; description?: ReactNode; children: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <section id={id} className="mb-10">
      <div className="hairline mb-4 flex flex-col gap-2 pt-4 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl">{title}</h2>
          {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card px-4 py-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 break-words font-display text-2xl leading-none text-ink sm:text-3xl">{value}</div>
      {hint && <div className="mt-2 text-xs text-ink-muted">{hint}</div>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

/** Every table scrolls sideways inside this box. The page itself never does. */
export function Table({ children, minWidth = "40rem", caption }: { children: ReactNode; minWidth?: string; caption?: string }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full border-collapse text-[0.8125rem] leading-snug" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function Th({ children, align = "left", className = "" }: { children?: ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap border-b border-ink px-3 py-2.5 font-body text-[0.6875rem] font-normal uppercase tracking-[0.14em] text-ink-muted ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, align = "left", className = "", muted = false }: { children?: ReactNode; align?: "left" | "right"; className?: string; muted?: boolean }) {
  return (
    <td className={`border-b border-line-soft px-3 py-2.5 align-top ${align === "right" ? "text-right tabular-nums" : "text-left"} ${muted ? "text-ink-muted" : "text-ink"} ${className}`}>
      {children}
    </td>
  );
}

export type Tone = "ok" | "muted" | "warn" | "danger" | "ink";

const PILL: Record<Tone, string> = {
  ok: "border-sage text-sage",
  muted: "border-line text-ink-muted",
  warn: "border-gold text-gold",
  danger: "border-danger text-danger",
  ink: "border-ink text-ink",
};

export function Pill({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap border px-1.5 py-0.5 text-[0.6875rem] uppercase tracking-[0.12em] ${PILL[tone]}`}>{children}</span>;
}

const NOTICE: Record<Tone, string> = {
  ok: "border-sage bg-sage-whisper text-sage-deep",
  muted: "border-line bg-paper text-ink-soft",
  warn: "border-gold bg-cream text-ink",
  danger: "border-danger bg-danger-soft text-danger",
  ink: "border-ink bg-paper text-ink",
};

export function Notice({ tone = "muted", children, role }: { tone?: Tone; children: ReactNode; role?: "status" | "alert" }) {
  return (
    <div role={role} className={`border px-4 py-3 text-sm leading-relaxed ${NOTICE[tone]}`}>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card px-4 py-8 text-center text-sm text-ink-muted">{children}</div>;
}

export function Field({ label, htmlFor, hint, children, className = "" }: { label: ReactNode; htmlFor: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm text-ink">
        {label}
      </label>
      {children}
      {hint && <div className="text-xs leading-relaxed text-ink-muted">{hint}</div>}
    </div>
  );
}

export function TextLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`py-3 text-sage underline decoration-sage-light underline-offset-4 hover:text-sage-deep ${className}`}>
      {children}
    </Link>
  );
}

export function KeyValue({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="card divide-y divide-line-soft">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-2.5 text-sm sm:grid-cols-[11rem_1fr]">
          <dt className="text-ink-muted">{r.label}</dt>
          <dd className="min-w-0 break-words text-ink">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Filter chips are links, so they work without JavaScript and carry aria-current. */
export function FilterChips({ items, label = "Filter" }: { items: Array<{ href: string; label: string; active: boolean; count?: number }>; label?: string }) {
  return (
    <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label={label}>
      {items.map((item) => (
        <li key={item.href} className="shrink-0">
          <Link
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center gap-2 border px-3 text-[0.75rem] uppercase tracking-[0.14em] no-underline transition-colors ${
              item.active ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink-soft hover:border-ink hover:text-ink"
            }`}
          >
            {item.label}
            {typeof item.count === "number" && <span className={item.active ? "text-paper/70" : "text-ink-muted"}>{item.count}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
