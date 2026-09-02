import type { ChatAdvisor } from "./types";
import { openersFor } from "./openers";

export function EmptyState({ advisor, onPick, disabled }: { advisor: ChatAdvisor; onPick: (text: string) => void; disabled: boolean }) {
  const openers = openersFor(advisor.slug);
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <p className="eyebrow">{advisor.title}</p>
      <p className="mt-3 font-display text-2xl leading-snug text-ink sm:text-[1.75rem]">{advisor.tagline}</p>
      <p className="mt-8 text-sm text-ink-muted">Start with one of these, or say what is on your mind.</p>
      <ul className="mt-2 flex flex-col">
        {openers.map((text) => (
          <li key={text}>
            <button
              type="button"
              onClick={() => onPick(text)}
              disabled={disabled}
              className="flex min-h-11 w-full items-center border-t border-line py-3 text-left text-[0.9375rem] text-ink transition-colors hover:text-sage disabled:cursor-not-allowed disabled:opacity-45"
            >
              {text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
