// Tells the dashboard whether Clover sync is configured (env vars set) and
// connected (a merchant has completed OAuth) — safe to call from the
// browser since it never returns the access token itself.
import { NextResponse } from "next/server";
import { getCloverConnection, isCloverConfigured } from "@/lib/clover";
import { isSupabaseAdminConfigured } from "@/lib/supabase-admin";

export async function GET() {
  const configured = isCloverConfigured() && isSupabaseAdminConfigured;
  if (!configured) {
    return NextResponse.json({ configured: false, connected: false });
  }

  const connection = await getCloverConnection();
  return NextResponse.json({
    configured: true,
    connected: Boolean(connection),
    merchantId: connection?.merchant_id ?? null,
    connectedAt: connection?.connected_at ?? null,
  });
}
