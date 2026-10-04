// Starts the Clover OAuth handshake. Called by the dashboard's "Connect
// Clover" button (POST, with the staffer's sign-in token) and answers with
// Clover's login/consent URL, which the button then sends the browser to.
// Staff-only, so a stranger can't link their own Clover account to the
// store. (Used to be a plain GET link before the staff login existed.) Clover redirects back to /api/clover/callback with
// an authorization code once the merchant approves.
//
// Inert (returns 501) until CLOVER_APP_ID is set as an environment
// variable — see README's Clover section.
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { cookies } from "next/headers";
import { cloverUrls, isCloverConfigured } from "@/lib/clover";

export async function POST(request: Request) {
  const staffCheck = await requireStaff(request);
  if (!staffCheck.ok) return staffCheck.response;

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

  return NextResponse.json({ url: authorizeUrl.toString() });
}
