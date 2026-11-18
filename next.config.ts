import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tools and older browsers ask for /favicon.ico, which was a 404: the tab
  // icon made by app/icon.tsx (a PNG, which they accept) (2026-11-18 review, item 24)
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon" }];
  },
};

export default nextConfig;
