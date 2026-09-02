import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading eyebrow="Password" title="Forgot your password" lede="Enter your email and we will send a link to choose a new one." />
      <ForgotPasswordForm />
      <p className="hairline mt-6 pt-5 text-sm text-ink-soft">
        <Link href="/sign-in" className="text-sage underline underline-offset-4 hover:text-sage-deep">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
