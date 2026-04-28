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
