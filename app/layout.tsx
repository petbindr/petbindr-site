import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "@/styles/globals.css";

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

export const metadata: Metadata = {
  title: "PetBindr — The pet care app for sitters, vets, and everyone who watches your pet",
  description:
    "Replace the printed pet binder. PetBindr is a live, shareable care plan for your pet — built for sitters, vets, and family. Join the iOS waitlist.",
  openGraph: {
    title: "PetBindr — The pet care app for sitters, vets, and everyone who watches your pet",
    description:
      "Replace the printed pet binder. PetBindr is a live, shareable care plan for your pet — built for sitters, vets, and family. Join the iOS waitlist.",
    url: "https://petbindr.com",
    siteName: "PetBindr",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PetBindr — Our pet binder was 13 pages. So we built this instead.",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PetBindr — The pet care app for sitters, vets, and everyone who watches your pet",
    description:
      "Replace the printed pet binder. PetBindr is a live, shareable care plan for your pet — built for sitters, vets, and family. Join the iOS waitlist.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
  metadataBase: new URL("https://petbindr.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
