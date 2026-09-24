// Homepage hero background — data access. Staff pick one of the built-in
// ambient effects, their own uploaded photo(s)/video, or a plain
// background with none of the above, from the dashboard's Homepage tab
// (components/dashboard/HeroPanel.tsx). The homepage (app/page.tsx) reads
// the current choice and renders the matching effect component from
// components/hero/.
import { supabase } from "./supabase";

export type HeroEffect = "petals" | "snow" | "leaves" | "steam" | "bokeh" | "custom" | "plain";

export const HERO_EFFECTS: { value: HeroEffect; label: string; description: string }[] = [
  { value: "petals", label: "Pink Petals", description: "Cherry blossoms drifting down — the current look." },
  { value: "snow", label: "Falling Snow", description: "Gentle white snowfall — a seasonal swap for winter." },
  { value: "leaves", label: "Golden Autumn Leaves", description: "Warm-toned leaves tumbling down — a fall look." },
  { value: "steam", label: "Warm Coffee Steam", description: "Soft rising steam with an amber glow — works year-round." },
  { value: "bokeh", label: "City Bokeh Lights", description: "Slow, twinkling soft-focus lights — an elegant, year-round look." },
  { value: "custom", label: "Your Photo / Video", description: "Use a photo or video you upload below instead." },
  { value: "plain", label: "Plain", description: "No animation, no photo — just the clean background." },
];

// Used when Supabase isn't configured yet, or the row is missing for any
// reason — defaults to "petals" so the homepage looks exactly like it
// always has until staff actively change it.
const DEFAULT_EFFECT: HeroEffect = "petals";

export async function getHeroEffect(): Promise<HeroEffect> {
  if (!supabase) return DEFAULT_EFFECT;
  const { data, error } = await supabase.from("hero_settings").select("effect").eq("id", "singleton").maybeSingle();
  if (error || !data) return DEFAULT_EFFECT;
  return data.effect as HeroEffect;
}

export async function setHeroEffect(effect: HeroEffect): Promise<boolean> {
  if (!supabase) return false;
  // A plain update, not an upsert — the singleton row always exists
  // (seed.sql inserts it), and an upsert is treated by Postgres as an
  // INSERT ... ON CONFLICT, which checks the table's INSERT policy even
  // when the row already exists and the statement ends up updating it.
  // hero_settings only grants anon SELECT + UPDATE (there's never a
  // reason to insert a second row), so an upsert here fails RLS.
  const { error } = await supabase
    .from("hero_settings")
    .update({ effect, updated_at: new Date().toISOString() })
    .eq("id", "singleton");
  if (error) {
    console.error("setHeroEffect:", error.message);
    return false;
  }
  return true;
}

export type HeroMediaKind = "photo" | "video";

export type HeroMedia = {
  id: string;
  kind: HeroMediaKind;
  url: string;
  storagePath: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
};

const HERO_MEDIA_COLUMNS = "id, kind, url, storage_path, is_active, sort_order, created_at";

type HeroMediaRow = {
  id: string;
  kind: HeroMediaKind;
  url: string;
  storage_path: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

function fromRow(row: HeroMediaRow): HeroMedia {
  return {
    id: row.id,
    kind: row.kind,
    url: row.url,
    storagePath: row.storage_path,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

// The whole uploaded library — what the dashboard's Homepage tab shows so
// staff can pick which one is active, or delete old ones.
export async function getHeroMedia(): Promise<HeroMedia[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("hero_media")
    .select(HERO_MEDIA_COLUMNS)
    .order("sort_order")
    .order("created_at");
  if (error || !data) {
    if (error) console.error("getHeroMedia:", error.message);
    return [];
  }
  return data.map(fromRow);
}

// Just the one item actually shown on the homepage when effect = 'custom'.
// Returns null if nothing's been uploaded yet, or nothing's been marked
// active — the homepage falls back to a plain background in that case
// rather than showing nothing meaningful.
export async function getActiveHeroMedia(): Promise<HeroMedia | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("hero_media")
    .select(HERO_MEDIA_COLUMNS)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  return fromRow(data);
}

// Uploads a staff-chosen photo or video to the "hero-media" storage bucket
// (see supabase/seed.sql) and adds it to the library. Doesn't mark it
// active — that's a separate, explicit step (setActiveHeroMedia) so
// uploading doesn't silently change what's live on the site.
export async function uploadHeroMedia(file: File, kind: HeroMediaKind): Promise<HeroMedia | null> {
  const client = supabase;
  if (!client) return null;

  const ext = file.name.split(".").pop()?.toLowerCase() || (kind === "video" ? "mp4" : "jpg");
  const path = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: uploadError } = await client.storage.from("hero-media").upload(path, file, {
    upsert: true,
    cacheControl: "3600",
  });
  if (uploadError) {
    console.error("uploadHeroMedia:", uploadError.message);
    return null;
  }

  const { data: publicUrl } = client.storage.from("hero-media").getPublicUrl(path);

  const { data, error } = await client
    .from("hero_media")
    .insert({ kind, url: publicUrl.publicUrl, storage_path: path })
    .select(HERO_MEDIA_COLUMNS)
    .single();
  if (error || !data) {
    console.error("uploadHeroMedia (row insert):", error?.message);
    return null;
  }
  return fromRow(data);
}

// Marks one library item as the active one (see set_active_hero_media in
// supabase/seed.sql for why this is one atomic database call rather than
// an unset-then-set pair of writes).
export async function setActiveHeroMedia(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc("set_active_hero_media", { p_id: id });
  if (error) {
    console.error("setActiveHeroMedia:", error.message);
    return false;
  }
  return true;
}

// Removes a library item — both its database row and the underlying
// storage file, so deleting an old hero video actually frees the space
// instead of leaving it orphaned in the bucket.
export async function deleteHeroMedia(media: Pick<HeroMedia, "id" | "storagePath">): Promise<boolean> {
  const client = supabase;
  if (!client) return false;
  const { error: rowError } = await client.from("hero_media").delete().eq("id", media.id);
  if (rowError) {
    console.error("deleteHeroMedia (row):", rowError.message);
    return false;
  }
  const { error: storageError } = await client.storage.from("hero-media").remove([media.storagePath]);
  if (storageError) {
    // The row's already gone (what actually matters — the homepage and
    // dashboard both read from the row), so this is a cleanup nice-to-have,
    // not something worth failing the whole delete over.
    console.error("deleteHeroMedia (storage file):", storageError.message);
  }
  return true;
}
