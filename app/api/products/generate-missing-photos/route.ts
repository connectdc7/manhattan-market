// On-demand sweep: generates an AI photo for every product that currently
// has none, regardless of where the product came from — unlike the
// automatic per-item generation wired into Clover sync/webhook (see
// lib/clover.ts), which only ever sees items as they sync in, this looks
// at the whole products table as it stands right now. That covers the
// cases automatic sync can't: products added by hand with no photo,
// products that synced in before OPENAI_API_KEY was set, and old sample/
// demo products that were never linked to Clover at all and so are
// invisible to Clover sync entirely.
//
// Wired to the "Generate missing photos" button in the dashboard's
// Inventory panel. See README's "AI-generated product photos" section.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generatePhotosForItems, isImageGenConfigured } from "@/lib/image-gen";

// See app/api/clover/sync/route.ts for why this is pinned explicitly —
// same reasoning applies here, and a full-catalog sweep is exactly the
// case with the most images to generate in one request.
export const maxDuration = 300;

export async function POST() {
  if (!isImageGenConfigured()) {
    return NextResponse.json(
      { error: "AI photo generation isn't configured yet. Set OPENAI_API_KEY first." },
      { status: 501 }
    );
  }

  const client = supabaseAdmin;
  if (!client) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 501 });
  }

  const { data, error } = await client.from("products").select("id, name, category, image_url");
  if (error) {
    console.error("[products] generate-missing-photos: fetch failed", error);
    return NextResponse.json({ error: "Couldn't read the product list." }, { status: 500 });
  }

  const missing = (data ?? []).filter((p) => !p.image_url);
  const stats = await generatePhotosForItems(
    missing.map((p) => ({ id: p.id as string, name: p.name as string, category: p.category as string }))
  );

  return NextResponse.json({ eligible: missing.length, ...stats });
}
