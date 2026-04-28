import { Instagram, Youtube, Twitter, Facebook } from "lucide-react";
import FadeIn from "@/components/FadeIn";

function TikTokIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

function PinterestIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.65 7.86 6.39 9.29-.09-.78-.17-1.98.04-2.83.18-.77 1.22-5.17 1.22-5.17s-.31-.62-.31-1.54c0-1.45.84-2.53 1.88-2.53.89 0 1.32.67 1.32 1.47 0 .9-.57 2.24-.87 3.48-.25 1.04.52 1.88 1.54 1.88 1.85 0 3.27-1.95 3.27-4.76 0-2.49-1.79-4.23-4.34-4.23-2.96 0-4.69 2.22-4.69 4.51 0 .89.34 1.85.77 2.37.08.1.09.19.07.29-.08.32-.25 1.04-.28 1.18-.04.19-.14.23-.32.14-1.25-.58-2.03-2.42-2.03-3.89 0-3.15 2.29-6.05 6.61-6.05 3.47 0 6.16 2.47 6.16 5.77 0 3.45-2.17 6.22-5.19 6.22-1.01 0-1.97-.53-2.3-1.15l-.62 2.33c-.23.87-.84 1.96-1.25 2.62.94.29 1.94.45 2.97.45 5.52 0 10-4.48 10-10S17.52 2 12 2z" />
    </svg>
  );
}

function SubstackIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="3" rx="1" />
      <path d="M3 11h18" />
      <path d="M3 16l9 4 9-4" />
    </svg>
  );
}

// TODO: Replace all href values with real social URLs when accounts are live
const socials = [
  { icon: Instagram,    href: "https://instagram.com/petbindr",   label: "@petbindr on Instagram" },
  { icon: TikTokIcon,  href: "https://tiktok.com/@petbindr",      label: "@petbindr on TikTok" },
  { icon: Youtube,     href: "https://youtube.com/@petbindr",     label: "@petbindr on YouTube" },
  { icon: Twitter,     href: "https://twitter.com/petbindr",      label: "@petbindr on Twitter" },
  { icon: Facebook,    href: "https://facebook.com/petbindr",     label: "@petbindr on Facebook" },
  { icon: PinterestIcon, href: "https://pinterest.com/petbindr",  label: "@petbindr on Pinterest" },
  { icon: SubstackIcon, href: "https://petbindr.substack.com",    label: "PetBindr on Substack" },
];

export default function BuildInPublicSection() {
  return (
    <section style={{ background: "var(--pure-white)" }} className="py-20 md:py-28 px-6 md:px-12">
      <div className="max-w-3xl mx-auto">
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
            className="text-[var(--charcoal)] font-inter leading-relaxed mb-10"
            style={{ fontSize: "clamp(16px, 1.8vw, 18px)", maxWidth: "700px" }}
          >
            PetBindr is in active development for iOS. Join the waitlist for
            founding member access, vote on features in development, and follow
            along as we build.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="flex flex-wrap gap-3">
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
