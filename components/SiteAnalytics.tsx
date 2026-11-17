"use client";

// Visitor counts (2026-11-17, review: the site had no analytics at all). Vercel
// Web Analytics: no cookies, no personal data, counts page views by page,
// referrer and country. Turned on in the Vercel project (Analytics tab).
// Query strings are dropped before anything is sent, except utm_* campaign tags:
// /unsubscribe and /account/action carry private tokens in theirs. Sitter links
// keep their secret after "#", which is dropped too.
// Also remembers where a visit came from, for waitlist signups (lib/signupSource).

import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";
import { rememberSignupSource } from "@/lib/signupSource";

const KEEP = ["utm_source", "utm_medium", "utm_campaign"];

export default function SiteAnalytics() {
  useEffect(() => { rememberSignupSource(); }, []);
  return (
    <Analytics
      beforeSend={(event) => {
        try {
          const url = new URL(event.url);
          const kept = new URLSearchParams();
          for (const k of KEEP) {
            const v = url.searchParams.get(k);
            if (v) kept.set(k, v);
          }
          url.search = kept.toString();
          url.hash = "";
          return { ...event, url: url.toString() };
        } catch {
          return null; // can't clean it: don't send it
        }
      }}
    />
  );
}
