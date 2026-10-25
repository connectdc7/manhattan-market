// Store-wide settings the owner controls from the dashboard (Settings tab).
// Right now: the flat service fee added to delivery orders. Stored in the
// `store_settings` table (supabase/service-fee.sql) — anyone can read it,
// only owners can change it (enforced by the database).
import { supabase } from "./supabase";

export type PaymentProvider = "stripe" | "clover";

export type StoreSettings = { deliveryServiceFee: number; alcoholDelivery: boolean; paymentProvider: PaymentProvider };

export const DEFAULT_SETTINGS: StoreSettings = { deliveryServiceFee: 0, alcoholDelivery: false, paymentProvider: "stripe" };

export async function getStoreSettings(): Promise<StoreSettings> {
  if (!supabase) return DEFAULT_SETTINGS;
  let { data, error } = await supabase
    .from("store_settings")
    .select("delivery_service_fee, alcohol_delivery, payment_provider")
    .eq("id", "singleton")
    .maybeSingle();
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
  const row = data as { delivery_service_fee: number; alcohol_delivery?: boolean; payment_provider?: string };
  return {
    deliveryServiceFee: Number(row.delivery_service_fee) || 0,
    alcoholDelivery: Boolean(row.alcohol_delivery),
    paymentProvider: row.payment_provider === "clover" ? "clover" : "stripe",
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
