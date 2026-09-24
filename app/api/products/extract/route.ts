// Reads a photo of a single retail product and asks Claude's vision model
// to guess its name and category, so staff can snap a photo instead of
// typing everything by hand for every new item. This is a suggestion
// only — nothing here writes to the database; the dashboard drops the
// guess into the editable Name/Category fields and staff confirm or
// correct it before saving, same as every other field in that form.
//
// Inert (returns 501) until ANTHROPIC_API_KEY is set as an environment
// variable. See README's "AI photo auto-fill" section.
import { NextResponse } from "next/server";
import { getCategories } from "@/lib/categories";

export const runtime = "nodejs";

// Overridable via the ANTHROPIC_MODEL env var without a code change, in
// case this id is retired down the line.
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

type ExtractResult = {
  name: string;
  category: string;
  confident: boolean;
};

function isExtractResult(value: unknown): value is ExtractResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === "string" && typeof v.category === "string" && typeof v.confident === "boolean";
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI photo reading isn't configured yet. Set ANTHROPIC_API_KEY first." },
      { status: 501 }
    );
  }

  let body: { imageBase64?: string; mediaType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { imageBase64, mediaType } = body;
  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: "Missing photo data." }, { status: 400 });
  }

  // Fetched live rather than a fixed list — categories are data now (see
  // lib/categories.ts), and staff may have renamed or added to them since
  // this route last ran.
  const categoryNames = (await getCategories()).map((c) => c.name);

  const prompt = `You're looking at a photo of a single retail product from a small convenience store (categories used here: ${categoryNames.join(", ")}).

Respond with ONLY a JSON object, no other text, in exactly this shape:
{"name": string, "category": string, "confident": boolean}

Rules:
- "name" is a short, clean product name the way it would read on a shelf label or receipt — brand plus product, include size/variant if visible (example: "Lay's Classic Chips 2.5oz").
- "category" must be exactly one of: ${categoryNames.join(", ")}. Pick your best guess based on what the product actually is.
- Set "confident" to false if the photo is blurry, doesn't clearly show a single product, or you can't read enough to be sure — still give your best-guess name, just flag it.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("products/extract: Claude API error", res.status, detail);
      return NextResponse.json(
        { error: "Couldn't read that photo — try again or fill it in by hand." },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "";

    // Claude was asked to return only JSON, but parse defensively in case
    // it wraps the object in stray text anyway.
    const match = text.match(/\{[\s\S]*\}/);
    const parsed: unknown = match ? JSON.parse(match[0]) : null;

    if (!isExtractResult(parsed) || !categoryNames.includes(parsed.category)) {
      return NextResponse.json(
        { error: "Couldn't make sense of that photo — fill it in by hand." },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed satisfies ExtractResult);
  } catch (err) {
    console.error("products/extract:", err);
    return NextResponse.json(
      { error: "Couldn't read that photo — try again or fill it in by hand." },
      { status: 502 }
    );
  }
}
