import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The logo (public/logo.png, 1658×534: the book on the left, the word on the
// right) as a data URL, for the images made at build time: the tab icon, the
// home-screen icon and the link preview (app/icon.tsx, apple-icon.tsx,
// opengraph-image.tsx). Everything comes from this one file, so they match it.
export const LOGO_W = 1658;
export const LOGO_H = 534;
/** How wide the book is, from the left edge */
export const BOOK_W = 486;

export async function logoDataUrl() {
  const png = await readFile(join(process.cwd(), "public", "logo.png"));
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** Just the book, `height` tall, as an element for ImageResponse */
export function Book({ src, height }: { src: string; height: number }) {
  const scale = height / LOGO_H;
  return (
    <div style={{ display: "flex", width: Math.round(BOOK_W * scale), height, overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} width={Math.round(LOGO_W * scale)} height={height} alt="" />
    </div>
  );
}
