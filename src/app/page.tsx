import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { getSession } from "@/lib/auth/session";
import { DEFAULTS, getSettings } from "@/lib/settings";

/**
 * The product door at app.houseofalchemie.ai. Subscribers go straight to
 * their advisors. Everyone else gets one line, a way in, and a pointer to the
 * sales site. Nothing to sell here: the selling happens on Kajabi.
 */
export default async function Home() {
  let signedIn = false;
  try {
    const s = await getSession();
    signedIn = Boolean(s?.user.emailVerifiedAt);
  } catch {
    // Database unreachable: still show the door rather than an error.
  }
  if (signedIn) redirect("/advisors");

  let salesUrl: string = DEFAULTS["brand.salesUrl"];
  let supportEmail: string = DEFAULTS["brand.supportEmail"];
  try {
    const brand = await getSettings(["brand.salesUrl", "brand.supportEmail"]);
    // Settings are admin edited, so only an http or https address is used as a link.
    if (/^https?:\/\//i.test(brand["brand.salesUrl"])) salesUrl = brand["brand.salesUrl"];
    if (brand["brand.supportEmail"].includes("@")) supportEmail = brand["brand.supportEmail"];
  } catch {
    // Defaults are the brand's real values, so the page is still correct.
  }

  return (
    <div className="safe-bottom flex min-h-dvh flex-col px-6 pt-8 sm:px-10 sm:pt-10 lg:px-16 lg:pt-12">
      <header>
        <Wordmark href="/" size="lg" className="sm:text-5xl" />
      </header>

      <main className="flex flex-1 flex-col justify-center py-16 sm:py-24">
        <h1 className="max-w-[12ch] text-[2.75rem] leading-[1.05] sm:text-6xl lg:text-7xl">Your advisors are waiting.</h1>

        <div className="mt-10 flex flex-col items-start gap-5 sm:mt-12 sm:flex-row sm:items-center sm:gap-8">
          <Link href="/sign-in" className="btn w-full no-underline sm:w-auto sm:min-w-[11rem]">
            Sign in
          </Link>
          <a
            href={salesUrl}
            className="inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] text-ink-soft no-underline transition-colors hover:text-ink"
          >
            <span>New here?</span>
            <span className="underline decoration-line underline-offset-4 hover:decoration-ink">See the advisors</span>
          </a>
        </div>
      </main>

      <footer className="hairline py-5 text-xs text-ink-muted">
        <span>Questions? </span>
        <a href={`mailto:${supportEmail}`} className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-ink sm:min-h-0">
          {supportEmail}
        </a>
      </footer>
    </div>
  );
}
