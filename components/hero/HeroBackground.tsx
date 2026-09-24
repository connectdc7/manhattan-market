import type { HeroEffect, HeroMedia } from "@/lib/hero";
import PetalField from "@/components/hero/PetalField";
import SnowField from "@/components/hero/SnowField";
import LeafField from "@/components/hero/LeafField";
import SteamField from "@/components/hero/SteamField";
import BokehField from "@/components/hero/BokehField";
import CustomHeroMedia from "@/components/hero/CustomHeroMedia";

// Whether the hero needs light/white text over it — true only when a
// real photo or video is actually filling the background. Every
// built-in effect (including "plain") sits on the site's normal pale
// paper background, so the existing dark ink/pink/green text stays as
// is; only a client's own photo/video is unpredictable enough in tone
// to need the light-text-plus-overlay treatment.
export function heroUsesLightText(effect: HeroEffect, activeMedia: HeroMedia | null): boolean {
  return effect === "custom" && activeMedia !== null;
}

// Picks the right ambient effect (or the client's own upload) for the
// homepage hero, based on what's set in the dashboard's Homepage tab
// (components/dashboard/HeroPanel.tsx, via lib/hero.ts). Falls back to
// nothing (plain background) for "plain", and for "custom" when
// nothing's been uploaded/activated yet.
export default function HeroBackground({
  effect,
  activeMedia,
}: {
  effect: HeroEffect;
  activeMedia: HeroMedia | null;
}) {
  switch (effect) {
    case "petals":
      return <PetalField />;
    case "snow":
      return <SnowField />;
    case "leaves":
      return <LeafField />;
    case "steam":
      return <SteamField />;
    case "bokeh":
      return <BokehField />;
    case "custom":
      return activeMedia ? <CustomHeroMedia media={activeMedia} /> : null;
    case "plain":
      return null;
    default:
      return null;
  }
}
