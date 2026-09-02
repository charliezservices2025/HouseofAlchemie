"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Renders inside the app shell's main column, so it stays compact and keeps
 * the rail available as a way out.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col justify-center px-5 py-12 sm:px-8 lg:px-10">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-3 max-w-[18ch] text-3xl leading-[1.1] sm:text-4xl">That did not work on our side.</h1>

      <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
        <button type="button" onClick={reset} className="btn w-full sm:w-auto">
          Try again
        </button>
        <Link
          href="/advisors"
          className="inline-flex min-h-11 items-center text-[0.9375rem] text-ink-soft underline underline-offset-4 transition-colors hover:text-ink"
        >
          Back to your advisors
        </Link>
      </div>

      {error.digest && <p className="mt-8 text-xs text-ink-muted">If you write to us, quote reference {error.digest}.</p>}
    </div>
  );
}
