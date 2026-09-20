// AI-generated photos, used in two places on this site:
//
// - Product photos: fills in a picture for any product that has none,
//   whether it synced in from Clover (which has no photo field of its
//   own) or was added by hand. Used automatically as items sync in from
//   Clover (lib/clover.ts + app/api/clover/sync and .../webhook), and on
//   demand for every currently-missing product photo at once
//   (app/api/products/generate-missing-photos, wired to the "Generate
//   missing photos" button in the dashboard's Inventory panel).
// - Gallery scene photos: fills in a generic placeholder scene (a hot food
//   counter, a snack aisle, ...) for the public Gallery page's tiles
//   (app/gallery/page.tsx), on demand from the dashboard's "Generate
//   gallery photos" button (app/api/gallery/generate-photos). These are
//   deliberately generic, not real photos of the actual store — see the
//   README's "AI-generated product photos" section for why, and swap in
//   real photos before launch.
//
// Both save into the same "product-photos" Supabase storage bucket a
// staff-uploaded product photo would go to (gallery images under a
// gallery/ prefix), so the rest of the site can't tell the difference and
// needs no changes to use either.
//
// Inert (does nothing, returns null/"skipped") until OPENAI_API_KEY is set
// as an environment variable — every caller keeps working normally
// without it, items just stay on their color-tile placeholder the way
// they always have.
import { supabaseAdmin } from "./supabase-admin";

export function isImageGenConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

// Overridable via env var without a code change, in case this id is
// retired or a newer one is preferred later.
const DEFAULT_MODEL = "gpt-image-1";

// Deliberately steers away from reproducing a specific real brand's
// packaging/logo — Clover only gives us a name like "Lay's Classic Chips,"
// and an image model asked to draw that exact label would be guessing at
// (and likely misdrawing) trademarked artwork. A clean, generic version of
// the product reads better on the shelf than an inaccurate fake label.
function buildProductPrompt(name: string, category: string): string {
  return (
    `A clean, appetizing product photo of "${name}", a ${category.toLowerCase()} item ` +
    `sold at a small neighborhood convenience store. Shot from a slight ` +
    `front angle, centered, filling most of the frame, on a plain neutral ` +
    `background with soft studio lighting — the style of a simple e-commerce ` +
    `product photo. Photorealistic. Do not include any specific real brand ` +
    `logo, trademarked packaging design, or readable text/label — show a ` +
    `generic, unbranded version of the product itself. No hands, no people, ` +
    `no props, no watermark.`
  );
}

// A Gallery tile's photo is a scene, not a product — deliberately generic
// (no real signage/logos), since it does not depict this store's actual
// storefront or interior. It's a placeholder upgrade over a plain color
// tile, not a substitute for real photos before launch.
function buildGalleryPrompt(label: string): string {
  return (
    `A warm, inviting photo of "${label}" inside a small independent urban ` +
    `neighborhood convenience store. Natural, realistic interior ` +
    `photography, well-lit, tidy and appealing — the kind of photo a small ` +
    `business would use on its own website gallery. Photorealistic. No ` +
    `readable signage, brand logos, or text anywhere in the frame — a ` +
    `generic, appealing example of the scene, not a depiction of any ` +
    `specific real business. No people.`
  );
}

// Calls OpenAI's image API with the given prompt and uploads the result to
// the "product-photos" bucket at `<pathPrefix>/ai-generated-<ts>.png`,
// returning its public URL — or null on any failure (missing key, API
// error, storage error). Every caller treats null as "skip it," so a
// hiccup here (a flaky API call, a moderation refusal, Supabase storage
// being unreachable) never blocks whatever triggered it.
async function generateImage(prompt: string, pathPrefix: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const client = supabaseAdmin;
  if (!apiKey || !client) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL,
        prompt,
        size: "1024x1024",
        quality: "medium",
        n: 1,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("generateImage: OpenAI API error", res.status, detail);
      return null;
    }

    const data = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return null;

    const bytes = Buffer.from(b64, "base64");
    const path = `${pathPrefix}/ai-generated-${Date.now()}.png`;
    const { error } = await client.storage.from("product-photos").upload(path, bytes, {
      contentType: "image/png",
      upsert: true,
    });
    if (error) {
      console.error("generateImage: storage upload failed", error.message);
      return null;
    }

    const { data: pub } = client.storage.from("product-photos").getPublicUrl(path);
    return pub.publicUrl;
  } catch (err) {
    console.error("generateImage:", err);
    return null;
  }
}

