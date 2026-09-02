import type { Metadata } from "next";
import Link from "next/link";
import { peekToken } from "@/lib/auth/tokens";
import { setPassword } from "@/app/(auth)/actions";
import { AuthHeading } from "@/components/auth/auth-heading";
import { NewPasswordForm } from "@/components/auth/new-password-form";

export const metadata: Metadata = { title: "Welcome" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Where a Kajabi buyer lands from their welcome email. It should read as a
 * welcome, not a security screen: one password and they are in.
 */
export default async function SetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" && sp.token.length > 0 ? sp.token : undefined;
  const valid = token ? await peekToken(token, "SET_PASSWORD") : false;

  if (!token || !valid) {
    return (
      <>
        <AuthHeading
          eyebrow="Welcome"
          title={token ? "This link has expired" : "This link is not complete"}
          lede={
            token
              ? "Welcome links work for seven days. Use Forgot password with the same email address you bought with and we will send a fresh one."
              : "Open the link from your welcome email again, or ask for a fresh one with the email address you bought with."
          }
        />
        <Link href="/forgot-password" className="btn w-full">
          Send me a new link
        </Link>
        <p className="hairline mt-6 pt-5 text-sm text-ink-soft">
          Already set a password?{" "}
          <Link href="/sign-in" className="text-sage underline underline-offset-4 hover:text-sage-deep">
            Sign in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <AuthHeading eyebrow="Welcome" title="Welcome to the House" lede="Choose a password and your advisor is ready for you." />
      <NewPasswordForm action={setPassword} token={token} label="Choose a password" submitLabel="Set password" pendingLabel="Setting up" />
      <p className="hairline mt-6 pt-5 text-sm text-ink-soft">
        Link not working?{" "}
        <Link href="/forgot-password" className="text-sage underline underline-offset-4 hover:text-sage-deep">
          Request a new one
        </Link>
      </p>
    </>
  );
}
