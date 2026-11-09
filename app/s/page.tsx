import type { Metadata } from "next";
import SitterLinkView from "./SitterLinkView";

// The page a sitter opens from a PetBindr link: petbindr.com/s#<link>.
// The secret is after "#", so it never reaches this server or its logs; the
// page reads it in the browser and sends it to the getSitterLink function.
// See PetBindr/WEB_SITTER_LINK_PLAN.md.
export const metadata: Metadata = {
  title: "Pet Care Info · PetBindr",
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
