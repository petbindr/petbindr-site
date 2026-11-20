import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tools and older browsers ask for /favicon.ico, which was a 404: the tab
  // icon made by app/icon.tsx (a PNG, which they accept) (2026-11-18 review, item 24)
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon" }];
  },
  // Security headers: no framing (clickjacking), no MIME sniffing, trimmed
  // referrers. Deliberately no script CSP: it could break Firebase or Vercel
  // Analytics (2026-11-14 panel review).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
