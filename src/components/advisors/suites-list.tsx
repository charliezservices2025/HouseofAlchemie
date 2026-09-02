export type SuiteRowData = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  members: string[];
  owned: boolean;
};

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The tagline usually names the members already. Only add the list when it does not. */
function taglineNamesEveryone(tagline: string, members: string[]): boolean {
  const lower = tagline.toLowerCase();
  return members.length > 0 && members.every((m) => lower.includes(m.toLowerCase()));
}

export function SuitesList({ suites, salesUrl }: { suites: SuiteRowData[]; salesUrl: string }) {
  if (suites.length === 0) return null;

  return (
    <section aria-labelledby="suites-heading" className="mt-12 sm:mt-16">
      <p className="eyebrow">Your suites</p>
      <h2 id="suites-heading" className="mt-1 text-2xl sm:text-3xl">
        Three ways to have the House
      </h2>
      <ul className="mt-5 border-t border-line">
        {suites.map((s) => (
          <li key={s.id} id={`suite-${s.slug}`} className="scroll-mt-20 border-b border-line py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <h3 className="text-xl">{s.name}</h3>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-soft">{s.tagline}</p>
                {taglineNamesEveryone(s.tagline, s.members) ? null : (
                  <p className="mt-1.5 text-xs text-ink-muted">{joinNames(s.members)}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center">
                {s.owned ? (
                  <span className="text-[0.6875rem] uppercase tracking-[0.18em] text-sage">In your plan</span>
                ) : (
                  <a
                    href={salesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center text-sm text-sage underline underline-offset-4"
                  >
                    Add on Kajabi
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
