/**
 * The heading block at the top of every auth card: a small caps eyebrow, the
 * display heading, and an optional one line lede.
 */
export function AuthHeading({ eyebrow, title, lede }: { eyebrow?: string; title: string; lede?: string }) {
  return (
    <div className="mb-6">
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      <h1 className="text-[1.75rem] leading-tight sm:text-3xl">{title}</h1>
      {lede && <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{lede}</p>}
    </div>
  );
}
