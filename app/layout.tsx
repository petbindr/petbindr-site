import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "@/styles/globals.css";
import SiteAnalytics from "@/components/SiteAnalytics";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

// The link-preview picture and the tab icons come from app/opengraph-image.tsx,
// icon.tsx and apple-icon.tsx (made at build time from the logo). One address,
// www: petbindr.com redirects there.
const description =
  "A live, shareable care plan for your pet: feeding, medications, the vet and your home. Your sitter just opens a link, no app needed. Join the iOS waitlist.";

export const metadata: Metadata = {
  title: "PetBindr: the pet care app for sitters, vets and everyone who watches your pet",
  description,
  openGraph: {
    title: "PetBindr: your pet's whole life, in one binder you can share",
    description,
    url: "https://www.petbindr.com",
    siteName: "PetBindr",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PetBindr: your pet's whole life, in one binder you can share",
    description,
  },
  metadataBase: new URL("https://www.petbindr.com"),
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the script below adds "js" to <html> first
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Scroll fade-ins (components/FadeIn.tsx): reveals sections as they come into
            view. Inline so it runs before the page's scripts load; without it,
            nothing is hidden. */}
        <script dangerouslySetInnerHTML={{ __html: "(function(){var d=document.documentElement;d.classList.add('js');if(!('IntersectionObserver'in window)){d.classList.remove('js');return;}var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{rootMargin:'0px 0px -60px 0px'});function scan(){document.querySelectorAll('.fade-in:not([data-fo])').forEach(function(el){el.setAttribute('data-fo','');io.observe(el);});}document.addEventListener('DOMContentLoaded',scan);new MutationObserver(scan).observe(d,{childList:true,subtree:true});})();" }} />
      </head>
      <body>
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
