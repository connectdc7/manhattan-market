// Uber Direct (on-demand courier delivery) — server-only helpers.
//
// Inert until UBER_CUSTOMER_ID, UBER_CLIENT_ID and UBER_CLIENT_SECRET are
// set (see README "Uber delivery"). Until then the site keeps working: the
// checkout simply takes delivery orders without a fee or address check and
// staff arrange delivery themselves, the same graceful-degradation pattern
// as Clover, Stripe and Twilio.
//
// API reference: developer.uber.com/docs/deliveries
//   token:   POST https://auth.uber.com/oauth/v2/token (client_credentials, scope eats.deliveries)
//   quote:   POST https://api.uber.com/v1/customers/{customer_id}/delivery_quotes
//   create:  POST https://api.uber.com/v1/customers/{customer_id}/deliveries
//   cancel:  POST https://api.uber.com/v1/customers/{customer_id}/deliveries/{id}/cancel
// Never import this from a "use client" file — the client secret must stay on the server.
import crypto from "crypto";
import { BUSINESS, SITE_NAME } from "./site";

export type DeliveryAddress = {
  name: string;
  street: string;
  apt?: string;
  city: string;
  state: string;
  zip: string;
  notes?: string;
};

export type UberQuote = { id: string; fee: number; currency: string; dropoffEta: string | null; durationMin: number | null };

export type UberDelivery = {
  id: string;
  status: string;
  tracking_url?: string;
  fee?: number;
  courier?: { name?: string; vehicle_type?: string; phone_number?: string } | null;
};

export function isUberConfigured(): boolean {
  return Boolean(process.env.UBER_CUSTOMER_ID && process.env.UBER_CLIENT_ID && process.env.UBER_CLIENT_SECRET);
}

const API = () => `https://api.uber.com/v1/customers/${process.env.UBER_CUSTOMER_ID}`;

// The access token lasts ~30 days. Cached per server instance; a cold start
// just asks for a fresh one.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const res = await fetch("https://auth.uber.com/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.UBER_CLIENT_ID!,
      client_secret: process.env.UBER_CLIENT_SECRET!,
      grant_type: "client_credentials",
      scope: "eats.deliveries",
    }).toString(),
  });
  if (!res.ok) {
    console.error("[uber] token request failed", res.status, await res.text().catch(() => ""));
    throw new Error("Couldn't sign in to Uber — check UBER_CLIENT_ID / UBER_CLIENT_SECRET.");
  }
  const body = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return body.access_token;
}

