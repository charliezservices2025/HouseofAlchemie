import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./session";

export async function getCurrentUser() {
  const s = await getSession();
  return s?.user ?? null;
}

/** For pages inside the app. Sends people to sign in, then back where they were. */
export async function requireUser(returnTo?: string) {
  const s = await getSession();
  if (!s) {
    const q = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/sign-in${q}`);
  }
  if (!s.user.emailVerifiedAt) {
    redirect("/verify-email");
  }
  return s.user;
}

export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (user.role !== "ADMIN") {
    redirect("/advisors");
  }
  return user;
}

/** For route handlers, where a redirect is the wrong shape. */
export async function userFromRequest() {
  const s = await getSession();
  if (!s || !s.user.emailVerifiedAt) return null;
  return s.user;
}
