// Store-wide settings the owner controls from the dashboard (Settings tab).
// Right now: the flat service fee added to delivery orders. Stored in the
// `store_settings` table (supabase/service-fee.sql) — anyone can read it,
// only owners can change it (enforced by the database).
import { supabase } from "./supabase";

export type StoreSettings = { deliveryServiceFee: number };

export const DEFAULT_SETTINGS: StoreSettings = { deliveryServiceFee: 0 };

export async function getStoreSettings(): Promise<StoreSettings> {
  if (!supabase) return DEFAULT_SETTINGS;
  const { data, error } = await supabase
    .from("store_settings")
    .select("delivery_service_fee")
    .eq("id", "singleton")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("getStoreSettings:", error.message);
    return DEFAULT_SETTINGS;
  }
  return { deliveryServiceFee: Number(data.delivery_service_fee) || 0 };
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
