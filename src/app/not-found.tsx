import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export default function NotFound() {
  return (
    <div className="safe-bottom flex min-h-dvh flex-col px-6 pt-8 sm:px-10 sm:pt-10 lg:px-16 lg:pt-12">
      <header>
        <Wordmark href="/" size="md" />
      </header>

      <main className="flex flex-1 flex-col justify-center py-16">
        <p className="eyebrow">Not found</p>
        <h1 className="mt-3 max-w-[16ch] text-4xl leading-[1.1] sm:text-5xl">There is nothing at this address.</h1>
        <div className="mt-8">
          <Link href="/advisors" className="btn btn-secondary w-full no-underline sm:w-auto">
            Back to your advisors
          </Link>
        </div>
      </main>
    </div>
  );
}
