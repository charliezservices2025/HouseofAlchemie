"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, passwordProblem } from "@/lib/auth/password";
import { createSession, clearSessionCookie, getSession, requestMeta, revokeAllSessions, revokeSession } from "@/lib/auth/session";
import { issueToken, consumeToken } from "@/lib/auth/tokens";
import { allowAction, checkSignInAllowed, recordSignInAttempt } from "@/lib/auth/rate-limit";
import { sendEmail, verifyEmailMail, resetPasswordMail } from "@/lib/email";
import { signInSchema, signUpSchema, emailSchema, tokenSchema, passwordSchema, safeNext } from "@/lib/validation";

export type ActionState = { error?: string; ok?: boolean; message?: string };

const GENERIC_SIGNIN_ERROR = "That email and password do not match.";

function minutesUntil(d: Date) {
  return Math.max(1, Math.ceil((d.getTime() - Date.now()) / 60000));
}

export async function signUp(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    name: form.get("name") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const { email, password, name } = parsed.data;

  const problem = passwordProblem(password);
  if (problem) return { error: problem };

  const { ip } = await requestMeta();
  if (!(await allowAction(`signup:${ip ?? "unknown"}`, 10))) {
    return { error: "Too many sign ups from this connection. Try again in fifteen minutes." };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Do not reveal that the account exists. Nudge them to the right door.
    if (!existing.passwordHash) {
      const raw = await issueToken(existing.id, "SET_PASSWORD");
      const { setPasswordMail } = await import("@/lib/email");
      await sendEmail(setPasswordMail(email, raw, "Your advisor"));
    }
    return { ok: true, message: "Check your email to finish setting up your account." };
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({ data: { email, passwordHash, name: name || null } });
  const raw = await issueToken(user.id, "VERIFY_EMAIL");
  await sendEmail(verifyEmailMail(email, raw));

  return { ok: true, message: "Check your email to confirm your address, then you are in." };
}

export async function signIn(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    next: form.get("next") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const { email, password, next } = parsed.data;
  const { ip } = await requestMeta();

  const decision = await checkSignInAllowed(email, ip);
  if (!decision.allowed) {
    const mins = minutesUntil(decision.retryAt);
    return {
      error:
        decision.reason === "ip"
          ? `Too many attempts from this connection. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`
          : `This account is temporarily locked after too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}, or reset your password.`,
    };
  }

  const user = await db.user.findUnique({ where: { email } });
  // Always run a hash comparison so timing does not reveal whether the email exists.
  const ok = user?.passwordHash
    ? await verifyPassword(user.passwordHash, password)
    : await verifyPassword("$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", password) && false;

  await recordSignInAttempt(email, ip, ok);
  if (!ok || !user) return { error: GENERIC_SIGNIN_ERROR };

  await createSession(user.id);

  if (!user.emailVerifiedAt) redirect("/verify-email");
  if (!user.onboardedAt && user.role !== "ADMIN") redirect("/onboarding");
  redirect(safeNext(next));
}

export async function signOut() {
  const s = await getSession();
  if (s) await revokeSession(s.sessionId);
  await clearSessionCookie();
  redirect("/sign-in");
}

export async function signOutEverywhere() {
  const s = await getSession();
  if (s) await revokeAllSessions(s.user.id, s.sessionId);
  return { ok: true } satisfies ActionState;
}

export async function revokeOtherSession(_prev: ActionState, form: FormData): Promise<ActionState> {
  const s = await getSession();
  if (!s) return { error: "Sign in again." };
  const id = String(form.get("sessionId") ?? "");
  if (!id) return { error: "No session chosen." };
  const owned = await db.session.findFirst({ where: { id, userId: s.user.id } });
  if (!owned) return { error: "That session is not yours." };
  await revokeSession(id);
  return { ok: true };
}

export async function requestPasswordReset(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const email = parsed.data;
  const { ip } = await requestMeta();

  if (!(await allowAction(`reset:${email}`, 3, 60 * 60 * 1000)) || !(await allowAction(`reset-ip:${ip ?? "unknown"}`, 20))) {
    // Still a generic message, so this cannot be used to probe.
    return { ok: true, message: "If that address has an account, a reset link is on its way." };
  }

  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const raw = await issueToken(user.id, "RESET_PASSWORD");
    await sendEmail(resetPasswordMail(email, raw));
  }
  return { ok: true, message: "If that address has an account, a reset link is on its way." };
}

