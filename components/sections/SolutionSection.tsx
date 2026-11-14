import Image from "next/image";
import FadeIn from "@/components/FadeIn";

const features = [
  {
    heading: "Share exactly what they need.",
    body: "Pick what each person sees, from a dog walker to family. Send your sitter a link they open in their phone's browser: no app, no account. Turn it off the moment they're done.",
    screenshot: { src: "/screenshots/share.jpg", alt: "Invite a Sitter in PetBindr: Biscuit selected, sent as a link with no app needed, and a choice of what the sitter can see" },
    imageRight: false,
  },
  {
    heading: "Watch it happen.",
    body: "Sitters check off feedings and medication doses as they go. You see who did what, when, with timestamps. No more \u201cdid anyone feed her?\u201d group texts.",
    screenshot: { src: "/screenshots/track.jpg", alt: "Biscuit's feeding in PetBindr: breakfast checked off, \"Fed by Sam at 7:04 AM\", dinner still to do" },
    imageRight: true,
  },
  {
    heading: "The Quick Reference Card.",
    body: "One screen with everything an emergency sitter needs: photo, microchip, meds, allergies, vet, emergency contacts. Tap-to-call built in.",
    screenshot: { src: "/screenshots/quickref.jpg", alt: "Biscuit's Quick Reference in PetBindr: microchip number, behavior notes, feeding times and medications on one screen" },
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
          {features.map(({ heading, body, screenshot, imageRight }, i) => (
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

                {/* Real app screens (iPhone 17 Pro Max, demo data on the test
                    servers), in public/screenshots/. These were grey
                    "Screenshot: …" placeholder boxes until 2026-11-14. */}
                <div className="flex-shrink-0 flex justify-center w-full md:w-auto">
                  <Image
                    src={screenshot.src}
                    alt={screenshot.alt}
                    width={660}
                    height={1434}
                    sizes="(min-width: 768px) 280px, 70vw"
                    className="w-[70vw] max-w-[280px] h-auto rounded-[32px]"
                    style={{ border: "1px solid var(--mist-gray)", boxShadow: "0 12px 32px rgba(31, 60, 95, 0.12)" }}
                  />
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
