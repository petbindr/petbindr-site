// Unsubscribe links for waitlist / marketing emails.
//
// Each waitlist doc gets a random `unsubscribeToken` at signup. Links carry only
// the token (2026-11-18 review, item 22: the email address was in the link, so
// it ended up in browser history and server logs). Links sent before that also
// carry the email, and still work.
//
// www, not the bare domain: it redirects, and some mail apps' one-click
// unsubscribe doesn't follow redirects (item 23).

import { randomUUID } from "crypto";

export const SITE_URL = "https://www.petbindr.com";

export function newUnsubscribeToken(): string {
  return randomUUID();
}

function query(_email: string, token: string): string {
  return `t=${encodeURIComponent(token)}`;
}

/** Page with an "Unsubscribe" button (safe from link scanners that open URLs). */
export function unsubscribePageUrl(email: string, token: string): string {
  return `${SITE_URL}/unsubscribe?${query(email, token)}`;
}

/** Endpoint for RFC 8058 one-click unsubscribe (Gmail / Apple Mail button). */
export function oneClickUnsubscribeUrl(email: string, token: string): string {
  return `${SITE_URL}/api/unsubscribe?${query(email, token)}`;
}

/** Headers that make mail apps show their own "Unsubscribe" button. */
export function unsubscribeHeaders(email: string, token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${oneClickUnsubscribeUrl(email, token)}>, <mailto:hello@petbindr.com?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