export async function resetPassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  const token = tokenSchema.safeParse(form.get("token"));
  const password = passwordSchema.safeParse(form.get("password"));
  if (!token.success) return { error: "This reset link is not valid. Request a new one." };
  if (!password.success) return { error: password.error.issues[0]?.message ?? "Choose a stronger password." };
  const problem = passwordProblem(password.data);
  if (problem) return { error: problem };

  const userId = await consumeToken(token.data, "RESET_PASSWORD");
  if (!userId) return { error: "This reset link has expired or was already used. Request a new one." };

  const passwordHash = await hashPassword(password.data);
  await db.user.update({
    where: { id: userId },
    data: { passwordHash, failedLoginCount: 0, lockedUntil: null, emailVerifiedAt: new Date() },
  });
  // A password change signs out every other device.
  await revokeAllSessions(userId);
  await createSession(userId);
  redirect("/advisors?reset=1");
}

export async function setPassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  const token = tokenSchema.safeParse(form.get("token"));
  const password = passwordSchema.safeParse(form.get("password"));
  if (!token.success) return { error: "This link is not valid. Use Forgot password on the sign in page." };
  if (!password.success) return { error: password.error.issues[0]?.message ?? "Choose a stronger password." };
  const problem = passwordProblem(password.data);
  if (problem) return { error: problem };

  const userId = await consumeToken(token.data, "SET_PASSWORD");
  if (!userId) return { error: "This link has expired or was already used. Use Forgot password on the sign in page with the same email." };

  const passwordHash = await hashPassword(password.data);
  const user = await db.user.update({
    where: { id: userId },
    data: { passwordHash, emailVerifiedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });
  await createSession(userId);
  redirect(user.onboardedAt || user.role === "ADMIN" ? "/advisors" : "/onboarding");
}

export async function verifyEmailToken(raw: string): Promise<{ ok: boolean }> {
  const token = tokenSchema.safeParse(raw);
  if (!token.success) return { ok: false };
  const userId = await consumeToken(token.data, "VERIFY_EMAIL");
  if (!userId) return { ok: false };
  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  const s = await getSession();
  if (!s || s.user.id !== userId) await createSession(userId);
  return { ok: true };
}

export async function resendVerification(): Promise<ActionState> {
  const s = await getSession();
  if (!s) return { error: "Sign in first." };
  if (s.user.emailVerifiedAt) return { ok: true, message: "Your email is already confirmed." };
  if (!(await allowAction(`verify:${s.user.id}`, 3, 60 * 60 * 1000))) {
    return { error: "You have asked a few times already. Give it an hour, and check your spam folder." };
  }
  const raw = await issueToken(s.user.id, "VERIFY_EMAIL");
  await sendEmail(verifyEmailMail(s.user.email, raw));
  return { ok: true, message: "Sent. Check your inbox." };
}

export async function changePassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  const s = await getSession();
  if (!s) return { error: "Sign in again." };
  const current = String(form.get("current") ?? "");
  const next = passwordSchema.safeParse(form.get("password"));
  if (!next.success) return { error: next.error.issues[0]?.message ?? "Choose a stronger password." };
  const problem = passwordProblem(next.data);
  if (problem) return { error: problem };
  if (!s.user.passwordHash || !(await verifyPassword(s.user.passwordHash, current))) {
    return { error: "Your current password is not right." };
  }
  await db.user.update({ where: { id: s.user.id }, data: { passwordHash: await hashPassword(next.data) } });
  await revokeAllSessions(s.user.id, s.sessionId);
  return { ok: true, message: "Password changed. Other devices have been signed out." };
}
