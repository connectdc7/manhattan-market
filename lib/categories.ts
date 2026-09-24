// Category data access — the department list products are grouped into.
//
// Used to be a fixed 4-value list (Hot Food, Snacks, Drinks, Grocery) baked
// into lib/products.ts. Now it's data, kept in Supabase's `categories`
// table, because Clover sync needs to be able to introduce a department the
// dashboard doesn't already know about (see lib/clover.ts's
// resolveCloverCategory) instead of forcing every unrecognized Clover
// department into "Grocery" as a catch-all.
//
// A category Clover creates this way starts flagged `needsReview: true` and
// `showOnStorefront: false` — the item it came in on is correctly
// categorized right away, but the category itself stays off the public
// storefront and shows up in the dashboard's review queue (see
// components/dashboard/CategoryReviewPanel.tsx) until a staffer confirms,
// renames, merges, or hand-shows it.
import { supabase } from "./supabase";

export type Category = {
  name: string;
  sortOrder: number;
  showOnStorefront: boolean;
  needsReview: boolean;
};

// Used when Supabase isn't configured yet — mirrors lib/products.ts's own
// fallbackProducts pattern, and lib/products.ts's fallbackProducts still use
// these same four names.
export const fallbackCategories: Category[] = [
  { name: "Hot Food", sortOrder: 0, showOnStorefront: true, needsReview: false },
  { name: "Snacks", sortOrder: 1, showOnStorefront: true, needsReview: false },
  { name: "Drinks", sortOrder: 2, showOnStorefront: true, needsReview: false },
  { name: "Grocery", sortOrder: 3, showOnStorefront: true, needsReview: false },
];

const CATEGORY_COLUMNS = "name, sort_order, show_on_storefront, needs_review";

type CategoryRow = {
  name: string;
  sort_order: number;
  show_on_storefront: boolean;
  needs_review: boolean;
};

function fromRow(row: CategoryRow): Category {
  return {
    name: row.name,
    sortOrder: row.sort_order,
    showOnStorefront: row.show_on_storefront,
    needsReview: row.needs_review,
  };
}

// Every category, in display order — what the dashboard needs (filter
// pills, the Add/Edit Product dropdown, the review queue), since staff
// have to see hidden/unreviewed ones too, not just what customers see.
export async function getCategories(): Promise<Category[]> {
  if (!supabase) return fallbackCategories;
  const { data, error } = await supabase
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .order("sort_order")
    .order("name");
  if (error || !data) {
    if (error) console.error("getCategories: falling back to sample data —", error.message);
    return fallbackCategories;
  }
  return data.map(fromRow);
}

// Only what customers should actually see — excludes anything still
// awaiting review (hidden by default the moment Clover creates it) and
// anything staff have explicitly hidden by hand. What the storefront's
// category nav (Order page) reads.
export async function getStorefrontCategoryNames(): Promise<string[]> {
  const all = await getCategories();
  return all.filter((c) => c.showOnStorefront && !c.needsReview).map((c) => c.name);
}

// Hand-adds a brand-new category from the dashboard (e.g. the Add Product
// form's "+ Add new category" option) — not staff resolving a Clover
// review, so it goes straight in as confirmed and storefront-visible.
export async function createCategory(name: string): Promise<Category | null> {
  const trimmed = name.trim();
  if (!supabase || !trimmed) return null;
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: trimmed, show_on_storefront: true, needs_review: false })
    .select(CATEGORY_COLUMNS)
    .single();
  if (error || !data) {
    console.error("createCategory:", error?.message);
    return null;
  }
  return fromRow(data);
}

// Renames a category in place — every product tagged with the old name
// moves automatically (the products.category foreign key cascades the
// update), and any Clover alias already pointing at the old name keeps
// working too (category_aliases.category_name cascades the same way), so a
// later sync doesn't mistake the old name for a new department.
export async function renameCategory(oldName: string, newName: string): Promise<boolean> {
  const trimmed = newName.trim();
  if (!supabase || !trimmed || trimmed === oldName) return false;
  const { error } = await supabase.from("categories").update({ name: trimmed }).eq("name", oldName);
  if (error) {
    console.error("renameCategory:", error.message);
    return false;
  }
  return true;
}

export async function setCategoryVisibility(name: string, showOnStorefront: boolean): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("categories")
    .update({ show_on_storefront: showOnStorefront })
    .eq("name", name);
  if (error) {
    console.error("setCategoryVisibility:", error.message);
    return false;
  }
  return true;
}

// Clears a category's "needs review" flag — what the dashboard's review
// queue calls once staff have looked at a Clover-created category and
// decided its final storefront visibility (with or without renaming it
// first via renameCategory). Drops it out of the queue.
export async function confirmCategory(name: string, showOnStorefront: boolean): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("categories")
    .update({ needs_review: false, show_on_storefront: showOnStorefront })
    .eq("name", name);
  if (error) {
    console.error("confirmCategory:", error.message);
    return false;
  }
  return true;
}

// Folds one category into another instead of keeping it separate — every
// product tagged `fromName` moves to `intoName`, any Clover department name
// already aliased to `fromName` is repointed to `intoName` (so a future
// sync lands there directly instead of recreating `fromName`), and the
// now-empty `fromName` row is removed. Done as one database function (see
// supabase/seed.sql's merge_category) so it's atomic — a dropped
// connection partway through can't leave products pointed at a category
// that no longer exists.
export async function mergeCategoryInto(fromName: string, intoName: string): Promise<boolean> {
  if (!supabase || fromName === intoName) return false;
  const { error } = await supabase.rpc("merge_category", { p_from: fromName, p_into: intoName });
  if (error) {
    console.error("mergeCategoryInto:", error.message);
    return false;
  }
  return true;
}
