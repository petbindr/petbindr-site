// Waitlist referral codes (2026-11-24, Fresh list 2 O1). Each signup gets a short
// code; its share link is https://petbindr.com/?ref=<code>. Codes are random, say
// nothing about the email, and are only ever looked up on the server.

import { randomInt } from "node:crypto";

// No 0/O, 1/I/L: easy to read aloud or copy by hand
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const REFERRAL_CODE_LENGTH = 8;
export const REFERRAL_CODE_RE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;

export function newReferralCode(): string {
  let s = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

export function referralShareUrl(code: string): string {
  return `https://petbindr.com/?ref=${code}`;
}
