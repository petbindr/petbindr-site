import { Dog, Cat, Bird, Fish, Bug, Rabbit } from "lucide-react";
import FadeIn from "@/components/FadeIn";

const petIcons = [
  { icon: Dog,    label: "Dog" },
  { icon: Cat,    label: "Cat" },
  { icon: Bird,   label: "Bird" },
  { icon: Fish,   label: "Fish" },
  { icon: Bug,    label: "Reptile" },
  { icon: Rabbit, label: "Rabbit" },
];

export default function MultiSpeciesSection() {
  return (
    <section
      style={{ background: "var(--soft-teal)" }}
      className="py-20 md:py-28 px-6 md:px-12"
    >
      <div className="max-w-3xl mx-auto text-center">
        <FadeIn>
          <h2
            className="font-fraunces font-semibold text-[var(--bindr-navy)] mb-6"
            style={{ fontSize: "clamp(28px, 4vw, 44px)", letterSpacing: "-0.02em" }}
          >
            Built for every kind of pet.
          </h2>
        </FadeIn>

        <FadeIn delay={0.1}>
          <p
            className="text-[var(--charcoal)] font-inter leading-relaxed mx-auto mb-12"
            style={{ fontSize: "clamp(16px, 1.8vw, 18px)", maxWidth: "600px" }}
          >
            Dogs, cats, rabbits, ferrets, birds, reptiles, fish — first-class
            support for all of them. Yes, your bearded dragon&rsquo;s UVB
            schedule lives here too.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {petIcons.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <Icon
                  size={32}
                  strokeWidth={1.75}
                  color="var(--bindr-navy)"
                  aria-label={label}
                />
                <span
                  className="text-[var(--bindr-navy)] font-inter font-medium"
                  style={{ fontSize: "12px" }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
