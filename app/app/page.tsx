import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import HomeApp from "./HomeApp";

// petbindr.com/app: PetBindr in the browser for co-owners without an iPhone
// (Android, or a computer). See HomeApp.tsx. Branded like the rest of the
// site: the logo (back to the homepage) at the top, the site's links below.
export const metadata: Metadata = {
  title: "PetBindr",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const footerLink = "font-inter text-[var(--slate-gray)] hover:text-[var(--bindr-navy)] transition-colors";

export default function AppPage() {
  return (
    <main style={{ background: "var(--warm-cream)", minHeight: "100vh" }} className="px-4 pb-8 flex flex-col">
      <nav className="max-w-xl w-full mx-auto py-5 md:py-6">
        <Link href="/" aria-label="PetBindr home">
          <Image src="/logo.png" alt="PetBindr" width={320} height={103} priority className="w-[120px] md:w-[140px] h-auto" />
        </Link>
      </nav>
      <div className="max-w-xl w-full mx-auto flex-1">
        <HomeApp />
      </div>
      <footer className="max-w-xl w-full mx-auto mt-10 pt-6 flex flex-col items-center gap-3" style={{ borderTop: "1px solid var(--mist-gray)" }}>
        <nav className="flex flex-wrap items-center justify-center gap-5" style={{ fontSize: "14px" }}>
          <Link href="/privacy" className={footerLink}>Privacy</Link>
          <Link href="/terms" className={footerLink}>Terms</Link>
          <Link href="/security" className={footerLink}>Security</Link>
          <a href="mailto:hello@petbindr.com" className={footerLink}>hello@petbindr.com</a>
        </nav>
        <p className="font-inter text-[var(--slate-gray)]" style={{ fontSize: "13px" }}>© PetBindr LLC 2026</p>
      </footer>
    </main>
  );
}
