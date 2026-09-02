import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { signOut } from "@/app/(auth)/actions";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ConfirmEmailForm } from "@/components/auth/confirm-email-form";
import { ResendVerification } from "@/components/auth/resend-verification";

export const metadata: Metadata = { title: "Confirm your email" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Two jobs. With a token in the URL it confirms the address (through a server
 * action, which then sends the person to onboarding). Without one it is the
 * "check your inbox" holding page, with a resend button for anyone signed in.
 * The layout already sends confirmed users to their advisors.
 */
export default async function VerifyEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" && sp.token.length > 0 ? sp.token : undefined;
  const session = await getSession();

  if (token) {
    return (
      <>
        <AuthHeading eyebrow="Almost there" title="Confirming your email" />
        <ConfirmEmailForm token={token} signedIn={Boolean(session)} />
      </>
    );
  }

  return (
    <>
      <AuthHeading
        eyebrow="One more step"
        title="Check your inbox"
        lede={
          session
            ? `We sent a confirmation link to ${session.user.email}. Open it and you are in.`
            : "We sent you a confirmation link. Open it and you are in."
        }
      />
      <p className="mb-6 text-sm leading-relaxed text-ink-muted">The link works for 24 hours. Nothing there after a few minutes? Check your spam folder.</p>

      {session ? (
        <div className="flex flex-col gap-5">
          <ResendVerification />
          <form action={signOut} className="hairline pt-4">
            <button type="submit" className="inline-flex min-h-11 items-center text-sm text-ink-muted underline underline-offset-4 hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <p className="hairline pt-5 text-sm text-ink-soft">
          Need a new link?{" "}
          <Link href="/sign-in" className="text-sage underline underline-offset-4 hover:text-sage-deep">
            Sign in
          </Link>{" "}
          and we will send one.
        </p>
      )}
    </>
  );
}
