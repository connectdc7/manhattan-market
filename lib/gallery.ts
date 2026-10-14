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

// ---------------------------------------------------------------------------
// Real gallery photos (table gallery_photos, supabase/gallery-photos.sql).
// Staff upload any number from the dashboard's Gallery tab; once at least
// one exists, the public Gallery page shows these instead of the six
// placeholder tiles above.
// ---------------------------------------------------------------------------
export type GalleryPhoto = {
  id: string;
  url: string;
  storagePath: string;
  caption: string;
  sortOrder: number;
};

const PHOTO_COLUMNS = "id, url, storage_path, caption, sort_order";
const BUCKET = "hero-media";

type PhotoRow = { id: string; url: string; storage_path: string; caption: string; sort_order: number };
const fromPhotoRow = (r: PhotoRow): GalleryPhoto => ({
  id: r.id,
  url: r.url,
  storagePath: r.storage_path,
  caption: r.caption ?? "",
  sortOrder: r.sort_order ?? 0,
});

export async function getGalleryPhotos(): Promise<GalleryPhoto[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("gallery_photos")
    .select(PHOTO_COLUMNS)
    .order("sort_order")
    .order("created_at");
  if (error || !data) return []; // table not created yet → page uses the placeholder tiles
  return (data as PhotoRow[]).map(fromPhotoRow);
}

// Phone photos are often 3–8MB and 4000px wide — far bigger than a web page
// needs. Shrink to at most 2000px (JPEG, ~85%) before uploading so the
// Gallery loads fast on phones. Falls back to the original file if the
// browser can't decode it.
async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000 && file.type === "image/jpeg") return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

export async function uploadGalleryPhoto(file: File, sortOrder: number): Promise<GalleryPhoto | null> {
  const client = supabase;
  if (!client) return null;
  const body = await shrinkImage(file);
  const ext = body.type === "image/jpeg" ? "jpg" : file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `gallery/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: uploadError } = await client.storage
    .from(BUCKET)
    .upload(path, body, { cacheControl: "31536000", contentType: body.type || file.type });
  if (uploadError) {
    console.error("uploadGalleryPhoto:", uploadError.message);
    return null;
  }
  const { data: pub } = client.storage.from(BUCKET).getPublicUrl(path);
  const { data, error } = await client
    .from("gallery_photos")
    .insert({ url: pub.publicUrl, storage_path: path, sort_order: sortOrder })
    .select(PHOTO_COLUMNS)
    .single();
  if (error || !data) {
    console.error("uploadGalleryPhoto (row):", error?.message);
    await client.storage.from(BUCKET).remove([path]);
    return null;
  }
  return fromPhotoRow(data as PhotoRow);
}

export async function updateGalleryPhoto(id: string, fields: { caption?: string; sort_order?: number }): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("gallery_photos").update(fields).eq("id", id);
  if (error) console.error("updateGalleryPhoto:", error.message);
  return !error;
}

export async function deleteGalleryPhoto(photo: Pick<GalleryPhoto, "id" | "storagePath">): Promise<boolean> {
  const client = supabase;
  if (!client) return false;
  const { error } = await client.from("gallery_photos").delete().eq("id", photo.id);
  if (error) {
    console.error("deleteGalleryPhoto:", error.message);
    return false;
  }
  await client.storage.from(BUCKET).remove([photo.storagePath]);
  return true;
}
