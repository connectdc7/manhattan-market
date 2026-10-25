// Browser side of new-order alerts (see lib/push.ts for the server side).
import { staffFetch } from "./staff-auth";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type AlertSupport =
  | "ok" // can turn alerts on here
  | "needs-home-screen" // iPhone/iPad in Safari: add to Home Screen first
  | "unsupported" // old browser
  | "not-configured"; // VAPID keys not added in Vercel yet

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function alertSupport(): AlertSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!PUBLIC_KEY) return "not-configured";
  const hasApis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIOS() && !isStandalone()) return "needs-home-screen";
  return hasApis ? "ok" : "unsupported";
}

function keyToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

// Is this phone currently set to get alerts?
export async function alertsOnHere(): Promise<boolean> {
  if (alertSupport() !== "ok") return false;
  const reg = await registration();
  const sub = await reg.pushManager.getSubscription();
  return Boolean(sub) && Notification.permission === "granted";
}

// Asks permission (must be called from a tap) and saves this phone.
export async function turnOnAlerts(): Promise<string | null> {
  if (alertSupport() !== "ok") return "This browser can't get alerts.";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return "Notifications are blocked for this site. Allow them in the phone's Settings → Notifications, then try again.";
  }
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(PUBLIC_KEY) });
  }
  const res = await staffFetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return body.error || "Couldn't save this phone — try again.";
  }
  return null;
}

// Stops alerts on this phone (also used when signing out).
export async function turnOffAlerts(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await staffFetch("/api/push", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe();
  } catch {
    // best-effort
  }
}

export async function sendTestAlert(): Promise<string> {
  const res = await staffFetch("/api/push/test", { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return body.error || "Couldn't send a test alert.";
  return body.sent > 0 ? "Test alert sent — it should pop up in a few seconds." : "No phones with alerts on for your account yet.";
}
