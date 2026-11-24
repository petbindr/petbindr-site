import Image from "next/image";
import FadeIn from "@/components/FadeIn";
import WaitlistForm from "@/components/WaitlistForm";

export default function Hero() {
  return (
    <section
      style={{ background: "var(--warm-cream)" }}
      className="min-h-screen flex flex-col"
    >
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-6">
        <Image
          src="/logo.png"
          alt="PetBindr"
          width={320}
          height={103}
          priority
          className="w-[120px] md:w-[160px] h-auto"
        />
      </nav>

      {/* Hero content */}
      <div className="flex-1 flex items-center justify-center px-6 md:px-12 pb-20 pt-8">
        <div className="max-w-3xl w-full text-center flex flex-col items-center">
          {/* No fade-in on the headline: it is the largest paint, and fading it in
              held it back ~1 s (Lighthouse LCP 2.9 s, 2026-11-24) */}
          <div>
            <h1
              className="font-fraunces font-semibold text-[var(--bindr-navy)] leading-tight tracking-tight mb-6"
              style={{ fontSize: "clamp(36px, 6vw, 72px)", letterSpacing: "-0.03em" }}
            >
              Our pet binder was 13 pages. So we built this instead.
            </h1>
          </div>

          <FadeIn delay={0.1}>
            <p
              className="text-[var(--charcoal)] font-inter mb-10 max-w-2xl"
              style={{ fontSize: "clamp(17px, 2vw, 20px)", lineHeight: "1.6" }}
            >
              PetBindr is a live, shareable care plan for your pet. Update it
              from anywhere, share exactly what your sitter needs, and see when
              feedings and meds are done — in real time.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <WaitlistForm variant="light" />
          </FadeIn>

          <FadeIn delay={0.3}>
            <p className="font-inter text-[var(--slate-gray)] mt-6" style={{ fontSize: "15px", lineHeight: "1.6" }}>
              Already have an account, or on Android?{" "}
              <a
                href="/app?utm_source=home&utm_medium=hero"
                className="underline text-[var(--bindr-navy)]"
              >
                Sign in at petbindr.com/app
              </a>
              . It works in any phone&rsquo;s browser.
            </p>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
