import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — PetBindr",
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>

        <p className="font-inter text-[var(--slate-gray)] text-sm mb-8">
          Last updated: 2026
        </p>

        {/* TODO: Replace with real privacy policy before launch */}
        <div className="font-inter text-[var(--charcoal)] leading-relaxed space-y-6" style={{ fontSize: "16px" }}>
          <p>
            PetBindr LLC (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is committed to
            protecting your privacy. This Privacy Policy explains how we
            collect, use, and share information about you when you use our
            website and iOS application.
          </p>
          <p>
            <strong>Information we collect:</strong> When you join our waitlist,
            we collect your email address. When you use the PetBindr iOS app, we
            collect pet care information you choose to enter, as well as account
            details necessary to provide the service.
          </p>
          <p>
            <strong>How we use your information:</strong> We use your email
            address to send you launch updates and product information you
            signed up for. We do not sell your data to third parties.
          </p>
          <p>
            <strong>Contact:</strong> Questions about this policy? Email us at{" "}
            <a
              href="mailto:contact@petbindr.com"
              className="text-[var(--bindr-navy)] underline"
            >
              contact@petbindr.com
            </a>
            .
          </p>
          <p className="text-[var(--slate-gray)] text-sm italic">
            This is a placeholder privacy policy. A complete policy will be
            published before the app launches on the App Store.
          </p>
        </div>
      </div>
    </main>
  );
}
