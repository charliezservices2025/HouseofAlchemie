"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/current-user";
import { getSession, revokeAllSessions } from "@/lib/auth/session";
import { issueToken } from "@/lib/auth/tokens";
import { sendEmail, setPasswordMail } from "@/lib/email";
import { DEFAULTS, getSetting, setSetting, type IntakeQuestion, type ModelPricing, type SettingKey, type SettingValue } from "@/lib/settings";
import { applyKajabiEvent, normaliseKajabiPayload } from "@/lib/kajabi";
import { ingestDocument } from "@/lib/knowledge/ingest";
import type { ActionState } from "@/app/(auth)/actions";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function str(v: FormDataEntryValue | null | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

function optional(v: string): string | undefined {
  return v ? v : undefined;
}

function lines(v: string): string[] {
  return v
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

/**
 * Reads repeater rows named like `prefix.0.field`. Rows keep their order and
 * gaps are skipped, so removing a row in the browser needs no renumbering.
 */
function indexedRows(form: FormData, prefix: string): Array<Record<string, string>> {
  const rows = new Map<number, Record<string, string>>();
  const re = new RegExp(`^${prefix}\\.(\\d+)\\.([a-zA-Z]+)$`);
  for (const [key, value] of form.entries()) {
    const m = key.match(re);
    if (!m || typeof value !== "string") continue;
    const i = Number(m[1]);
    const row = rows.get(i) ?? {};
    row[m[2]] = value.trim();
    rows.set(i, row);
  }
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r);
}

function firstIssue(err: z.ZodError, fallback = "Check the form and try again."): string {
  return err.issues[0]?.message ?? fallback;
}

async function audit(actorId: string, action: string, targetType: string, targetId: string | null, meta?: Prisma.InputJsonValue) {
  await db.auditLog.create({ data: { actorId, action, targetType, targetId, meta } });
}

const id = z.string().min(1, "Missing id.").max(60);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Accent colour must be a six digit hex like #2a544b.");

// ---------------------------------------------------------------------------
// Users and entitlements
// ---------------------------------------------------------------------------

const grantSchema = z.object({
  userId: id,
  target: z.string().regex(/^(advisor|suite):[A-Za-z0-9_-]+$/, "Choose an advisor or a suite."),
  source: z.enum(["ADMIN", "COMP"], { message: "Choose how this access is granted." }),
  note: z.string().max(200, "Keep the note under 200 characters.").optional(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry must be a date.").optional(),
});

export async function grantEntitlement(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = grantSchema.safeParse({
    userId: str(form.get("userId")),
    target: str(form.get("target")),
    source: str(form.get("source")),
    note: optional(str(form.get("note"))),
    expiresAt: optional(str(form.get("expiresAt"))),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { userId, target, source, note, expiresAt } = parsed.data;
  const [kind, targetId] = target.split(":") as ["advisor" | "suite", string];

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return { error: "That user no longer exists." };

  let name: string;
  if (kind === "advisor") {
    const advisor = await db.advisor.findUnique({ where: { id: targetId }, select: { name: true } });
    if (!advisor) return { error: "That advisor no longer exists." };
    name = advisor.name;
  } else {
    const suite = await db.suite.findUnique({ where: { id: targetId }, select: { name: true } });
    if (!suite) return { error: "That suite no longer exists." };
    name = suite.name;
  }

  const expires = expiresAt ? new Date(`${expiresAt}T23:59:59.000Z`) : null;
  if (expires && expires.getTime() <= Date.now()) return { error: "The expiry date is already in the past." };

  const row = await db.entitlement.create({
    data: {
      userId,
      ...(kind === "advisor" ? { advisorId: targetId } : { suiteId: targetId }),
      source,
      note: note ?? null,
      expiresAt: expires,
    },
  });
  await audit(admin.id, "entitlement.grant", "Entitlement", row.id, { userId, kind, targetId, name, source, expiresAt: expiresAt ?? null });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return { ok: true, message: `${name} granted.` };
}

export async function revokeEntitlement(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(str(form.get("entitlementId")));
  if (!parsed.success) return { error: "No entitlement chosen." };

  const row = await db.entitlement.findUnique({ where: { id: parsed.data }, include: { advisor: { select: { name: true } }, suite: { select: { name: true } } } });
  if (!row) return { error: "That entitlement no longer exists." };
  if (row.status !== "ACTIVE") return { error: "That entitlement is not active." };

  await db.entitlement.update({ where: { id: row.id }, data: { status: "REVOKED", revokedAt: new Date() } });
  const name = row.advisor?.name ?? row.suite?.name ?? "access";
  await audit(admin.id, "entitlement.revoke", "Entitlement", row.id, { userId: row.userId, name, source: row.source });
  revalidatePath(`/admin/users/${row.userId}`);
  revalidatePath("/admin/users");
  return { ok: true, message: `${name} revoked.` };
}

export async function toggleAdminRole(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(str(form.get("userId")));
  if (!parsed.success) return { error: "No user chosen." };

  const user = await db.user.findUnique({ where: { id: parsed.data }, select: { id: true, role: true, email: true } });
  if (!user) return { error: "That user no longer exists." };
  if (user.id === admin.id && user.role === "ADMIN") return { error: "You cannot remove your own admin access. Ask another admin to do it." };

  const role = user.role === "ADMIN" ? "SUBSCRIBER" : "ADMIN";
  await db.user.update({ where: { id: user.id }, data: { role } });
  await audit(admin.id, role === "ADMIN" ? "user.role.admin" : "user.role.subscriber", "User", user.id, { email: user.email, from: user.role, to: role });
  revalidatePath(`/admin/users/${user.id}`);
  revalidatePath("/admin/users");
  return { ok: true, message: role === "ADMIN" ? "They are now an admin." : "Admin access removed." };
}

export async function forceSignOut(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(str(form.get("userId")));
  if (!parsed.success) return { error: "No user chosen." };

  const user = await db.user.findUnique({ where: { id: parsed.data }, select: { id: true, email: true } });
  if (!user) return { error: "That user no longer exists." };

  // Signing yourself out everywhere keeps the session you are using right now.
  const session = user.id === admin.id ? await getSession() : null;
  await revokeAllSessions(user.id, session?.sessionId);
  await audit(admin.id, "user.sessions.revoke", "User", user.id, { email: user.email });
  revalidatePath(`/admin/users/${user.id}`);
  return { ok: true, message: "Signed out on every device." };
}

export async function resendSetPassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(str(form.get("userId")));
  if (!parsed.success) return { error: "No user chosen." };

  const user = await db.user.findUnique({
    where: { id: parsed.data },
    include: {
      entitlements: {
        where: { status: "ACTIVE" },
        orderBy: { grantedAt: "desc" },
        take: 1,
        include: { advisor: { select: { name: true } }, suite: { select: { name: true } } },
      },
    },
  });
  if (!user) return { error: "That user no longer exists." };

  const headline = user.entitlements[0]?.suite?.name ?? user.entitlements[0]?.advisor?.name ?? "Your advisor";
  const raw = await issueToken(user.id, "SET_PASSWORD");
  const result = await sendEmail(setPasswordMail(user.email, raw, headline));
  await audit(admin.id, "user.setPassword.resend", "User", user.id, { email: user.email, delivered: result.ok, via: process.env.RESEND_API_KEY ? "resend" : "log" });

  if (!result.ok) return { error: `The email could not be sent: ${result.error ?? "unknown error"}.` };
  if (!process.env.RESEND_API_KEY) {
    return { ok: true, message: "Email is not connected yet, so the set password link was written to the server log instead of sent." };
  }
  return { ok: true, message: `Set password email sent to ${user.email}.` };
}

// ---------------------------------------------------------------------------
// Advisors
// ---------------------------------------------------------------------------

const listingSchema = z.object({
  advisorId: id,
  sortOrder: z.coerce.number().int("Sort order must be a whole number.").min(0).max(999),
  isActive: z.boolean(),
});

export async function updateAdvisorListing(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = listingSchema.safeParse({
    advisorId: str(form.get("advisorId")),
    sortOrder: str(form.get("sortOrder")) || "0",
    isActive: form.get("isActive") === "on",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const advisor = await db.advisor.findUnique({ where: { id: parsed.data.advisorId }, select: { id: true, slug: true, name: true } });
  if (!advisor) return { error: "That advisor no longer exists." };

  await db.advisor.update({ where: { id: advisor.id }, data: { sortOrder: parsed.data.sortOrder, isActive: parsed.data.isActive } });
  await audit(admin.id, "advisor.listing", "Advisor", advisor.id, { slug: advisor.slug, sortOrder: parsed.data.sortOrder, isActive: parsed.data.isActive });
  revalidatePath("/admin/advisors");
  revalidatePath("/advisors");
  return { ok: true, message: `${advisor.name} saved.` };
}

const questionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,32}$/, "Question ids can only use lowercase letters, numbers and hyphens."),
  question: z.string().min(1, "Every question needs some text.").max(300, "Keep each question under 300 characters."),
  placeholder: z.string().max(200, "Keep placeholders under 200 characters.").optional(),
});

/** Fills blank ids from the question text and keeps ids unique. */
function normaliseQuestions(rows: Array<Record<string, string>>): Array<{ id: string; question: string; placeholder?: string; required?: boolean }> {
  const seen = new Set<string>();
  const out: Array<{ id: string; question: string; placeholder?: string; required?: boolean }> = [];
  for (const r of rows) {
    const question = r.question ?? "";
    if (!question && !r.id) continue;
    let qid = r.id ? slugify(r.id) : slugify(question).split("-").slice(0, 3).join("-");
    if (!qid) qid = `q${out.length + 1}`;
    let unique = qid;
    let n = 2;
    while (seen.has(unique)) unique = `${qid}-${n++}`;
    seen.add(unique);
    out.push({ id: unique, question, placeholder: r.placeholder || undefined, required: r.required === "on" });
  }
  return out;
}

const advisorSchema = z.object({
  slug: z.string().min(1).max(40),
  name: z.string().min(1, "Give the advisor a name.").max(60),
  title: z.string().min(1, "Give the advisor a title.").max(80),
  tagline: z.string().min(1, "Write a short tagline.").max(200),
  description: z.string().min(1, "Write a description.").max(4000),
  systemPrompt: z.string().min(20, "The system prompt is where the advisor lives. Write at least a sentence.").max(60000),
  neverSay: z.array(z.string().max(300)).max(100),
  model: z.string().min(1, "Choose a model."),
  monthlyTokenCap: z.coerce.number().int("The cap must be a whole number of tokens.").min(1000, "The cap must be at least 1,000 tokens.").max(100_000_000),
  accentColor: hex.optional(),
  kajabiOfferIds: z.array(z.string().max(80)).max(50),
});

export async function updateAdvisor(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = advisorSchema.safeParse({
    slug: str(form.get("slug")),
    name: str(form.get("name")),
    title: str(form.get("title")),
    tagline: str(form.get("tagline")),
    description: str(form.get("description")),
    systemPrompt: str(form.get("systemPrompt")),
    neverSay: lines(str(form.get("neverSay"))),
    model: str(form.get("model")),
    monthlyTokenCap: str(form.get("monthlyTokenCap")),
    accentColor: optional(str(form.get("accentColor"))),
    kajabiOfferIds: lines(str(form.get("kajabiOfferIds"))),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const pricing = await getSetting("usage.pricing");
  if (!pricing[parsed.data.model]) return { error: "Choose a model that has pricing in Settings, so usage can be costed." };

  const questions = normaliseQuestions(indexedRows(form, "q"));
  for (const q of questions) {
    const check = questionSchema.safeParse(q);
    if (!check.success) return { error: firstIssue(check.error) };
  }

  const existing = await db.advisor.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } });
  if (!existing) return { error: "That advisor no longer exists." };

  const { slug, accentColor, ...rest } = parsed.data;
  await db.advisor.update({
    where: { id: existing.id },
    data: {
      ...rest,
      accentColor: accentColor ?? null,
      onboardingQuestions: questions.map(({ id: qid, question, placeholder }) => ({ id: qid, question, ...(placeholder ? { placeholder } : {}) })) as Prisma.InputJsonValue,
    },
  });
  await audit(admin.id, "advisor.update", "Advisor", existing.id, { slug, model: rest.model, monthlyTokenCap: rest.monthlyTokenCap, kajabiOfferIds: rest.kajabiOfferIds, questions: questions.length });
  revalidatePath("/admin/advisors");
  revalidatePath(`/admin/advisors/${slug}`);
  revalidatePath("/advisors");
  return { ok: true, message: `${rest.name} saved.` };
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

const suiteSchema = z.object({
  suiteId: id,
  members: z.array(id).max(50),
  monthlyTokenCap: z.coerce.number().int("The cap must be a whole number of tokens.").min(1000, "The cap must be at least 1,000 tokens.").max(100_000_000),
  kajabiOfferIds: z.array(z.string().max(80)).max(50),
  isActive: z.boolean(),
});

export async function updateSuite(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = suiteSchema.safeParse({
    suiteId: str(form.get("suiteId")),
    members: form.getAll("members").map((v) => str(v)).filter(Boolean),
    monthlyTokenCap: str(form.get("monthlyTokenCap")),
    kajabiOfferIds: lines(str(form.get("kajabiOfferIds"))),
    isActive: form.get("isActive") === "on",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { suiteId, members, monthlyTokenCap, kajabiOfferIds, isActive } = parsed.data;

  const suite = await db.suite.findUnique({ where: { id: suiteId }, select: { id: true, name: true, slug: true } });
  if (!suite) return { error: "That suite no longer exists." };

  const advisors = await db.advisor.findMany({ where: { id: { in: members } }, select: { id: true } });
  if (advisors.length !== members.length) return { error: "One of the chosen advisors no longer exists. Reload and try again." };

  await db.$transaction([
    db.suiteAdvisor.deleteMany({ where: { suiteId } }),
    db.suiteAdvisor.createMany({ data: members.map((advisorId) => ({ suiteId, advisorId })) }),
    db.suite.update({ where: { id: suiteId }, data: { monthlyTokenCap, kajabiOfferIds, isActive } }),
  ]);
  await audit(admin.id, "suite.update", "Suite", suiteId, { slug: suite.slug, members, monthlyTokenCap, kajabiOfferIds, isActive });
  revalidatePath("/admin/suites");
  revalidatePath("/advisors");
  return { ok: true, message: `${suite.name} saved.` };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function saveIntakeQuestions(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const questions = normaliseQuestions(indexedRows(form, "q"));
  if (!questions.length) return { error: "Keep at least one intake question, or restore the default set." };
  for (const q of questions) {
    const check = questionSchema.safeParse(q);
    if (!check.success) return { error: firstIssue(check.error) };
  }
  const value: IntakeQuestion[] = questions.map((q) => ({
    id: q.id,
    question: q.question,
    ...(q.placeholder ? { placeholder: q.placeholder } : {}),
    ...(q.required ? { required: true } : {}),
  }));
  await setSetting("intake.questions", value);
  await audit(admin.id, "setting.update", "Setting", "intake.questions", { count: value.length, ids: value.map((q) => q.id) });
  revalidatePath("/admin/settings");
  revalidatePath("/onboarding");
  return { ok: true, message: `Saved ${value.length} intake question${value.length === 1 ? "" : "s"}.` };
}

const pricingRow = z.object({
  model: z.string().regex(/^[a-z0-9.-]{3,60}$/, "Model ids use lowercase letters, numbers, dots and hyphens."),
  input: z.coerce.number().min(0, "Prices cannot be negative.").max(10000),
  output: z.coerce.number().min(0, "Prices cannot be negative.").max(10000),
});

export async function savePricing(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const rows = indexedRows(form, "p").filter((r) => r.model || r.input || r.output);
  if (!rows.length) return { error: "Keep at least one model, or restore the defaults." };

  const value: Record<string, ModelPricing> = {};
  for (const r of rows) {
    const check = pricingRow.safeParse({ model: r.model ?? "", input: r.input ?? "", output: r.output ?? "" });
    if (!check.success) return { error: firstIssue(check.error) };
    if (value[check.data.model]) return { error: `${check.data.model} is listed twice.` };
    value[check.data.model] = { inputPerMillion: check.data.input, outputPerMillion: check.data.output };
  }

  const inUse = await db.advisor.findMany({ where: { model: { notIn: Object.keys(value) } }, select: { name: true, model: true } });
  if (inUse.length) {
    return { error: `${inUse[0].name} uses ${inUse[0].model}, which would have no price. Keep it in the list or change the advisor's model first.` };
  }

  await setSetting("usage.pricing", value);
  await audit(admin.id, "setting.update", "Setting", "usage.pricing", value);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/advisors");
  return { ok: true, message: "Pricing saved." };
}

const chatSchema = z.object({
  warnAtPercent: z.coerce.number().int("Use a whole number.").min(1, "Warn somewhere between 1 and 100 percent.").max(100, "Warn somewhere between 1 and 100 percent."),
  maxHistoryMessages: z.coerce.number().int("Use a whole number.").min(2, "Keep at least 2 messages of history.").max(200, "Keep history under 200 messages."),
  summarizeAfterMessages: z.coerce.number().int("Use a whole number.").min(2, "Summarise after at least 2 messages.").max(200, "Summarise before 200 messages."),
});

export async function saveChatSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = chatSchema.safeParse({
    warnAtPercent: str(form.get("warnAtPercent")),
    maxHistoryMessages: str(form.get("maxHistoryMessages")),
    summarizeAfterMessages: str(form.get("summarizeAfterMessages")),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { warnAtPercent, maxHistoryMessages, summarizeAfterMessages } = parsed.data;

  // DEFAULTS is `as const`, so the scalar setting types are literals. The
  // casts are safe: the values are validated numbers and strings above.
  await setSetting("usage.warnAtPercent", warnAtPercent as SettingValue<"usage.warnAtPercent">);
  await setSetting("chat.maxHistoryMessages", maxHistoryMessages as SettingValue<"chat.maxHistoryMessages">);
  await setSetting("chat.summarizeAfterMessages", summarizeAfterMessages as SettingValue<"chat.summarizeAfterMessages">);
  await audit(admin.id, "setting.update", "Setting", "chat", { warnAtPercent, maxHistoryMessages, summarizeAfterMessages });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Chat settings saved." };
}

const kajabiAccessSchema = z.object({
  accessDays: z.coerce.number().int().min(1, "At least one day.").max(3660, "That is more than ten years."),
  freeAccessDays: z.coerce.number().int().min(1, "At least one day.").max(3660, "That is more than ten years."),
  offerAccessDays: z.string().max(4000),
});

/** One override per line: "2151358029 372" or "2151358029=372". Blank lines and comments are ignored. */
function parseOfferAccessDays(text: string): { ok: true; map: Record<string, number> } | { ok: false; error: string } {
  const map: Record<string, number> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(\d+)\s*[=:\s]\s*(\d+)$/);
    if (!m) return { ok: false, error: `Could not read "${line}". Use one offer id and a number of days per line, like 2151358029 372.` };
    const days = Number(m[2]);
    if (days < 1 || days > 3660) return { ok: false, error: `Days for offer ${m[1]} must be between 1 and 3660.` };
    map[m[1]] = days;
  }
  return { ok: true, map };
}

export async function saveKajabiAccessSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = kajabiAccessSchema.safeParse({
    accessDays: str(form.get("accessDays")),
    freeAccessDays: str(form.get("freeAccessDays")),
    offerAccessDays: str(form.get("offerAccessDays")),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const overrides = parseOfferAccessDays(parsed.data.offerAccessDays);
  if (!overrides.ok) return { error: overrides.error };
  const { accessDays, freeAccessDays } = parsed.data;

  await setSetting("kajabi.accessDays", accessDays as SettingValue<"kajabi.accessDays">);
  await setSetting("kajabi.freeAccessDays", freeAccessDays as SettingValue<"kajabi.freeAccessDays">);
  await setSetting("kajabi.offerAccessDays", overrides.map as SettingValue<"kajabi.offerAccessDays">);
  await audit(admin.id, "setting.update", "Setting", "kajabi", { accessDays, freeAccessDays, offerAccessDays: overrides.map });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Kajabi access settings saved. They apply to the next payment event; existing windows are unchanged." };
}

const brandSchema = z.object({
  appName: z.string().min(1, "The app needs a name.").max(80),
  supportEmail: z.email({ message: "Support email must be a valid address." }).max(254),
  kajabiLibraryUrl: z.url({ message: "The library link must be a full URL starting with https://." }).max(500),
  salesUrl: z.url({ message: "The sales link must be a full URL starting with https://." }).max(500),
});

export async function saveBrandSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = brandSchema.safeParse({
    appName: str(form.get("appName")),
    supportEmail: str(form.get("supportEmail")),
    kajabiLibraryUrl: str(form.get("kajabiLibraryUrl")),
    salesUrl: str(form.get("salesUrl")),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { appName, supportEmail, kajabiLibraryUrl, salesUrl } = parsed.data;

  await setSetting("brand.appName", appName as SettingValue<"brand.appName">);
  await setSetting("brand.supportEmail", supportEmail as SettingValue<"brand.supportEmail">);
  await setSetting("brand.kajabiLibraryUrl", kajabiLibraryUrl as SettingValue<"brand.kajabiLibraryUrl">);
  await setSetting("brand.salesUrl", salesUrl as SettingValue<"brand.salesUrl">);
  await audit(admin.id, "setting.update", "Setting", "brand", { appName, supportEmail, kajabiLibraryUrl, salesUrl });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Brand settings saved." };
}

const settingKeys = Object.keys(DEFAULTS) as SettingKey[];

/** Deleting the row makes getSetting fall back to the code default. */
export async function restoreSettingDefault(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const key = str(form.get("key"));
  if (!settingKeys.includes(key as SettingKey)) return { error: "Unknown setting." };
  await db.setting.deleteMany({ where: { key } });
  await audit(admin.id, "setting.restore", "Setting", key);
  revalidatePath("/admin/settings");
  return { ok: true, message: `${key} restored to its default.` };
}

// ---------------------------------------------------------------------------
// Kajabi
// ---------------------------------------------------------------------------

export async function replayKajabiEvent(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(str(form.get("eventId")));
  if (!parsed.success) return { error: "No event chosen." };

  const row = await db.kajabiEvent.findUnique({ where: { id: parsed.data } });
  if (!row) return { error: "That event no longer exists." };

  const ev = normaliseKajabiPayload(row.payload, row.eventType);
  let note: string;
  let failed = false;
  try {
    note = await applyKajabiEvent(row.id, ev);
    // Same rule as the webhook: an unmapped offer or a payload with no email is an error worth surfacing.
    const isProblem = ev.action !== "ignore" && (note.startsWith("offer") || note.startsWith("no "));
    await db.kajabiEvent.update({ where: { id: row.id }, data: { processedAt: new Date(), error: isProblem ? note : null } });
    failed = isProblem;
  } catch (err) {
    note = err instanceof Error ? err.message : "Replay failed.";
    failed = true;
    await db.kajabiEvent.update({ where: { id: row.id }, data: { error: note } });
  }
  await audit(admin.id, "kajabi.replay", "KajabiEvent", row.id, { eventType: row.eventType, memberEmail: row.memberEmail, offerId: row.offerId, result: note });
  revalidatePath("/admin/kajabi");
  revalidatePath("/admin/users");
  return failed ? { error: note } : { ok: true, message: note };
}

// ---------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const documentSchema = z.object({
  title: z.string().min(1, "Give the material a title.").max(160),
  sourceName: z.string().min(1, "Say where this came from, for citations.").max(160),
  scope: z.array(z.string().max(40)).max(50),
});

async function textFromForm(form: FormData): Promise<{ text?: string; error?: string }> {
  const pasted = str(form.get("text"));
  const file = form.get("file");

  if (file instanceof File && file.size > 0) {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".txt") && !name.endsWith(".md")) {
      return { error: "Upload a .txt or .md file. Export documents to plain text or Markdown first." };
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return { error: "That file is over 2 MB. Split it into parts and add each one." };
    }
    const text = (await file.text()).trim();
    if (!text) return { error: "That file has no readable text." };
    return { text };
  }

  if (pasted) {
    if (Buffer.byteLength(pasted, "utf8") > MAX_UPLOAD_BYTES) return { error: "That is over 2 MB of text. Split it into parts." };
    return { text: pasted };
  }
  return { error: "Paste the text or upload a .txt or .md file." };
}

export async function createKnowledgeDocument(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = documentSchema.safeParse({
    title: str(form.get("title")),
    sourceName: str(form.get("sourceName")),
    scope: form.getAll("scope").map((v) => str(v)).filter(Boolean),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const body = await textFromForm(form);
  if (!body.text) return { error: body.error ?? "Nothing to add." };

  if (parsed.data.scope.length) {
    const known = await db.advisor.findMany({ where: { slug: { in: parsed.data.scope } }, select: { slug: true } });
    if (known.length !== parsed.data.scope.length) return { error: "One of the chosen advisors no longer exists. Reload and try again." };
  }

  const doc = await db.knowledgeDocument.create({
    data: { title: parsed.data.title, sourceName: parsed.data.sourceName, advisorScope: parsed.data.scope, rawText: body.text },
  });
  await audit(admin.id, "knowledge.create", "KnowledgeDocument", doc.id, { title: doc.title, bytes: Buffer.byteLength(body.text, "utf8"), scope: parsed.data.scope });

  await ingestDocument(doc.id);
  const after = await db.knowledgeDocument.findUnique({ where: { id: doc.id }, select: { status: true, chunkCount: true, error: true } });
  revalidatePath("/admin/knowledge");

  if (after?.status === "READY") return { ok: true, message: `${doc.title} added and ready: ${after.chunkCount} passages.` };
  if (after?.status === "FAILED") return { error: `${doc.title} was saved but could not be processed: ${after.error ?? "unknown error"}.` };
  return { ok: true, message: `${doc.title} added: ${after?.chunkCount ?? 0} passages. ${after?.error ?? ""}`.trim() };
}

export async function reingestKnowledgeDocument(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(str(form.get("documentId")));
  if (!parsed.success) return { error: "No document chosen." };

  const doc = await db.knowledgeDocument.findUnique({ where: { id: parsed.data }, select: { id: true, title: true } });
  if (!doc) return { error: "That document no longer exists." };

  await ingestDocument(doc.id);
  const after = await db.knowledgeDocument.findUnique({ where: { id: doc.id }, select: { status: true, chunkCount: true, error: true } });
  await audit(admin.id, "knowledge.reingest", "KnowledgeDocument", doc.id, { title: doc.title, status: after?.status ?? null });
  revalidatePath("/admin/knowledge");
  revalidatePath(`/admin/knowledge/${doc.id}`);

  if (after?.status === "READY") return { ok: true, message: `Ready: ${after.chunkCount} passages.` };
  if (after?.status === "FAILED") return { error: after.error ?? "Processing failed." };
  return { ok: true, message: `${after?.chunkCount ?? 0} passages. ${after?.error ?? ""}`.trim() };
}

export async function deleteKnowledgeDocument(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = id.safeParse(str(form.get("documentId")));
  if (!parsed.success) return { error: "No document chosen." };

  const doc = await db.knowledgeDocument.findUnique({ where: { id: parsed.data }, select: { id: true, title: true, chunkCount: true } });
  if (!doc) return { error: "That document no longer exists." };

  // Chunks cascade from the schema.
  await db.knowledgeDocument.delete({ where: { id: doc.id } });
  await audit(admin.id, "knowledge.delete", "KnowledgeDocument", doc.id, { title: doc.title, chunkCount: doc.chunkCount });
  revalidatePath("/admin/knowledge");
  return { ok: true, message: `${doc.title} deleted.` };
}
