"use server";

import { redirect } from "next/navigation";
import { verifyEmailToken, type ActionState } from "@/app/(auth)/actions";

/**
 * Confirms an email link. This runs as a server action rather than during the
 * page render because verifyEmailToken creates a session, and Next only lets
 * a cookie be written from an action or a route handler.
 */
export async function confirmEmail(_prev: ActionState, form: FormData): Promise<ActionState> {
  const token = String(form.get("token") ?? "");
  const result = await verifyEmailToken(token);
  if (!result.ok) {
    return { error: "This link has expired or was already used. Confirmation links work for 24 hours." };
  }
  redirect("/onboarding");
}
