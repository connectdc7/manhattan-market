// The public Gallery page's six scene tiles (app/gallery/page.tsx). Labels
// and fallback colors are fixed in code — only whether each one has a
// photo yet lives in the database (table: gallery_images, seeded by
// supabase/seed.sql with every image_url empty).
import { supabase } from "./supabase";

export type GalleryTile = {
  key: string;
  label: string;
  color: string; // placeholder tile color, used until a photo exists
  image_url?: string;
};

// Exported (not just used internally) so the "Generate gallery photos" API
// route can build a photo for each tile without duplicating this list.
export const GALLERY_TILE_DEFS: Omit<GalleryTile, "image_url">[] = [
  { key: "storefront", label: "Storefront", color: "#21594a" },
  { key: "hot-food-counter", label: "Hot food counter", color: "#c98b3a" },
  { key: "snack-aisle", label: "Snack aisle", color: "#e0a938" },
  { key: "coffee-station", label: "Coffee station", color: "#6b4226" },
  { key: "drink-cooler", label: "Drink cooler", color: "#3e6b4a" },
  { key: "register", label: "Register", color: "#163d33" },
];

export async function getGalleryTiles(): Promise<GalleryTile[]> {
  if (!supabase) return GALLERY_TILE_DEFS.map((t) => ({ ...t }));

  const { data, error } = await supabase.from("gallery_images").select("key, image_url");
  if (error || !data) return GALLERY_TILE_DEFS.map((t) => ({ ...t }));

  const imageByKey = new Map(data.map((row) => [row.key as string, (row.image_url as string) || undefined]));
  return GALLERY_TILE_DEFS.map((t) => ({ ...t, image_url: imageByKey.get(t.key) }));
}
