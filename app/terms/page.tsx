import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — PetBindr",
};

export default function TermsPage() {
  return (
    <main
      style={{ background: "var(--warm-cream)", minHeight: "100vh" }}
      className="px-6 md:px-12 py-16"
    >
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="font-inter text-[var(--slate-gray)] hover:text-[var(--bindr-navy)] transition-colors mb-10 inline-block"
          style={{ fontSize: "14px" }}
        >
          ← Back to PetBindr
        </Link>

        <h1
          className="font-fraunces font-semibold text-[var(--bindr-navy)] mb-6"
          style={{ fontSize: "clamp(28px, 4vw, 40px)" }}
        >
          Terms of Service
        </h1>

        <p className="font-inter text-[var(--slate-gray)] text-sm mb-8">
          Last updated: 2026
        </p>

        {/* TODO: Replace with real terms of service before launch */}
        <div className="font-inter text-[var(--charcoal)] leading-relaxed space-y-6" style={{ fontSize: "16px" }}>
          <p>
            By accessing petbindr.com or using the PetBindr iOS application, you
            agree to these Terms of Service. If you do not agree, please do not
            use our services.
          </p>
          <p>
            <strong>Waitlist:</strong> Signing up for the waitlist does not
            constitute a purchase or guarantee of any specific pricing, features,
            or availability. Founding Member benefits are provided at our
            discretion and are subject to change.
          </p>
          <p>
            <strong>Use of service:</strong> PetBindr is provided for personal
            pet care management. You are responsible for the accuracy of
            information you enter. PetBindr is not a substitute for professional
            veterinary advice.
          </p>
          <p>
            <strong>Contact:</strong> Questions? Email us at{" "}
            <a
              href="mailto:contact@petbindr.com"
              className="text-[var(--bindr-navy)] underline"
            >
              contact@petbindr.com
            </a>
            .
          </p>
          <p className="text-[var(--slate-gray)] text-sm italic">
            This is a placeholder terms of service. Complete terms will be
            published before the app launches on the App Store.
          </p>
        </div>
      </div>
    </main>
  );
}
