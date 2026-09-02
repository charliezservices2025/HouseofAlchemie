import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
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
          fontSize: 40,
          letterSpacing: -1,
        }}
      >
        H
      </div>
    ),
    size,
  );
}
