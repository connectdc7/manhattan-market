// Store-wide settings the owner controls from the dashboard (Settings tab).
// Right now: the flat service fee added to delivery orders. Stored in the
// `store_settings` table (supabase/service-fee.sql) — anyone can read it,
// only owners can change it (enforced by the database).
import { supabase } from "./supabase";

export type PaymentProvider = "stripe" | "clover";

// First-order welcome offer (supabase/welcome-offer.sql): e.g. $5 off orders
// over $20 with code WELCOME5, once per phone number.
export type WelcomeOffer = { enabled: boolean; code: string; amount: number; min: number };

export type StoreSettings = {
  deliveryServiceFee: number;
  alcoholDelivery: boolean;
  paymentProvider: PaymentProvider;
  welcomeOffer: WelcomeOffer;
};

const DEFAULT_WELCOME: WelcomeOffer = { enabled: false, code: "WELCOME5", amount: 5, min: 20 };

export const DEFAULT_SETTINGS: StoreSettings = {
  deliveryServiceFee: 0,
  alcoholDelivery: false,
  paymentProvider: "stripe",
  welcomeOffer: DEFAULT_WELCOME,
};

export async function getStoreSettings(): Promise<StoreSettings> {
  if (!supabase) return DEFAULT_SETTINGS;
  let { data, error } = await supabase
    .from("store_settings")
    .select("delivery_service_fee, alcohol_delivery, payment_provider, welcome_offer_enabled, welcome_code, welcome_amount, welcome_min")
    .eq("id", "singleton")
    .maybeSingle();
  if (error) {
    // welcome offer columns not added yet (supabase/welcome-offer.sql).
    ({ data, error } = await supabase
      .from("store_settings")
      .select("delivery_service_fee, alcohol_delivery, payment_provider")
      .eq("id", "singleton")
      .maybeSingle());
  }
  if (error) {
    // payment_provider not added yet (supabase/clover-payments.sql).
    ({ data, error } = await supabase
      .from("store_settings")
      .select("delivery_service_fee, alcohol_delivery")
      .eq("id", "singleton")
      .maybeSingle());
  }
  if (error) {
    // alcohol_delivery not added yet (supabase/alcohol.sql) — read the rest.
    ({ data, error } = await supabase.from("store_settings").select("delivery_service_fee").eq("id", "singleton").maybeSingle());
  }
  if (error || !data) {
    if (error) console.error("getStoreSettings:", error.message);
    return DEFAULT_SETTINGS;
  }
  const row = data as {
    delivery_service_fee: number;
    alcohol_delivery?: boolean;
    payment_provider?: string;
    welcome_offer_enabled?: boolean;
    welcome_code?: string;
    welcome_amount?: number;
    welcome_min?: number;
  };
  return {
    deliveryServiceFee: Number(row.delivery_service_fee) || 0,
    alcoholDelivery: Boolean(row.alcohol_delivery),
    paymentProvider: row.payment_provider === "clover" ? "clover" : "stripe",
    welcomeOffer: {
      enabled: Boolean(row.welcome_offer_enabled),
      code: (row.welcome_code || DEFAULT_WELCOME.code).toUpperCase(),
      amount: Number(row.welcome_amount ?? DEFAULT_WELCOME.amount) || DEFAULT_WELCOME.amount,
      min: Number(row.welcome_min ?? DEFAULT_WELCOME.min) || 0,
    },
  };
}

export async function setDeliveryServiceFee(fee: number): Promise<string | null> {
  if (!supabase) return "Supabase isn't configured.";
  if (!Number.isFinite(fee) || fee < 0 || fee > 20) return "Enter an amount between $0 and $20.";
  const { data, error } = await supabase
    .from("store_settings")
    .update({ delivery_service_fee: Math.round(fee * 100) / 100, updated_at: new Date().toISOString() })
    .eq("id", "singleton")
    .select("id");
  if (error) return error.message;
  if (!data || data.length === 0) return "Only the owner can change this setting.";
  return null;
}

// Owner switch: allow wine/beer on delivery orders (off = pickup only).
export async function setAlcoholDelivery(on: boolean): Promise<string | null> {
  if (!supabase) return "Supabase isn't configured.";
  const { data, error } = await supabase
    .from("store_settings")
    .update({ alcohol_delivery: on, updated_at: new Date().toISOString() })
    .eq("id", "singleton")
    .select("id");
  if (error) return /alcohol_delivery/.test(error.message) ? "Run supabase/alcohol.sql first." : error.message;
  if (!data || data.length === 0) return "Only the owner can change this setting.";
  return null;
}

// Owner switch: which processor online customers pay through. Clover only
// takes effect once its keys are in Vercel (see lib/clover-checkout.ts) —
// until then checkout keeps using Stripe.
export async function setPaymentProvider(provider: PaymentProvider): Promise<string | null> {
  if (!supabase) return "Supabase isn't configured.";
  const { data, error } = await supabase
    .from("store_settings")
    .update({ payment_provider: provider, updated_at: new Date().toISOString() })
    .eq("id", "singleton")
    .select("id");
  if (error) return /payment_provider/.test(error.message) ? "Run supabase/clover-payments.sql first." : error.message;
  if (!data || data.length === 0) return "Only the owner can change this setting.";
  return null;
}

// Owner: turn the welcome offer on/off and set its code, amount and minimum.
export async function setWelcomeOffer(offer: WelcomeOffer): Promise<string | null> {
  if (!supabase) return "Supabase isn't configured.";
  const code = offer.code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,20}$/.test(code)) return "Use 3–20 letters or numbers for the code (e.g. WELCOME5).";
  if (!Number.isFinite(offer.amount) || offer.amount <= 0 || offer.amount > 50) return "Enter a discount between $1 and $50.";
  if (!Number.isFinite(offer.min) || offer.min < 0 || offer.min > 500) return "Enter a minimum between $0 and $500.";
  if (offer.min > 0 && offer.amount >= offer.min) return "The discount must be less than the minimum order.";
  const { data, error } = await supabase
    .from("store_settings")
    .update({
      welcome_offer_enabled: offer.enabled,
      welcome_code: code,
      welcome_amount: Math.round(offer.amount * 100) / 100,
      welcome_min: Math.round(offer.min * 100) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "singleton")
    .select("id");
  if (error) return /welcome/.test(error.message) ? "Run supabase/welcome-offer.sql first." : error.message;
  if (!data || data.length === 0) return "Only the owner can change this setting.";
  return null;
}
