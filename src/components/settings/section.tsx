/** One settings card: eyebrow, heading, optional intro, then the content. */
export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="card p-5 sm:p-7">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={`${id}-heading`} className="mt-1 text-2xl">
        {title}
      </h2>
      {description ? <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}
