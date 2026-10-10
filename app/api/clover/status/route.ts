// Tells the dashboard whether Clover sync is configured (env vars set) and
// connected (a merchant has completed OAuth) — safe to call from the
// browser since it never returns the access token itself.
import { NextResponse, after } from "next/server";
import { maybeAutoSyncClover } from "@/lib/clover-autosync";
import { getCloverConnection, isCloverConfigured, isCloverTokenMode } from "@/lib/clover";
import { isSupabaseAdminConfigured } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = isCloverConfigured() && isSupabaseAdminConfigured;
  if (!configured) {
    return NextResponse.json({ configured: false, connected: false });
  }

  const connection = await getCloverConnection();
  // Opening the dashboard also keeps the menu fresh (API-token mode).
  after(maybeAutoSyncClover);
  return NextResponse.json({
    configured: true,
    connected: Boolean(connection),
    merchantId: connection?.merchant_id ?? null,
    connectedAt: connection?.connected_at || null,
    mode: isCloverTokenMode() ? "token" : "oauth",
  });
}
