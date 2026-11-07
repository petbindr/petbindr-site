// Unsubscribe links for waitlist / marketing emails.
//
// Each waitlist doc gets a random `unsubscribeToken` at signup. Links carry the
// email + token; nothing else is needed to verify them, so no extra secret has
// to be configured on Vercel.

import { randomUUID } from "crypto";

export const SITE_URL = "https://petbindr.com";

export function newUnsubscribeToken(): string {
  return randomUUID();
}

function query(email: string, token: string): string {
  return `e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`;
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
