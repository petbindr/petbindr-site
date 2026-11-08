import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import ActionHandler from "./ActionHandler";

// Handles the links in PetBindr's account emails (verify email, reset password).
// The email functions in PetBindr/functions/index.js point their links here
// instead of Firebase's default page at petbindr-2d4bd.firebaseapp.com.
export const metadata: Metadata = {
  title: "Your PetBindr Account",
  robots: { index: false, follow: false },
  // The URL carries a one-time code; don't send it to other sites as a referrer.
  referrer: "no-referrer",
};

export default function AccountActionPage() {
  return (
    <main style={{ background: "var(--warm-cream)", minHeight: "100vh" }} className="px-6 md:px-12 py-16">
      <div className="max-w-xl mx-auto">
        <Link
          href="/"
          className="font-inter text-[var(--slate-gray)] hover:text-[var(--bindr-navy)] transition-colors mb-10 inline-block"
          style={{ fontSize: "14px" }}
        >
          ← Back to PetBindr
        </Link>
        <Suspense fallback={<p className="font-inter text-[var(--slate-gray)]">Loading…</p>}>
          <ActionHandler />
        </Suspense>
      </div>
    </main>
  );
}
