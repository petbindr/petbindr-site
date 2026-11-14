import { ImageResponse } from "next/og";
import { LOGO_H, LOGO_W, logoDataUrl } from "@/lib/brandImage";

// The picture shown when a petbindr.com link is shared (iMessage, Slack, X...),
// the homepage and every page under it, sitter links included. The file it
// pointed to before was a 4-byte placeholder, so every preview had a broken image.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "PetBindr: your pet's whole life, in one binder you can share";

export default async function OpengraphImage() {
  const src = await logoDataUrl();
  const logoH = 150;
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#FBF8F3", padding: "72px 80px", justifyContent: "space-between" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={Math.round((LOGO_W * logoH) / LOGO_H)} height={logoH} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 60, fontWeight: 700, color: "#1F3C5F", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            Your pet&apos;s whole life, in one binder you can share.
          </div>
          <div style={{ fontSize: 30, color: "#1A1F2E", marginTop: 24, lineHeight: 1.4 }}>
            Feeding, medications and the vet in one place. Your sitter just opens a link.
          </div>
        </div>
        <div style={{ display: "flex", height: 12, width: 160, background: "#74C4CD", borderRadius: 6 }} />
      </div>
    ),
    size,
  );
}
