// Sends restock-notification emails via Resend's REST API (a plain fetch —
// no SDK needed for one call). Inert until RESEND_API_KEY and
// RESEND_FROM_EMAIL are both set; see the README's "Connecting restock
// emails" section. Used only from app/api/restock/notify/route.ts — the
// API key must never reach the browser, so this file is server-only.

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!isEmailConfigured()) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to,
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("sendEmail: Resend rejected the request —", res.status, body);
    return false;
  }
  return true;
}
