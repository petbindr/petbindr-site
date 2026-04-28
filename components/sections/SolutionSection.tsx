import FadeIn from "@/components/FadeIn";

const features = [
  {
    heading: "Share exactly what they need.",
    body: "Toggle permissions per sitter — feeding, meds, vet info, the alarm code. Turn things on and off in real time. Revoke access the moment they're done.",
    screenshotLabel: "Sharing & permissions",
    imageRight: false,
  },
  {
    heading: "Watch it happen.",
    body: "Sitters check off feedings and medication doses as they go. You see who did what, when, with timestamps. No more \u201cdid anyone feed her?\u201d group texts.",
    screenshotLabel: "Real-time task tracking",
    imageRight: true,
  },
  {
    heading: "The Quick Reference Card.",
    body: "One screen with everything an emergency sitter needs: photo, microchip, meds, allergies, vet, emergency contacts. Tap-to-call built in.",
    screenshotLabel: "Quick Reference Card",
    imageRight: false,
  },
];

export default function SolutionSection() {
  return (
    <section
      style={{ background: "var(--warm-cream)" }}
      className="py-20 md:py-28 px-6 md:px-12"
    >
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <h2
            className="font-fraunces font-semibold text-[var(--bindr-navy)] text-center mb-16 md:mb-20"
            style={{ fontSize: "clamp(28px, 4vw, 48px)", letterSpacing: "-0.02em" }}
          >
            PetBindr replaces the binder.
          </h2>
        </FadeIn>

        <div className="flex flex-col gap-20 md:gap-28">
          {features.map(({ heading, body, screenshotLabel, imageRight }, i) => (
            <FadeIn key={i}>
              <div
                className={`flex flex-col gap-10 md:gap-16 items-center ${
                  imageRight ? "md:flex-row-reverse" : "md:flex-row"
                }`}
              >
                {/* Text */}
                <div className="flex-1 max-w-md">
                  <h3
                    className="font-fraunces font-semibold text-[var(--bindr-navy)] mb-4"
                    style={{ fontSize: "clamp(22px, 2.5vw, 30px)" }}
                  >
                    {heading}
                  </h3>
                  <p
                    className="text-[var(--charcoal)] font-inter leading-relaxed"
                    style={{ fontSize: "17px" }}
                  >
                    {body}
                  </p>
                </div>

                {/* Screenshot placeholder */}
                <div className="flex-shrink-0 flex justify-center w-full md:w-auto">
                  {/* TODO: Replace this div with an actual <Image> when screenshots are ready.
                      Put screenshots in /public/screenshots/ and update src accordingly. */}
                  <div className="screenshot-placeholder">
                    Screenshot: {screenshotLabel}
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
