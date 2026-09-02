import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <>
      <AuthHeading eyebrow="New account" title="Create your account" lede="A minute now, and your advisors will know you from the first conversation." />
      <SignUpForm />
      <p className="hairline mt-6 pt-5 text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-sage underline underline-offset-4 hover:text-sage-deep">
          Sign in
        </Link>
      </p>
    </>
  );
}
