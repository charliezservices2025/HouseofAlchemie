import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { DEFAULTS, getSetting } from "@/lib/settings";
import { Wordmark } from "@/components/wordmark";

/**
 * The quiet card every auth page renders inside. Anyone already signed in
 * and confirmed has no business here and goes straight to their advisors.
 * The card is anchored near the top rather than vertically centred so it
 * does not jump around when a phone keyboard opens.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  let verified = false;
  let supportEmail: string = DEFAULTS["brand.supportEmail"];
  try {
    const [session, email] = await Promise.all([getSession(), getSetting("brand.supportEmail")]);
    verified = Boolean(session?.user.emailVerifiedAt);
    supportEmail = email;
  } catch {
    // Database unreachable: still show the page so the action can report the problem.
  }
  if (verified) redirect("/advisors");

  return (
    <div className="min-h-dvh bg-cream px-4 pb-10 pt-8 sm:px-6 sm:pt-14">
      <div className="mx-auto w-full max-w-[26rem]">
        <div className="text-center">
          <Wordmark href="/" size="lg" />
        </div>

        <main className="card mt-6 p-6 sm:mt-8 sm:p-8">{children}</main>

        <p className="mt-6 text-center text-xs text-ink-muted">
          Stuck?{" "}
          <a href={`mailto:${supportEmail}`} className="underline underline-offset-4 hover:text-ink">
            {supportEmail}
          </a>
        </p>
      </div>
    </div>
  );
}
