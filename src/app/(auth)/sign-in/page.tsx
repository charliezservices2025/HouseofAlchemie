import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeNext } from "@/lib/validation";

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  // Only a same site relative path is echoed into the form. Anything else is dropped
  // here as well as in the action, so junk never reaches the page.
  const rawNext = typeof sp.next === "string" ? sp.next : undefined;
  const next = rawNext && safeNext(rawNext) === rawNext ? rawNext : undefined;

  return (
    <>
      <AuthHeading eyebrow="Welcome back" title="Sign in" />
      <SignInForm next={next} />
      <p className="hairline mt-6 pt-5 text-sm text-ink-soft">
        New here?{" "}
        <Link href="/sign-up" className="text-sage underline underline-offset-4 hover:text-sage-deep">
          Create an account
        </Link>
      </p>
    </>
  );
}
