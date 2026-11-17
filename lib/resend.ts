import { Resend } from "resend";

// TODO: Swap FROM_EMAIL to waitlist@petbindr.com once domain is verified in Resend.
// Until then, onboarding@resend.dev works on the free tier for testing.
export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export const FROM_NAME = "PetBindr";

// Lazy singleton — only instantiated at request time, not at build time
let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error("RESEND_API_KEY environment variable is not set.");
    }
    _resend = new Resend(key);
  }
  return _resend;
}

// Marketing email (the waitlist) must show a postal address (US CAN-SPAM Act).
// A street address or a P.O. box registered to PetBindr LLC. Empty until set,
// and then the footer leaves the line out.
export const MAILING_ADDRESS = "";

/** "PetBindr LLC, <address>" for email footers, or "" until an address is set */
export function mailingAddressLine(): string {
  return MAILING_ADDRESS ? `PetBindr LLC, ${MAILING_ADDRESS}` : "";
}
