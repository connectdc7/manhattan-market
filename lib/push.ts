// New-order alerts on staff phones (Web Push). Server-only.
//
// Each phone that taps "Turn on order alerts" in the dashboard is saved in
// push_subscriptions (supabase/push-alerts.sql), tied to the staff member
// signed in on it. When an online order comes in (Stripe webhook), every
// saved phone of a current staff member gets a notification — it shows even
// when the phone is locked. Free: it goes through Apple's/Google's own push
// services, no SMS costs.
//
// Needs two Vercel environment variables (one-time keys, see README):
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  (Plain)
//   VAPID_PRIVATE_KEY             (Secret)
import webpush from "web-push";
import { supabaseAdmin } from "./supabase-admin";
import { SITE_URL } from "./site";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";

export function isPushConfigured() {
  return Boolean(PUBLIC_KEY && PRIVATE_KEY && supabaseAdmin);
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(SITE_URL, PUBLIC_KEY, PRIVATE_KEY);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string; // where tapping the notification goes
  tag?: string; // same tag replaces an earlier notification instead of stacking
};

type SubRow = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

async function sendTo(rows: SubRow[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const admin = supabaseAdmin;
  if (!admin || rows.length === 0) return { sent: 0, failed: 0 };
  configure();
  const message = JSON.stringify({ url: "/dashboard", ...payload });
  let sent = 0;
  let failed = 0;
  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          message,
          { TTL: 60 * 60, urgency: "high" }
        );
        sent++;
      } catch (err) {
        failed++;
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 = the phone turned alerts off or the app was removed — forget it.
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
        } else {
          console.error("[push] send failed", { status, error: err instanceof Error ? err.message : String(err) });
        }
      }
    })
  );
  return { sent, failed };
}

// Every phone of everyone currently on the Staff list.
export async function notifyAllStaff(payload: PushPayload) {
  const admin = supabaseAdmin;
  if (!isPushConfigured() || !admin) return { sent: 0, failed: 0 };
  const [{ data: subs, error }, { data: staff }] = await Promise.all([
    admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth"),
    admin.from("staff").select("user_id"),
  ]);
  if (error) {
    console.error("[push] couldn't read subscriptions", error.message);
    return { sent: 0, failed: 0 };
  }
  const current = new Set((staff ?? []).map((s) => s.user_id as string));
  return sendTo(((subs ?? []) as SubRow[]).filter((s) => current.has(s.user_id)), payload);
}

// Just one staff member's phones (the "Send test alert" button).
export async function notifyStaffMember(userId: string, payload: PushPayload) {
  const admin = supabaseAdmin;
  if (!isPushConfigured() || !admin) return { sent: 0, failed: 0 };
  const { data } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").eq("user_id", userId);
  return sendTo((data ?? []) as SubRow[], payload);
}

export async function saveSubscription(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent: string
) {
  const admin = supabaseAdmin;
  if (!admin) return "SUPABASE_SERVICE_ROLE_KEY is missing.";
  // Upsert on endpoint: the same phone signing in as someone else moves to them.
  const { error } = await admin.from("push_subscriptions").upsert(
    { user_id: userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent.slice(0, 300) },
    { onConflict: "endpoint" }
  );
  if (error) {
    return /push_subscriptions/i.test(error.message) ? "Run supabase/push-alerts.sql in Supabase first." : error.message;
  }
  return null;
}

export async function removeSubscription(endpoint: string) {
  await supabaseAdmin?.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
