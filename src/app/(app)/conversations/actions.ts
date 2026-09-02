"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import type { ActionState } from "@/app/(auth)/actions";

const MAX_TITLE = 120;

const idSchema = z.string().trim().min(1).max(60);

// En dash (U+2013) and em dash (U+2014) are never stored; the brand rule is plain hyphens.
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`, "g");

const titleSchema = z
  .string()
  .transform((t) => t.replace(DASHES, "-").replace(/\s+/g, " ").trim().slice(0, MAX_TITLE))
  .pipe(z.string().min(1, "Give it a name."));

/** The conversation named in the form, only if it belongs to the signed in subscriber. */
async function ownedConversation(rawId: FormDataEntryValue | null) {
  const s = await getSession();
  if (!s || !s.user.emailVerifiedAt) return { error: "Sign in again." as const };
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { error: "No conversation chosen." as const };
  const conversation = await db.conversation.findFirst({ where: { id: id.data, userId: s.user.id }, select: { id: true } });
  if (!conversation) return { error: "That conversation is not yours." as const };
  return { id: conversation.id };
}

function refresh() {
  revalidatePath("/conversations");
  revalidatePath("/chat", "layout");
}

export async function archiveConversation(_prev: ActionState, form: FormData): Promise<ActionState> {
  const owned = await ownedConversation(form.get("id"));
  if ("error" in owned) return { error: owned.error };
  await db.conversation.update({ where: { id: owned.id }, data: { archivedAt: new Date() } });
  refresh();
  return { ok: true, message: "Archived." };
}

export async function restoreConversation(_prev: ActionState, form: FormData): Promise<ActionState> {
  const owned = await ownedConversation(form.get("id"));
  if ("error" in owned) return { error: owned.error };
  await db.conversation.update({ where: { id: owned.id }, data: { archivedAt: null } });
  refresh();
  return { ok: true, message: "Restored." };
}

export async function renameConversation(_prev: ActionState, form: FormData): Promise<ActionState> {
  const owned = await ownedConversation(form.get("id"));
  if ("error" in owned) return { error: owned.error };
  const title = titleSchema.safeParse(form.get("title") ?? "");
  if (!title.success) return { error: "Give it a name." };
  await db.conversation.update({ where: { id: owned.id }, data: { title: title.data } });
  refresh();
  return { ok: true, message: "Renamed." };
}
