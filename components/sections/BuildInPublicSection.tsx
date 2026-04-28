import { Instagram } from "lucide-react";
import FadeIn from "@/components/FadeIn";

function TikTokIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

const socials = [
  { icon: Instagram,   href: "https://instagram.com/petbindr",  label: "@petbindr on Instagram" },
  { icon: TikTokIcon,  href: "https://tiktok.com/@petbindr",    label: "@petbindr on TikTok" },
];

export default function BuildInPublicSection() {
  return (
    <section style={{ background: "var(--pure-white)" }} className="py-20 md:py-28 px-6 md:px-12">
      <div className="max-w-3xl mx-auto text-center">
        <FadeIn>
          <h2
            className="font-fraunces font-semibold text-[var(--bindr-navy)] text-center mb-6"
            style={{ fontSize: "clamp(28px, 4vw, 44px)", letterSpacing: "-0.02em" }}
          >
            We&rsquo;re building this in the open.
          </h2>
        </FadeIn>

        <FadeIn delay={0.1}>
          <p
            className="text-[var(--charcoal)] font-inter leading-relaxed mx-auto mb-10"
            style={{ fontSize: "clamp(16px, 1.8vw, 18px)", maxWidth: "700px" }}
          >
            PetBindr is in active development for iOS. Join the waitlist for
            founding member access, vote on features in development, and follow
            along as we build.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="flex flex-wrap gap-3 justify-center">
            {socials.map(({ icon: Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
              >
                <Icon size={16} />
                {label}
              </a>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
