"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { FONT_PRESETS, isTextScale, type FontPreset, type TextScale } from "@/lib/fonts";
import type { ActionState } from "@/app/(auth)/actions";

/** The type action also returns what was saved so the form can update its baseline. */
export type TypeActionState = ActionState & { saved?: { fontPreset: FontPreset; textScale: TextScale } };

const profileSchema = z.object({
  name: z.string().trim().max(80, "Keep your name under 80 characters."),
});

const presetKeys = Object.keys(FONT_PRESETS) as [FontPreset, ...FontPreset[]];
const typeSchema = z.object({
  fontPreset: z.enum(presetKeys, { error: "Choose one of the listed type pairings." }),
  textScale: z.coerce.number({ error: "Choose one of the listed sizes." }).int(),
});

export async function updateProfile(_prev: ActionState, form: FormData): Promise<ActionState> {
  const s = await getSession();
  if (!s) return { error: "Sign in again." };

  const parsed = profileSchema.safeParse({ name: form.get("name") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  await db.user.update({ where: { id: s.user.id }, data: { name: parsed.data.name || null } });
  return { ok: true, message: "Saved." };
}

export async function updateTypePreferences(_prev: TypeActionState, form: FormData): Promise<TypeActionState> {
  const s = await getSession();
  if (!s) return { error: "Sign in again." };

  const parsed = typeSchema.safeParse({ fontPreset: form.get("fontPreset"), textScale: form.get("textScale") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  const { fontPreset, textScale } = parsed.data;
  if (!isTextScale(textScale)) return { error: "Choose one of the listed sizes." };

  await db.user.update({ where: { id: s.user.id }, data: { fontPreset, textScale } });
  return { ok: true, message: "Saved. Your type is updated everywhere.", saved: { fontPreset, textScale } };
}
