// Read access to rewards signups, used only by the employee dashboard.
// Writing a signup happens directly in app/rewards/page.tsx.
import { supabase } from "./supabase";

export type RewardsSignup = { id: string; contact: string; created_at: string };

export async function getRewardsSignups(limit = 50): Promise<RewardsSignup[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("rewards_signups")
    .select("id, contact, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (error) console.error("getRewardsSignups:", error.message);
    return [];
  }

  return data as RewardsSignup[];
}
