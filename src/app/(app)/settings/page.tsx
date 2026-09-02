import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getSession, listActiveSessions } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { isFontPreset, isTextScale } from "@/lib/fonts";
import { Section } from "@/components/settings/section";
import { ProfileForm } from "@/components/settings/profile-form";
import { TypeForm } from "@/components/settings/type-form";
import { PasswordForm } from "@/components/settings/password-form";
import { SessionsList, type SessionRow } from "@/components/settings/sessions-list";
import { describeDevice, relativeTime } from "@/components/settings/format";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  const [session, sessions, settings] = await Promise.all([
    getSession(),
    listActiveSessions(user.id),
    getSettings(["brand.kajabiLibraryUrl", "brand.supportEmail"]),
  ]);

  const currentId = session?.sessionId;
  const now = new Date();
  const rows: SessionRow[] = sessions.map((s) => ({
    id: s.id,
    device: describeDevice(s.userAgent),
    lastSeen: relativeTime(s.lastSeenAt, now),
    current: s.id === currentId,
  }));

  const fontPreset = isFontPreset(user.fontPreset) ? user.fontPreset : "house";
  const textScale = isTextScale(user.textScale) ? user.textScale : 100;
  const libraryUrl = settings["brand.kajabiLibraryUrl"];
  const supportEmail = settings["brand.supportEmail"];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <header className="mb-8">
        <p className="eyebrow">Account</p>
        <h1 className="mt-1 text-3xl sm:text-4xl">Settings</h1>
      </header>

      <div className="flex flex-col gap-6">
        <Section id="profile" eyebrow="Profile" title="Your details">
          <ProfileForm name={user.name} email={user.email} />
        </Section>

        <Section
          id="type"
          eyebrow="Type and size"
          title="How the House reads"
          description="Choose the type pairing and size you find easiest. It applies everywhere you are signed in."
        >
          <TypeForm fontPreset={fontPreset} textScale={textScale} />
        </Section>

        <Section
          id="password"
          eyebrow="Password"
          title="Change your password"
          description="Changing it signs you out on every other device."
        >
          <PasswordForm />
        </Section>

        <Section
          id="sessions"
          eyebrow="Devices"
          title="Where you are signed in"
          description="Every device with an open session. Sign out anything you do not recognise."
        >
          <SessionsList sessions={rows} />
        </Section>

        <Section
          id="plan"
          eyebrow="Your plan"
          title="Managed on Kajabi"
          description="Your advisors, suites and billing live in your Kajabi library. Anything you add there unlocks here within a few minutes, as long as it is under this same email."
        >
          <div className="flex flex-col gap-4">
            <div>
              <a href={libraryUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full sm:w-auto">
                Open your Kajabi library
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
            <p className="text-sm text-ink-muted">
              Questions about your plan? Write to{" "}
              <a href={`mailto:${supportEmail}`} className="text-sage underline underline-offset-4">
                {supportEmail}
              </a>
              .
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}
