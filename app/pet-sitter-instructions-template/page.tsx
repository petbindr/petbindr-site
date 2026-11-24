import Link from "next/link";
import type { Metadata } from "next";

const title = "Pet sitter instructions template (free, printable) — PetBindr";
const description = "A free pet sitter instructions template: what to write down before you leave, from feeding and medications to the vet and house details. Copy it, or send your sitter a live link.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/pet-sitter-instructions-template" },
  openGraph: { title, description, url: "/pet-sitter-instructions-template", siteName: "PetBindr", type: "article", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] },
};

const sections: { heading: string; items: string[] }[] = [
  {
    heading: "1. Your pet",
    items: [
      "Name, species, breed, age and a recent photo.",
      "Microchip number and the company it's registered with.",
      "Personality: friendly, shy, afraid of men in hats, escapes through open doors.",
      "Words they know (\"walk\", \"treat\", \"off\") and what calms them down.",
    ],
  },
  {
    heading: "2. Feeding",
    items: [
      "Food brand, the amount per meal and what time each meal is.",
      "Treats: which ones, how many a day, and what they must never get.",
      "Where the food is kept and which bowl or scoop to use.",
      "Allergies and foods to avoid.",
    ],
  },
  {
    heading: "3. Medications and supplements",
    items: [
      "Each medication: name, dose, time, and how to give it (hidden in food, pill pocket, by mouth).",
      "What to do if a dose is missed or spit out. Write the actual rule, not \"use judgment\".",
      "Where the medication is stored.",
      "How you want the sitter to confirm each dose, so you know it happened.",
    ],
  },
  {
    heading: "4. Daily routine",
    items: [
      "Walk or play times, how long, and the usual route.",
      "Litter box, cage or tank care: what to clean and how often.",
      "Where your pet sleeps and when they go to bed.",
      "Anything they should not do (furniture, off-leash, other dogs).",
    ],
  },
  {
    heading: "5. Vet and emergencies",
    items: [
      "Your regular vet: name, phone and address.",
      "The nearest 24-hour emergency vet.",
      "Your phone number and a backup contact who can reach your pet fast.",
      "How much the sitter may spend on care without calling you first, and who authorizes it.",
    ],
  },
  {
    heading: "6. The house",
    items: [
      "Door and lockbox codes, alarm instructions and Wi-Fi. Share these only with a sitter you trust, and change or remove them when the job ends.",
      "Where the leash, poop bags, cleaning supplies and spare keys are.",
      "Trash day, mail, plants, and anything else you want done.",
    ],
  },
  {
    heading: "7. Updates",
    items: [
      "How often you want a photo or message, and how.",
      "What counts as \"call me right away\": not eating, vomiting, limping, an escape.",
    ],
  },
];

export default function SitterTemplatePage() {
  return (
    <main style={{ background: "var(--warm-cream)", minHeight: "100vh" }} className="px-6 md:px-12 py-16">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="font-inter text-[var(--slate-gray)] hover:text-[var(--bindr-navy)] transition-colors mb-10 inline-block"
          style={{ fontSize: "14px" }}
        >
          ← Back to PetBindr
        </Link>

        <h1 className="font-fraunces font-semibold text-[var(--bindr-navy)] mb-4" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>
          Pet sitter instructions template
        </h1>
        <p className="font-inter text-[var(--charcoal)] leading-relaxed mb-4" style={{ fontSize: "18px" }}>
          A good sitter can only follow what you wrote down. Copy this list into a note or a document, fill in
          each line, and leave it where your sitter will see it. It takes about ten minutes, and it saves the
          late-night &ldquo;where does she keep the&hellip;?&rdquo; text.
        </p>
        <p className="font-inter text-[var(--slate-gray)] mb-12" style={{ fontSize: "15px" }}>
          Printing this page gives you a clean checklist.
        </p>

        <div className="space-y-10">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="font-fraunces font-semibold text-[var(--bindr-navy)] mb-3" style={{ fontSize: "22px" }}>
                {s.heading}
              </h2>
              <ul className="font-inter text-[var(--charcoal)] leading-relaxed space-y-2 list-none" style={{ fontSize: "16px" }}>
                {s.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span aria-hidden className="text-[var(--slate-gray)]">☐</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section
          className="mt-14 rounded-2xl p-6 md:p-8"
          style={{ background: "#fff", border: "1px solid var(--mist-gray)" }}
        >
          <h2 className="font-fraunces font-semibold text-[var(--bindr-navy)] mb-3" style={{ fontSize: "24px" }}>
            Or send your sitter a link instead
          </h2>
          <p className="font-inter text-[var(--charcoal)] leading-relaxed mb-3" style={{ fontSize: "16px" }}>
            A document goes out of date the moment the vet changes a dose. In PetBindr you fill this in once,
            then send your sitter a link. They open it in their phone&rsquo;s browser: no app, no account. They see
            only what you chose to share, check off feedings and medications as they go, and you see who did
            what and when. Turn the link off when the visit ends.
          </p>
          <a href="/app?utm_source=sitter-template&utm_medium=page" className="btn-coral inline-block">
            Make a free binder
          </a>
        </section>
      </div>
    </main>
  );
}
