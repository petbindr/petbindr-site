import Link from "next/link";
import type { Metadata } from "next";

// Custom 404 in the site's style (was Next's plain default; Fresh list 5 S5).
export const metadata: Metadata = {
  title: "Page Not Found — PetBindr",
  robots: { index: false },
};

const links = [
  { href: "/", label: "PetBindr home" },
  { href: "/faq", label: "Questions and answers" },
  { href: "/pet-sitter-instructions-template", label: "Free pet sitter instructions template" },
  { href: "/app", label: "Open PetBindr in your browser" },
];

export default function NotFound() {
  return (
    <main
      style={{ background: "var(--warm-cream)", minHeight: "100vh" }}
      className="px-6 md:px-12 py-16"
    >
      <div className="max-w-2xl mx-auto">
        <h1
          className="font-fraunces font-semibold text-(--bindr-navy) mb-4"
          style={{ fontSize: "clamp(28px, 4vw, 40px)" }}
        >
          We couldn&rsquo;t find that page
        </h1>

        <p
          className="font-inter text-(--charcoal) leading-relaxed mb-10"
          style={{ fontSize: "18px" }}
        >
          The link may be mistyped, or the page has moved. If someone sent you a sitter link,
          open the link from their message again or ask them to send a new one.
        </p>

        <ul className="font-inter space-y-3" style={{ fontSize: "16px" }}>
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="text-(--bindr-navy) underline underline-offset-4 hover:opacity-80 transition-opacity"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
