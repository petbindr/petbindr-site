import { ImageResponse } from "next/og";
import { Book, logoDataUrl } from "@/lib/brandImage";

// The browser tab icon: the logo's book (there was no icon, /favicon.ico was a 404)
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const src = await logoDataUrl();
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <Book src={src} height={62} />
      </div>
    ),
    size,
  );
}
