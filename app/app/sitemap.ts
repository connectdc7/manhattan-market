import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// The pages worth telling search engines about. Checkout (transactional,
// tied to a live cart) and the staff-only /dashboard are deliberately left
// out — see app/robots.ts, which also disallows crawling them.
const ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "", changeFrequency: "daily", priority: 1 },
  { path: "/order", changeFrequency: "daily", priority: 0.9 },
  { path: "/rewards", changeFrequency: "monthly", priority: 0.6 },
  { path: "/gallery", changeFrequency: "monthly", priority: 0.5 },
  { path: "/location", changeFrequency: "monthly", priority: 0.7 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
