import type { Metadata } from "next";
import SitterLinkView from "./SitterLinkView";

// The page a sitter opens from a PetBindr link: petbindr.com/s#<link>.
// The secret is after "#", so it never reaches this server or its logs; the
// page reads it in the browser and sends it to the getSitterLink function.
// See PetBindr/WEB_SITTER_LINK_PLAN.md.
// Its own link preview: it used to show the homepage's ("…Join the iOS
// waitlist.") when the link was texted to a sitter.
const description = "Feeding, medications, the vet and how to reach the owner, shared with you through PetBindr. No app needed.";
export const metadata: Metadata = {
  title: "Pet Care Info · PetBindr",
  description,
  openGraph: { title: "Pet care info, shared with you", description, siteName: "PetBindr", type: "website", images: [{ url: "/opengraph-image", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: "Pet care info, shared with you", description, images: ["/opengraph-image"] },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function SitterLinkPage() {
  return (
    <main style={{ background: "var(--warm-cream)", minHeight: "100vh" }} className="px-4 py-8 md:py-12">
      <div className="max-w-xl mx-auto">
        <SitterLinkView />
      </div>
    </main>
  );
}
