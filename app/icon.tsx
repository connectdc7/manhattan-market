import { ImageResponse } from "next/og";

// Browser-tab icon — a tiny bar-chart skyline on the brand green, echoing
// the fuller skyline mark in components/Logo.tsx. Kept to plain flexbox
// bars (rather than the mark's actual building paths) since this route
// renders through next/og's simplified layout engine, and bars are what
// still reads clearly at 16–32px.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          backgroundColor: "#21594a",
          borderRadius: 7,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 2,
            paddingBottom: 4,
          }}
        >
          <div style={{ display: "flex", width: 3, height: 11, background: "#ffffff" }} />
          <div style={{ display: "flex", width: 3, height: 18, background: "#ffffff" }} />
          <div style={{ display: "flex", width: 3, height: 24, background: "#ffffff" }} />
          <div style={{ display: "flex", width: 3, height: 15, background: "#ffffff" }} />
          <div style={{ display: "flex", width: 3, height: 20, background: "#ffffff" }} />
          <div style={{ display: "flex", width: 3, height: 10, background: "#ffffff" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
