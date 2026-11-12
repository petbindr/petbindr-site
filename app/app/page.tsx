import type { Metadata } from "next";
import HomeApp from "./HomeApp";

// petbindr.com/app: PetBindr in the browser for co-owners without an iPhone
// (Android, or a computer). See HomeApp.tsx.
export const metadata: Metadata = {
  title: "PetBindr",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function AppPage() {
  return (
    <main style={{ background: "var(--warm-cream)", minHeight: "100vh" }} className="px-4 py-8 md:py-12">
      <div className="max-w-xl mx-auto">
        <HomeApp />
      </div>
    </main>
  );
}
