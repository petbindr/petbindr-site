import Hero from "@/components/sections/Hero";
import ProblemSection from "@/components/sections/ProblemSection";
import SolutionSection from "@/components/sections/SolutionSection";
import MultiSpeciesSection from "@/components/sections/MultiSpeciesSection";
import BuildInPublicSection from "@/components/sections/BuildInPublicSection";
import FinalCTASection from "@/components/sections/FinalCTASection";
import FooterSection from "@/components/sections/FooterSection";

export default function Home() {
  return (
    <main>
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
