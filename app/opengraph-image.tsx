import { ImageResponse } from "next/og";

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
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#ffffff" }}>
        <div style={{ display: "flex", height: 18, width: "100%", backgroundColor: STRIPE }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 84px" }}>
          <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, textTransform: "uppercase", color: PINK_DEEP, fontWeight: 700 }}>
            Manhattan Market
          </div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color: INK, marginTop: 20, lineHeight: 1.05 }}>
            Order ahead.
          </div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, fontStyle: "italic", color: GREEN, lineHeight: 1.05 }}>
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
