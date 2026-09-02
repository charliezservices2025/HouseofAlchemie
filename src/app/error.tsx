"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

/**
 * Catches errors on public pages (the door, sign in, verify). Signed in pages
 * have their own compact version inside the shell at (app)/error.tsx.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="safe-bottom flex min-h-dvh flex-col px-6 pt-8 sm:px-10 sm:pt-10 lg:px-16 lg:pt-12">
      <header>
        <Wordmark href="/" size="md" />
      </header>

      <main className="flex flex-1 flex-col justify-center py-16">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="mt-3 max-w-[16ch] text-4xl leading-[1.1] sm:text-5xl">That did not work on our side.</h1>

        <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
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

        {error.digest && <p className="mt-10 text-xs text-ink-muted">If you write to us, quote reference {error.digest}.</p>}
      </main>
    </div>
  );
}
