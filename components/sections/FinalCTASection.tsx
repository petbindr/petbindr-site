import FadeIn from "@/components/FadeIn";
import WaitlistForm from "@/components/WaitlistForm";

export default function FinalCTASection() {
  return (
    <section
      style={{ background: "var(--bindr-navy)" }}
      className="py-24 md:py-32 px-6 md:px-12"
    >
      <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-10">
        <FadeIn>
          <h2
            className="font-fraunces font-semibold text-white"
            style={{ fontSize: "clamp(32px, 5vw, 56px)", letterSpacing: "-0.02em" }}
          >
            Get on the list.
          </h2>
        </FadeIn>

        <FadeIn delay={0.1}>
          <WaitlistForm variant="dark" />
        </FadeIn>
      </div>
    </section>
  );
}
