import type { MetadataRoute } from "next";

// /robots.txt (it was a 404). Sitter links, the browser app and account pages
// are private to whoever has the link, so search engines are kept out of them.
export default function robots(): MetadataRoute.Robots {
  return {
    // Not "/s": as a prefix it also matched /security and /sitemap.xml
    // (2026-11-18 review, item 16). "$" ends the match (Google, Bing).
    rules: [{ userAgent: "*", allow: "/", disallow: ["/s$", "/s/", "/s?", "/app", "/account", "/api", "/unsubscribe"] }],
    sitemap: "https://www.petbindr.com/sitemap.xml",
    host: "https://www.petbindr.com",
  };
}
