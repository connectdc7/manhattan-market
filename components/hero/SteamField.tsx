import { risingSteam } from "@/lib/hero-effects";

// "Warm Coffee Steam" hero effect — soft blurred wisps rising from
// near the bottom of the hero. Single element per wisp (see the
// comment in lib/hero-effects.ts's risingSteam) since rise + drift +
// scale all live in one keyframe set, unlike petals/leaves/snow which
// need two elements to run two independent `transform` animations.
export default function SteamField() {
  return (
    <div className="steam-field" aria-hidden="true">
      {risingSteam(14).map((s, i) => (
        <span key={`steam-${i}`} className="steam-wisp" style={s.style} />
      ))}
    </div>
  );
}
