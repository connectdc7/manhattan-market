// Where Clover redirects back to after the merchant approves the connection
// request started in /api/clover/connect. Exchanges the one-time
// authorization code for an access token, saves it, and sends the staffer
// back to the dashboard.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cloverUrls, isCloverConfigured, saveCloverConnection } from "@/lib/clover";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dashboardUrl = new URL("/dashboard", request.url);

  if (!isCloverConfigured()) {
    dashboardUrl.searchParams.set("clover_error", "not-configured");
    return NextResponse.redirect(dashboardUrl);
  }

  const code = searchParams.get("code");
  const merchantId = searchParams.get("merchant_id");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("clover_oauth_state")?.value;
  cookieStore.delete("clover_oauth_state");

  if (!code || !merchantId) {
    dashboardUrl.searchParams.set("clover_error", "missing-code");
    return NextResponse.redirect(dashboardUrl);
  }
  if (!state || !expectedState || state !== expectedState) {
    dashboardUrl.searchParams.set("clover_error", "state-mismatch");
    return NextResponse.redirect(dashboardUrl);
  }

  const tokenRes = await fetch(cloverUrls().token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.CLOVER_APP_ID,
      client_secret: process.env.CLOVER_APP_SECRET,
      code,
    }),
  });

  if (!tokenRes.ok) {
    dashboardUrl.searchParams.set("clover_error", "token-exchange-failed");
    return NextResponse.redirect(dashboardUrl);
  }

  const tokenBody = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    access_token_expiration?: number;
    refresh_token_expiration?: number;
  };

  if (!tokenBody.access_token) {
    dashboardUrl.searchParams.set("clover_error", "token-exchange-failed");
    return NextResponse.redirect(dashboardUrl);
  }

  const saved = await saveCloverConnection({
    merchant_id: merchantId,
    access_token: tokenBody.access_token,
    refresh_token: tokenBody.refresh_token,
    access_token_expiration: tokenBody.access_token_expiration,
    refresh_token_expiration: tokenBody.refresh_token_expiration,
  });

  dashboardUrl.searchParams.set(saved ? "clover" : "clover_error", saved ? "connected" : "save-failed");
  return NextResponse.redirect(dashboardUrl);
}
