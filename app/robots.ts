import type { MetadataRoute } from "next";

// /robots.txt (it was a 404). Sitter links, the browser app and account pages
// are private to whoever has the link, so search engines are kept out of them.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/s", "/app", "/account", "/api", "/unsubscribe"] }],
    sitemap: "https://www.petbindr.com/sitemap.xml",
    host: "https://www.petbindr.com",
  };
}
