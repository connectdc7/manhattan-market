import { ImageResponse } from "next/og";

// The preview image when a link to the site is shared (Messages, Facebook,
// Google, etc.) — in the same bold green/gold look as the homepage.
export const alt = "Manhattan Market — Woodley Park's corner store. Order online for pickup or delivery.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GREEN_DEEP = "#163d33";
const GOLD = "#f0bd3e";
const INK = "#1d231f";
const PINK = "#f6b9c6";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: GREEN_DEEP,
          padding: "60px 72px",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 5 }}>
            {[22, 36, 50, 30, 42, 20].map((h, i) => (
              <div key={i} style={{ display: "flex", width: 8, height: h, background: "#ffffff" }} />
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 8, fontWeight: 700, textTransform: "uppercase" }}>
            Manhattan Market
          </div>
          <div
            style={{
              display: "flex",
              marginLeft: "auto",
              background: GOLD,
              color: INK,
              border: `4px solid ${INK}`,
              borderRadius: 999,
              padding: "8px 22px",
              fontSize: 24,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Open daily 9–9
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 800, lineHeight: 0.95, textTransform: "uppercase" }}>
            Your corner store,
          </div>
          <div
            style={{ display: "flex", fontSize: 92, fontWeight: 800, lineHeight: 0.95, textTransform: "uppercase", color: GOLD }}
          >
            now on your phone.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28 }}>
          <div
            style={{
              display: "flex",
              background: PINK,
              color: INK,
              border: `4px solid ${INK}`,
              borderRadius: 16,
              padding: "8px 18px",
              fontWeight: 700,
              textTransform: "uppercase",
              fontSize: 24,
            }}
          >
            Pickup · Delivery
          </div>
          <div style={{ display: "flex", opacity: 0.9 }}>2647 Connecticut Ave NW · Woodley Park · Cleveland Park · Washington, DC</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
