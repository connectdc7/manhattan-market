// Sends the "your order's ready" text via Twilio's REST API directly
// (a plain fetch — no SDK needed for one call). Inert until all three
// TWILIO_* env vars are set; see the README's "Connecting SMS" section.
// Used only from app/api/notify/order-ready/route.ts — the auth token
// must never reach the browser, so this file is server-only.

export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER
  );
}

export async function sendSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!isTwilioConfigured()) return { ok: false, error: "not-configured" };

  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;

  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("sendSms: Twilio rejected the request —", res.status, text);
    return { ok: false, error: "send-failed" };
  }
  return { ok: true };
}
