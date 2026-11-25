import InstagramIcon from "@/components/InstagramIcon";
import Link from "next/link";

function TikTokIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

const socials = [
  { icon: InstagramIcon, href: "https://instagram.com/petbindr",  label: "Instagram" },
  { icon: TikTokIcon, href: "https://tiktok.com/@petbindr",    label: "TikTok" },
];

export default function FooterSection() {
  return (
    <footer
      style={{ background: "var(--warm-cream)", borderTop: "1px solid var(--mist-gray)" }}
      className="py-10 px-6 md:px-12"
    >
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-6">
        {/* Social icons */}
        <div className="flex flex-wrap items-center justify-center gap-5">
          {socials.map(({ icon: Icon, href, label }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-(--slate-gray) hover:text-(--bindr-navy) transition-colors"
              aria-label={`PetBindr on ${label}`}
            >
              <Icon size={20} />
            </a>
          ))}
        </div>

        {/* Links */}
        <nav className="flex flex-wrap items-center justify-center gap-6">
          <Link href="/privacy" className="font-inter text-(--slate-gray) hover:text-(--bindr-navy) transition-colors" style={{ fontSize: "14px" }}>
            Privacy
          </Link>
          <Link href="/terms" className="font-inter text-(--slate-gray) hover:text-(--bindr-navy) transition-colors" style={{ fontSize: "14px" }}>
            Terms
          </Link>
          <a href="/app?utm_source=home&utm_medium=footer" className="font-inter text-(--slate-gray) hover:text-(--bindr-navy) transition-colors" style={{ fontSize: "14px" }}>
            Sign in
          </a>
          <Link href="/faq" className="font-inter text-(--slate-gray) hover:text-(--bindr-navy) transition-colors" style={{ fontSize: "14px" }}>
            Help
          </Link>
          <Link href="/pet-sitter-instructions-template" className="font-inter text-(--slate-gray) hover:text-(--bindr-navy) transition-colors" style={{ fontSize: "14px" }}>
            Sitter template
          </Link>
          <Link href="/security" className="font-inter text-(--slate-gray) hover:text-(--bindr-navy) transition-colors" style={{ fontSize: "14px" }}>
            Security
          </Link>
          <a href="mailto:hello@petbindr.com?subject=PetBindr%20feedback" className="font-inter text-(--slate-gray) hover:text-(--bindr-navy) transition-colors" style={{ fontSize: "14px" }}>
            Send feedback
          </a>
          <a href="mailto:hello@petbindr.com" className="font-inter text-(--slate-gray) hover:text-(--bindr-navy) transition-colors" style={{ fontSize: "14px" }}>
            hello@petbindr.com
          </a>
        </nav>

        <p className="font-inter text-(--slate-gray)" style={{ fontSize: "14px" }}>
          © PetBindr LLC 2026
        </p>
      </div>
    </footer>
  );
}
