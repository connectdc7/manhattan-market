// Starts the Clover OAuth handshake: redirects the browser to Clover's own
// login/consent screen. Clover redirects back to /api/clover/callback with
// an authorization code once the merchant approves.
//
// Inert (returns 501) until CLOVER_APP_ID is set as an environment
// variable — see README's Clover section.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cloverUrls, isCloverConfigured } from "@/lib/clover";

export async function GET(request: Request) {
  if (!isCloverConfigured()) {
    return NextResponse.json(
      { error: "Clover isn't configured yet. Set CLOVER_APP_ID and CLOVER_APP_SECRET first." },
      { status: 501 }
    );
  }

  const appId = process.env.CLOVER_APP_ID!;
  const redirectUri = new URL("/api/clover/callback", request.url).toString();

  // A random state value, checked on the way back in /callback, so a
  // third party can't trick a signed-in staff browser into linking an
  // attacker-controlled Clover account.
  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("clover_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const authorizeUrl = new URL(cloverUrls().authorize);
  authorizeUrl.searchParams.set("client_id", appId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("state", state);

  return NextResponse.redirect(authorizeUrl.toString());
}
