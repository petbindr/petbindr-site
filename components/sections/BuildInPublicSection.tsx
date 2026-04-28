import { Instagram } from "lucide-react";
import FadeIn from "@/components/FadeIn";

// Lucide doesn't have a TikTok icon; using a simple SVG inline
function TikTokIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

export default function BuildInPublicSection() {
  return (
    <section
      style={{ background: "var(--pure-white)" }}
      className="py-20 md:py-28 px-6 md:px-12"
    >
      <div className="max-w-3xl mx-auto">
        <FadeIn>
          <h2
            className="font-fraunces font-semibold text-[var(--bindr-navy)] mb-6"
            style={{ fontSize: "clamp(28px, 4vw, 44px)", letterSpacing: "-0.02em" }}
          >
            We&rsquo;re building this in the open.
          </h2>
        </FadeIn>

        <FadeIn delay={0.1}>
          <p
            className="text-[var(--charcoal)] font-inter leading-relaxed mb-10"
            style={{ fontSize: "clamp(16px, 1.8vw, 18px)", maxWidth: "700px" }}
          >
            PetBindr is in active development for iOS. Join the waitlist for
            founding member access, vote on features in development, and follow
            along as we build.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="flex flex-wrap gap-4">
            {/* TODO: Replace href values with real social URLs once accounts are live */}
            <a
              href="https://instagram.com/petbindr"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              <Instagram size={18} strokeWidth={1.75} />
              @petbindr on Instagram
            </a>
            <a
              href="https://tiktok.com/@petbindr"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              <TikTokIcon size={18} />
              @petbindr on TikTok
            </a>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
