// AI-generated product photos — fills in a picture for items that sync in
// from Clover with no photo at all (Clover's catalog API has no photo
// field of its own). Runs OpenAI's image model from a short prompt built
// out of the product's name and category, then stores the result in the
// same "product-photos" Supabase bucket a staff-uploaded photo would go
// to, so the rest of the site (ProductCard, Today's Specials, etc.) can't
// tell the difference and needs no changes to use it.
//
// Inert (does nothing, returns null) until OPENAI_API_KEY is set as an
// environment variable — Clover sync and the webhook both keep working
// normally without it, items just stay on the color-swatch placeholder
// the way they always have. See README's "AI-generated product photos"
// section.
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
function buildPrompt(name: string, category: string): string {
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

// Generates one product photo and uploads it to the "product-photos"
// bucket, returning its public URL — or null on any failure (missing key,
// API error, storage error). Every caller treats null as "skip it," so a
// hiccup here (a flaky API call, a moderation refusal, Supabase storage
// being unreachable) never blocks a Clover sync or webhook event.
export async function generateProductPhoto(
  idHint: string,
  name: string,
  category: string
): Promise<string | null> {
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
        prompt: buildPrompt(name, category),
        size: "1024x1024",
        quality: "medium",
        n: 1,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("generateProductPhoto: OpenAI API error", res.status, detail);
      return null;
    }

    const data = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return null;

    const bytes = Buffer.from(b64, "base64");
    const path = `${idHint}/ai-generated-${Date.now()}.png`;
    const { error } = await client.storage.from("product-photos").upload(path, bytes, {
      contentType: "image/png",
      upsert: true,
    });
    if (error) {
      console.error("generateProductPhoto: storage upload failed", error.message);
      return null;
    }

    const { data: pub } = client.storage.from("product-photos").getPublicUrl(path);
    return pub.publicUrl;
  } catch (err) {
    console.error("generateProductPhoto:", err);
    return null;
  }
}