async function uberFetch(path: string, init: RequestInit = {}) {
  const token = await getToken();
  const res = await fetch(`${API()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text };
  }
  return { ok: res.ok, status: res.status, body };
}

// Uber wants addresses as a JSON *string* of this structured shape.
function uberAddress(a: { street: string; apt?: string; city: string; state: string; zip: string }): string {
  return JSON.stringify({
    street_address: [a.street, a.apt].filter((s) => s && s.trim()).map((s) => s!.trim()),
    city: a.city.trim(),
    state: a.state.trim(),
    zip_code: a.zip.trim(),
    country: "US",
  });
}

const STORE_ADDRESS = () =>
  uberAddress({
    street: BUSINESS.streetAddress,
    city: BUSINESS.addressLocality,
    state: BUSINESS.addressRegion,
    zip: BUSINESS.postalCode,
  });

// US numbers → E.164 (+1XXXXXXXXXX). Returns null if it isn't a usable number.
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function validateDeliveryAddress(a: Partial<DeliveryAddress> | null | undefined): string | null {
  if (!a) return "Enter a delivery address.";
  if (!a.name?.trim()) return "Enter the name for the delivery.";
  if (!a.street?.trim()) return "Enter a street address.";
  if (!a.city?.trim() || !a.state?.trim()) return "Enter the city and state.";
  if (!/^\d{5}(-\d{4})?$/.test(a.zip?.trim() ?? "")) return "Enter a valid ZIP code.";
  return null;
}

const UNDELIVERABLE_CODES = new Set([
  "address_undeliverable",
  "address_undeliverable_limited_couriers",
  "pickup_window_too_small",
  "dropoff_deadline_too_early",
  "invalid_params",
  "couriers_busy",
]);

export type QuoteResult =
  | { ok: true; quote: UberQuote }
  | { ok: false; undeliverable: boolean; message: string };

export async function getDeliveryQuote(a: DeliveryAddress, phone: string | null): Promise<QuoteResult> {
  try {
    const res = await uberFetch("/delivery_quotes", {
      method: "POST",
      body: JSON.stringify({
        pickup_address: STORE_ADDRESS(),
        dropoff_address: uberAddress(a),
        pickup_phone_number: BUSINESS.telephone,
        ...(toE164(phone) ? { dropoff_phone_number: toE164(phone) } : {}),
      }),
    });
    if (!res.ok) {
      const code = String(res.body.code ?? "");
      console.error("[uber] quote failed", res.status, res.body);
      return {
        ok: false,
        undeliverable: UNDELIVERABLE_CODES.has(code) || res.status === 400,
        message:
          code === "couriers_busy" || code === "address_undeliverable_limited_couriers"
            ? "No Uber couriers are available right now — please choose pickup."
            : res.status === 400
              ? "Sorry, we can't deliver to that address — please choose pickup."
              : "Couldn't get a delivery quote right now — please try again or choose pickup.",
      };
    }
    const b = res.body as { id: string; fee: number; currency?: string; dropoff_eta?: string; duration?: number };
    return {
      ok: true,
      quote: {
        id: b.id,
        fee: Number(b.fee) / 100,
        currency: b.currency ?? "usd",
        dropoffEta: b.dropoff_eta ?? null,
        durationMin: typeof b.duration === "number" ? b.duration : null,
      },
    };
  } catch (err) {
    console.error("[uber] quote threw", err);
    return { ok: false, undeliverable: false, message: "Couldn't get a delivery quote right now — please try again or choose pickup." };
  }
}

export async function createUberDelivery(params: {
  quoteId: string;
  orderId: string;
  address: DeliveryAddress;
  phone: string;
  items: { name: string; qty: number; price: number }[];
}): Promise<{ ok: true; delivery: UberDelivery } | { ok: false; message: string }> {
  const shortId = params.orderId.slice(0, 6).toUpperCase();
  const totalCents = Math.round(params.items.reduce((s, i) => s + i.price * i.qty, 0) * 100);
  const res = await uberFetch("/deliveries", {
    method: "POST",
    body: JSON.stringify({
      quote_id: params.quoteId,
      external_id: params.orderId,
      pickup_name: SITE_NAME,
      pickup_address: STORE_ADDRESS(),
      pickup_phone_number: BUSINESS.telephone,
      pickup_notes: `Online order WEB #${shortId} — ask at the counter.`,
      dropoff_name: params.address.name.trim(),
      dropoff_address: uberAddress(params.address),
      dropoff_phone_number: params.phone,
      ...(params.address.notes?.trim() ? { dropoff_notes: params.address.notes.trim().slice(0, 280) } : {}),
      manifest_reference: `WEB #${shortId}`,
      manifest_total_value: totalCents,
      manifest_items: params.items.map((i) => ({
        name: i.name,
        quantity: i.qty,
        size: "small",
        price: Math.round(i.price * 100),
      })),
      // Test accounts only: a simulated "robot" courier that moves the
      // delivery through every status automatically, so the whole flow can
      // be tried without a real driver. Set UBER_ROBO_COURIER=true while
      // testing; remove it for live deliveries.
      ...(process.env.UBER_ROBO_COURIER === "true"
        ? { test_specifications: { robo_courier_specification: { mode: "auto" } } }
        : {}),
    }),
  });
  if (!res.ok) {
    console.error("[uber] create delivery failed", res.status, res.body);
    const msg = String(res.body.message ?? "");
    return { ok: false, message: `Uber rejected the delivery (HTTP ${res.status})${msg ? `: ${msg}` : "."}` };
  }
  return { ok: true, delivery: res.body as unknown as UberDelivery };
}

export async function cancelUberDelivery(deliveryId: string): Promise<{ ok: boolean; message?: string }> {
  const res = await uberFetch(`/deliveries/${encodeURIComponent(deliveryId)}/cancel`, { method: "POST", body: "{}" });
  if (!res.ok) {
    console.error("[uber] cancel failed", res.status, res.body);
    return { ok: false, message: String(res.body.message ?? `Uber couldn't cancel it (HTTP ${res.status}).`) };
  }
  return { ok: true };
}

// Uber signs each webhook with the webhook's own signing key (Uber Direct
// dashboard → Developer → Webhooks → ⋯ → Edit). HMAC-SHA256 of the raw body, hex.
export function verifyUberSignature(rawBody: string, signature: string | null): boolean {
  const key = process.env.UBER_WEBHOOK_SIGNING_KEY;
  if (!key || !signature) return false;
  const expected = crypto.createHmac("sha256", key).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim().toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Plain-English labels for the dashboard.
export const UBER_STATUS_LABEL: Record<string, string> = {
  pending: "Finding a courier",
  pickup: "Courier heading to store",
  pickup_complete: "Picked up",
  dropoff: "On the way to customer",
  delivered: "Delivered",
  canceled: "Canceled",
  returned: "Returned to store",
};
