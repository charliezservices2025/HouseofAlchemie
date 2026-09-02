import { ImageResponse } from "next/og";

// 512px so Chrome on Android offers its install prompt; browsers scale it down for tabs.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1e2222",
          color: "#f7f5f0",
          fontFamily: "Georgia, serif",
          fontSize: 320,
          letterSpacing: -8,
        }}
      >
        H
      </div>
    ),
    size,
  );
}
