import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { DEFAULTS, getSettings, type SettingKey } from "@/lib/settings";
import { restoreSettingDefault, saveBrandSettings, saveChatSettings, saveKajabiAccessSettings } from "@/app/(admin)/admin/actions";
import { ActionButton, ActionForm } from "@/components/admin/action-form";
import { IntakeQuestionsForm, PricingForm } from "@/components/admin/settings-forms";
import { PageHeader, Section, Field } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Settings" };

const KEYS = Object.keys(DEFAULTS) as SettingKey[];

function Restore({ keys, customised }: { keys: SettingKey[]; customised: Set<string> }) {
  const changed = keys.filter((k) => customised.has(k));
  if (changed.length === 0) return <span className="text-xs text-ink-muted">Using the defaults</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {changed.map((k) => (
        <ActionButton key={k} action={restoreSettingDefault} label={`Restore ${k}`} pendingLabel="Restoring" confirm={`Restore ${k} to its default?`} hidden={{ key: k }} variant="btn btn-ghost" />
      ))}
    </div>
  );
}

export default async function AdminSettingsPage() {
  await requireAdmin();
  const [settings, rows] = await Promise.all([getSettings(KEYS), db.setting.findMany({ select: { key: true } })]);
  const customised = new Set(rows.map((r) => r.key));

  const d = DEFAULTS;

  return (
    <>
      <PageHeader eyebrow="Settings" title="How the house runs" description="Each setting shows its default beside it. Restore puts the default back without a developer." />

      <Section title="Shared intake" description="Asked once at onboarding and remembered by every advisor. Answers are stored by id, so renaming an id starts that answer fresh." actions={<Restore keys={["intake.questions"]} customised={customised} />}>
        <IntakeQuestionsForm questions={settings["intake.questions"]} />
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-ink-muted">Default questions</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-soft">
            {d["intake.questions"].map((q) => (
              <li key={q.id}>
                {q.question} <span className="font-mono text-xs text-ink-muted">{q.id}</span>
                {q.required && <span className="ml-1 text-xs text-ink-muted">required</span>}
              </li>
            ))}
          </ol>
        </details>
      </Section>

      <Section title="Model pricing" description="Dollars per million tokens. Used to estimate cost in Usage and on the overview. Advisors can only use models listed here." actions={<Restore keys={["usage.pricing"]} customised={customised} />}>
        <PricingForm pricing={settings["usage.pricing"]} />
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-ink-muted">Default pricing</summary>
          <ul className="mt-2 space-y-1 text-ink-soft">
            {Object.entries(d["usage.pricing"]).map(([m, p]) => (
              <li key={m}>
                <span className="font-mono text-xs">{m}</span>: ${p.inputPerMillion} in, ${p.outputPerMillion} out
              </li>
            ))}
          </ul>
        </details>
      </Section>

      <Section title="Chat and caps" description="How much history goes into each answer, when to summarise, and when subscribers are warned about their monthly allowance." actions={<Restore keys={["usage.warnAtPercent", "chat.maxHistoryMessages", "chat.summarizeAfterMessages"]} customised={customised} />}>
        <ActionForm action={saveChatSettings} submitLabel="Save chat settings" className="max-w-2xl">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Warn at percent" htmlFor="warnAtPercent" hint={`Default ${d["usage.warnAtPercent"]}. Subscribers see a note once they pass this share of their cap.`}>
              <input id="warnAtPercent" name="warnAtPercent" type="number" inputMode="numeric" className="field" defaultValue={settings["usage.warnAtPercent"]} min={1} max={100} required />
            </Field>
            <Field label="History messages" htmlFor="maxHistoryMessages" hint={`Default ${d["chat.maxHistoryMessages"]}. Recent messages sent with each answer. More is smarter and costs more.`}>
              <input id="maxHistoryMessages" name="maxHistoryMessages" type="number" inputMode="numeric" className="field" defaultValue={settings["chat.maxHistoryMessages"]} min={2} max={200} required />
            </Field>
            <Field label="Summarise after" htmlFor="summarizeAfterMessages" hint={`Default ${d["chat.summarizeAfterMessages"]}. A conversation longer than this gets a rolling summary.`}>
              <input id="summarizeAfterMessages" name="summarizeAfterMessages" type="number" inputMode="numeric" className="field" defaultValue={settings["chat.summarizeAfterMessages"]} min={2} max={200} required />
            </Field>
          </div>
        </ActionForm>
      </Section>

      <Section
        title="Kajabi access windows"
        description="Kajabi only tells us when a payment succeeds, never when a subscription ends. So each payment buys a window of access, and a cancellation, refund or failed renewal simply means the window is not extended. Set the window a little longer than the billing period to cover Kajabi's payment retries."
        actions={<Restore keys={["kajabi.accessDays", "kajabi.freeAccessDays", "kajabi.offerAccessDays"]} customised={customised} />}
      >
        <ActionForm action={saveKajabiAccessSettings} submitLabel="Save access windows" className="max-w-2xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Days per payment" htmlFor="accessDays" hint={`Default ${d["kajabi.accessDays"]}: a 31 day month plus 7 days for retries.`}>
              <input id="accessDays" name="accessDays" type="number" inputMode="numeric" className="field" defaultValue={settings["kajabi.accessDays"]} min={1} max={3660} required />
            </Field>
            <Field label="Days for a free start" htmlFor="freeAccessDays" hint={`Default ${d["kajabi.freeAccessDays"]}: a 7 day trial plus 3 days. The first real charge extends it.`}>
              <input id="freeAccessDays" name="freeAccessDays" type="number" inputMode="numeric" className="field" defaultValue={settings["kajabi.freeAccessDays"]} min={1} max={3660} required />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Per offer overrides" htmlFor="offerAccessDays" hint="Optional. One per line: the Kajabi offer id, a space, the days. Use it for anything that is not monthly, for example an annual plan at 372.">
              <textarea
                id="offerAccessDays"
                name="offerAccessDays"
                className="field min-h-24 font-mono text-sm"
                defaultValue={Object.entries(settings["kajabi.offerAccessDays"]).map(([k, v]) => `${k} ${v}`).join("\n")}
                placeholder="2151358029 372"
                spellCheck={false}
              />
            </Field>
          </div>
        </ActionForm>
      </Section>

      <Section title="Brand" description="Names and links used in the app and in emails." actions={<Restore keys={["brand.appName", "brand.supportEmail", "brand.kajabiLibraryUrl", "brand.salesUrl"]} customised={customised} />}>
        <ActionForm action={saveBrandSettings} submitLabel="Save brand" className="max-w-2xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="App name" htmlFor="appName" hint={`Default: ${d["brand.appName"]}`}>
              <input id="appName" name="appName" className="field" defaultValue={settings["brand.appName"]} required maxLength={80} autoComplete="off" />
            </Field>
            <Field label="Support email" htmlFor="supportEmail" hint={`Default: ${d["brand.supportEmail"]}`}>
              <input id="supportEmail" name="supportEmail" type="email" className="field" defaultValue={settings["brand.supportEmail"]} required maxLength={254} autoComplete="off" />
            </Field>
            <Field label="Kajabi library link" htmlFor="kajabiLibraryUrl" hint={`Default: ${d["brand.kajabiLibraryUrl"]}`}>
              <input id="kajabiLibraryUrl" name="kajabiLibraryUrl" type="url" className="field" defaultValue={settings["brand.kajabiLibraryUrl"]} required maxLength={500} autoComplete="off" />
            </Field>
            <Field label="Sales page link" htmlFor="salesUrl" hint={`Default: ${d["brand.salesUrl"]}`}>
              <input id="salesUrl" name="salesUrl" type="url" className="field" defaultValue={settings["brand.salesUrl"]} required maxLength={500} autoComplete="off" />
            </Field>
          </div>
        </ActionForm>
      </Section>
    </>
  );
}
