import type { MetadataRoute } from "next";

// /sitemap.xml (it was a 404): the public pages only
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.petbindr.com";
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/security`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
