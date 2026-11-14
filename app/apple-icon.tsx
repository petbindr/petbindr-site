import { ImageResponse } from "next/og";
import { Book, logoDataUrl } from "@/lib/brandImage";

// "Add to Home Screen" on iPhone (petbindr.com/app, the sitter link page)
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const src = await logoDataUrl();
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#FBF8F3" }}>
        <Book src={src} height={132} />
      </div>
    ),
    size,
  );
}
