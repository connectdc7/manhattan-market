import type { HeroMedia } from "@/lib/hero";

// The "Your Photo / Video" hero effect — whatever the client uploaded
// and marked active from the dashboard's Homepage tab, filling the
// hero behind the text. A dark gradient overlay (bottom-heavy, since
// that's where the headline/subtext/buttons sit) keeps the white/green
// hero text readable over an arbitrary photo or video instead of
// assuming the upload happens to be dark enough on its own.
export default function CustomHeroMedia({ media }: { media: HeroMedia }) {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {media.kind === "video" ? (
        <video
          className="h-full w-full object-cover"
          src={media.url}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt="" className="h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
    </div>
  );
}
