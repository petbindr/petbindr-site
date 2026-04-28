import { FileText, MessageCircle, Plane } from "lucide-react";
import FadeIn from "@/components/FadeIn";

const problems = [
  {
    icon: FileText,
    text: "The 13-page Google Doc you sent your sitter that's already out of date.",
  },
  {
    icon: MessageCircle,
    text: "The \u201cwait, which food?\u201d text at 11pm your time.",
  },
  {
    icon: Plane,
    text: "The flight home wondering if anyone actually gave the insulin shot.",
  },
];

export default function ProblemSection() {
  return (
    <section
      style={{ background: "var(--pure-white)" }}
      className="py-20 md:py-28 px-6 md:px-12"
    >
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <h2
            className="font-fraunces font-semibold text-[var(--bindr-navy)] text-center mb-14"
            style={{ fontSize: "clamp(28px, 4vw, 44px)", letterSpacing: "-0.02em" }}
          >
            You&rsquo;ve done this dance before.
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
          {problems.map(({ icon: Icon, text }, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="flex flex-col gap-5">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--soft-teal)" }}
                >
                  <Icon
                    size={24}
                    strokeWidth={1.75}
                    color="var(--bindr-navy)"
                  />
                </div>
                <p
                  className="text-[var(--charcoal)] font-inter leading-relaxed"
                  style={{ fontSize: "17px" }}
                >
                  {text}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
