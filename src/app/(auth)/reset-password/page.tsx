import type { Metadata } from "next";
import Link from "next/link";
import { peekToken } from "@/lib/auth/tokens";
import { resetPassword } from "@/app/(auth)/actions";
import { AuthHeading } from "@/components/auth/auth-heading";
import { NewPasswordForm } from "@/components/auth/new-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" && sp.token.length > 0 ? sp.token : undefined;
  const valid = token ? await peekToken(token, "RESET_PASSWORD") : false;

  if (!token || !valid) {
    return (
      <>
        <AuthHeading
          eyebrow="Password"
          title={token ? "This link has expired" : "This link is not complete"}
          lede={
            token
              ? "Reset links work for one hour and can only be used once. Request a new one and it will be with you in a moment."
              : "Open the link from your email again, or request a new one."
          }
        />
        <Link href="/forgot-password" className="btn w-full">
          Request a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading eyebrow="Password" title="Choose a new password" lede="Once it is saved, any other devices will be signed out." />
      <NewPasswordForm action={resetPassword} token={token} label="New password" submitLabel="Save new password" pendingLabel="Saving" />
      <p className="hairline mt-6 pt-5 text-sm text-ink-soft">
        Link not working?{" "}
        <Link href="/forgot-password" className="text-sage underline underline-offset-4 hover:text-sage-deep">
          Request a new one
        </Link>
      </p>
    </>
  );
}
