import { ImageResponse } from "next/og";

// The image that shows up when a link to the site is shared in Messages,
// Slack, Facebook, etc. Generated on the fly from brand colors/copy rather
// than a real photo — swap in an actual storefront photo here once one
// exists (see app/gallery/page.tsx, which is still placeholder tiles too).
export const alt = "Manhattan Market — order ahead, skip the line";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STRIPE = "#f6b9c6";
const INK = "#1d231f";
const INK_SOFT = "#52584f";
const GREEN = "#21594a";
const PINK_DEEP = "#b8456a";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ffffff",
        }}
      >
        <div style={{ display: "flex", height: 18, width: "100%", backgroundColor: STRIPE }} />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 84px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
              <div style={{ display: "flex", width: 7, height: 20, background: GREEN }} />
              <div style={{ display: "flex", width: 7, height: 34, background: GREEN }} />
              <div style={{ display: "flex", width: 7, height: 46, background: GREEN }} />
              <div style={{ display: "flex", width: 7, height: 28, background: GREEN }} />
              <div style={{ display: "flex", width: 7, height: 38, background: GREEN }} />
              <div style={{ display: "flex", width: 7, height: 18, background: GREEN }} />
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 28,
                letterSpacing: 6,
                textTransform: "uppercase",
                color: PINK_DEEP,
                fontWeight: 700,
              }}
            >
              Manhattan Market
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 700,
              color: INK,
              marginTop: 20,
              lineHeight: 1.05,
            }}
          >
            Order ahead.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 700,
              fontStyle: "italic",
              color: GREEN,
              lineHeight: 1.05,
            }}
          >
            Skip the line.
          </div>
          <div style={{ display: "flex", fontSize: 30, color: INK_SOFT, marginTop: 30 }}>
            3706 Connecticut Ave NW · Washington, DC
          </div>
        </div>
        <div style={{ display: "flex", height: 18, width: "100%", backgroundColor: STRIPE }} />
      </div>
    ),
    { ...size }
  );
}
