import Hero from "@/components/sections/Hero";
import ProblemSection from "@/components/sections/ProblemSection";
import SolutionSection from "@/components/sections/SolutionSection";
import MultiSpeciesSection from "@/components/sections/MultiSpeciesSection";
import BuildInPublicSection from "@/components/sections/BuildInPublicSection";
import FinalCTASection from "@/components/sections/FinalCTASection";
import FooterSection from "@/components/sections/FooterSection";
import { JsonLd } from "@/lib/jsonld";

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "PetBindr",
  legalName: "PetBindr LLC",
  url: "https://www.petbindr.com",
  logo: "https://www.petbindr.com/logo.png",
  email: "hello@petbindr.com",
  sameAs: ["https://instagram.com/petbindr", "https://tiktok.com/@petbindr"],
};

const softwareApplication = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "PetBindr",
  applicationCategory: "LifestyleApplication",
  operatingSystem: "iOS, Web",
  url: "https://www.petbindr.com",
  description:
    "A live, shareable care plan for your pet: feeding, medications, the vet and your home. Your sitter just opens a link, no app needed.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function Home() {
  return (
    <main>
      <JsonLd data={organization} />
      <JsonLd data={softwareApplication} />
      <Hero />
      <ProblemSection />
      <SolutionSection />
      <MultiSpeciesSection />
      <BuildInPublicSection />
      <FinalCTASection />
      <FooterSection />
    </main>
  );
}
