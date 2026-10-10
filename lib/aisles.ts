// Storefront "aisles" — a handful of friendly groups the Order page shows
// as its main chips, instead of every Clover department (there are dozens,
// which made the page look busy). Each category belongs to one aisle:
// whatever staff picked on the dashboard (categories.group_name), or else
// a best guess from its name using the keywords below.
//
// Shared by server and client code (no imports).

export const AISLES = [
  "Hot Food & Coffee",
  "Snacks & Candy",
  "Drinks",
  "Bakery & Breakfast",
  "Dairy, Fresh & Frozen",
  "Pantry & Grocery",
  "Household & Personal Care",
  "Other",
] as const;

export type Aisle = (typeof AISLES)[number];

// Checked in order — the first aisle with a matching keyword wins, so more
// specific aisles come first (e.g. "Coffee & Fresh Bakery" → Hot Food &
// Coffee before Bakery, "Milk Products" → Dairy before Drinks).
const KEYWORDS: [Aisle, string[]][] = [
  ["Hot Food & Coffee", ["hot food", "hot", "deli", "ready to", "ready-to", "prepared", "sandwich", "grill", "pizza", "coffee"]],
  ["Dairy, Fresh & Frozen", ["dairy", "milk", "butter", "cheese", "cream", "egg", "yogurt", "frozen", "ice", "produce", "fruit", "vegetable", "veggie", "fresh", "meat"]],
  ["Snacks & Candy", ["snack", "chip", "candy", "confection", "chocolate", "cookie", "cracker", "nut", "gum", "mint", "jerky", "popcorn", "sweet"]],
  ["Drinks", ["drink", "soda", "water", "juice", "tea", "beverage", "energy", "alc", "sport", "kombucha", "seltzer", "pop"]],
  ["Bakery & Breakfast", ["bakery", "bread", "bagel", "pastr", "muffin", "donut", "cereal", "breakfast", "oat"]],
  ["Household & Personal Care", ["household", "personal", "care", "health", "beauty", "medicine", "pharm", "clean", "paper", "bag", "pet", "baby", "hygiene", "battery", "batteries", "laundry", "soap"]],
  ["Pantry & Grocery", ["grocery", "pantry", "baking", "spice", "soup", "noodle", "pasta", "rice", "can", "sauce", "condiment", "oil", "flour", "sugar", "bean", "international"]],
];

export function guessAisle(categoryName: string): Aisle {
  // Match at the start of a word, so "Spice" doesn't count as "ice".
  const words = categoryName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const [aisle, keys] of KEYWORDS) {
    if (keys.some((k) => (k.includes(" ") || k.includes("-") ? categoryName.toLowerCase().includes(k) : words.some((w) => w.startsWith(k))))) {
      return aisle;
    }
  }
  return "Other";
}

export function aisleFor(categoryName: string, chosen: string | null | undefined): Aisle {
  if (chosen && (AISLES as readonly string[]).includes(chosen)) return chosen as Aisle;
  return guessAisle(categoryName);
}
