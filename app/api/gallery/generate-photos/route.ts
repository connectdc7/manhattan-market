// Generates an AI photo for every Gallery page tile that doesn't have one
// yet (see lib/gallery.ts for the six tiles and lib/image-gen.ts for the
// generation itself). Unlike product photos, these are deliberately
// generic scene photos, not real pictures of this store — see README's
// "AI-generated product photos" section. Wired to the "Generate gallery
// photos" button in the dashboard's Inventory panel.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { GALLERY_TILE_DEFS } from "@/lib/gallery";
import { generatePhotosForGalleryTiles, isImageGenConfigured } from "@/lib/image-gen";

// See app/api/clover/sync/route.ts for why this is pinned explicitly.
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

  const { data, error } = await client.from("gallery_images").select("key, image_url");
  if (error) {
    console.error("[gallery] generate-photos: fetch failed", error);
    return NextResponse.json({ error: "Couldn't read the gallery tile list." }, { status: 500 });
  }

  const imageByKey = new Map((data ?? []).map((row) => [row.key as string, row.image_url as string]));
  const missing = GALLERY_TILE_DEFS.filter((t) => !imageByKey.get(t.key));

  const stats = await generatePhotosForGalleryTiles(missing.map((t) => ({ key: t.key, label: t.label })));

  return NextResponse.json({ eligible: missing.length, ...stats });
}