export function generateProductPhoto(idHint: string, name: string, category: string): Promise<string | null> {
  return generateImage(buildProductPrompt(name, category), idHint);
}

export function generateGalleryPhoto(key: string, label: string): Promise<string | null> {
  return generateImage(buildGalleryPrompt(label), `gallery/${key}`);
}

export type PhotoOutcome = "generated" | "failed" | "skipped";

// Generates a photo for one product and saves it straight to its row —
// never throws. A missing/bad OPENAI_API_KEY, a flaky image API call, or a
// storage error just leaves the item on its color-swatch placeholder, same
// as before this existed; a staff member can still add a real photo from
// the dashboard at any time, which always wins over a generated one and
// is never overwritten by this.
export async function generateAndSavePhoto(id: string, name: string, category: string): Promise<PhotoOutcome> {
  if (!isImageGenConfigured()) return "skipped";
  const url = await generateProductPhoto(id, name, category);
  if (!url) return "failed";

  const client = supabaseAdmin;
  if (!client) return "failed";
  const { error } = await client.from("products").update({ image_url: url }).eq("id", id);
  if (error) {
    console.error("generateAndSavePhoto: saving failed", { id, error });
    return "failed";
  }
  return "generated";
}

// Same idea as generateAndSavePhoto, but for one Gallery tile's row in
// gallery_images instead of a product.
export async function generateAndSaveGalleryPhoto(key: string, label: string): Promise<PhotoOutcome> {
  if (!isImageGenConfigured()) return "skipped";
  const url = await generateGalleryPhoto(key, label);
  if (!url) return "failed";

  const client = supabaseAdmin;
  if (!client) return "failed";
  const { error } = await client.from("gallery_images").update({ image_url: url }).eq("key", key);
  if (error) {
    console.error("generateAndSaveGalleryPhoto: saving failed", { key, error });
    return "failed";
  }
  return "generated";
}

// How many photos to generate at once. Each OpenAI image call takes
// several seconds on its own — running a whole batch one at a time meant
// a sync (or a "generate missing photos" sweep) with, say, 30 items could
// take 5+ minutes and risk running into Vercel's function time limit
// before finishing the last few, which is exactly why some products would
// get a generated photo and others wouldn't. A small concurrency window
// keeps this well inside that budget without hammering OpenAI's rate
// limits.
const PHOTO_CONCURRENCY = 4;

// Runs `worker` over a batch of items, a few at a time, tallying outcomes
// so the caller can report real numbers instead of a silent "some items
// didn't get a photo." Shared by the product and gallery batch helpers
// below.
async function runBatch<T>(
  items: T[],
  worker: (item: T) => Promise<PhotoOutcome>
): Promise<{ generated: number; failed: number; skipped: number }> {
  const stats = { generated: 0, failed: 0, skipped: 0 };
  if (items.length === 0) return stats;

  let cursor = 0;
  async function run() {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      const outcome = await worker(items[i]);
      stats[outcome]++;
    }
  }

  await Promise.all(Array.from({ length: Math.min(PHOTO_CONCURRENCY, items.length) }, run));
  return stats;
}

export function generatePhotosForItems(
  items: { id: string; name: string; category: string }[]
): Promise<{ generated: number; failed: number; skipped: number }> {
  return runBatch(items, (item) => generateAndSavePhoto(item.id, item.name, item.category));
}

export function generatePhotosForGalleryTiles(
  tiles: { key: string; label: string }[]
): Promise<{ generated: number; failed: number; skipped: number }> {
  return runBatch(tiles, (tile) => generateAndSaveGalleryPhoto(tile.key, tile.label));
}
