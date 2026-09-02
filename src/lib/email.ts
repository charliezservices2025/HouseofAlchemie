import "server-only";
import { Resend } from "resend";

type Mail = { to: string; subject: string; html: string; text: string };

/**
 * Base URL for links in emails. Production sets APP_URL. Preview deployments
 * fall back to the URL Vercel assigns them, so a branch never emails a link
 * to the wrong host.
 */
function appUrl() {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Sends through Resend when RESEND_API_KEY is present. Without it, the email
 * is written to the server log so every flow is testable in development and
 * nothing is silently dropped.
 */
export async function sendEmail(mail: Mail): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "House of Alchemie <onboarding@resend.dev>";

  if (!key) {
    console.log(`\n[email:dev] To: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n`);
    return { ok: true, id: "dev-log" };
  }

  try {
    const resend = new Resend(key);
    const res = await resend.emails.send({ from, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text });
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true, id: res.data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
}

function shell(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#f7f5f0;font-family:Lato,'Helvetica Neue',Arial,sans-serif;color:#1e2222">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f0;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e3e0d8">
<tr><td style="padding:28px 32px 8px 32px;font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;color:#1e2222">House of Alchemi&#275;</td></tr>
<tr><td style="padding:8px 32px 0 32px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7372">${title}</td></tr>
<tr><td style="padding:16px 32px 32px 32px;font-size:16px;line-height:1.6">${bodyHtml}</td></tr>
<tr><td style="padding:0 32px 28px 32px;font-size:12px;line-height:1.5;color:#6b7372;border-top:1px solid #eeebe4;padding-top:16px">If you did not expect this email you can ignore it. Nothing changes unless the link is used.</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${href}" style="display:inline-block;background:#1e2222;color:#ffffff;text-decoration:none;padding:14px 22px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase">${label}</a></p><p style="font-size:13px;color:#6b7372;word-break:break-all">Or paste this into your browser:<br>${href}</p>`;
}

export function verifyEmailMail(to: string, rawToken: string): Mail {
  const href = `${appUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`;
  return {
    to,
    subject: "Confirm your email for House of Alchemie",
    html: shell("Confirm your email", `<p>Welcome. One click and your advisors are ready for you.</p>${button(href, "Confirm email")}<p style="font-size:13px;color:#6b7372">This link works for 24 hours.</p>`),
    text: `Welcome to House of Alchemie.\n\nConfirm your email by opening this link (valid for 24 hours):\n${href}\n`,
  };
}

export function resetPasswordMail(to: string, rawToken: string): Mail {
  const href = `${appUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
  return {
    to,
    subject: "Reset your House of Alchemie password",
    html: shell("Reset your password", `<p>Use the button below to choose a new password.</p>${button(href, "Choose a new password")}<p style="font-size:13px;color:#6b7372">This link works for one hour and can be used once.</p>`),
    text: `Reset your House of Alchemie password by opening this link (valid for one hour):\n${href}\n`,
  };
}

export function setPasswordMail(to: string, rawToken: string, advisorName: string): Mail {
  const href = `${appUrl()}/set-password?token=${encodeURIComponent(rawToken)}`;
  return {
    to,
    subject: `${advisorName} is ready for you`,
    html: shell("Your access is live", `<p>Thank you for joining House of Alchemie. ${advisorName} is waiting. Set a password and you are in.</p>${button(href, "Set my password")}<p style="font-size:13px;color:#6b7372">This link works for seven days. If it expires, use "Forgot password" on the sign in page with this same email address.</p>`),
    text: `Thank you for joining House of Alchemie. ${advisorName} is ready.\n\nSet your password here (valid for seven days):\n${href}\n`,
  };
}
