import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd, textOf } from "@/lib/jsonld";

const description = "Answers to common questions about PetBindr: sharing with a sitter, sitter links, reminders, printing, your account and getting help.";

export const metadata: Metadata = {
  title: "Help and FAQ — PetBindr",
  description,
  alternates: { canonical: "/faq" },
  openGraph: { title: "Help and FAQ — PetBindr", description, url: "/faq", siteName: "PetBindr", type: "article", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "Help and FAQ — PetBindr", description, images: ["/opengraph-image"] },
};

// Keep every answer true of the app as it ships today (same rule as /security).
// Don't add claims until the feature exists.

const faqs: { q: string; a: React.ReactNode }[] = [
  {
    q: "What is PetBindr?",
    a: (
      <p>
        A place for everything someone needs to care for your pet: feeding times and amounts, medications,
        allergies, vet and emergency contacts, and your pet&rsquo;s routine. It replaces the printed binder
        or long text message you leave when you hand your pet off. It works for dogs, cats, rabbits, birds,
        fish, and other pets.
      </p>
    ),
  },
  {
    q: "Is it free?",
    a: <p>Yes. Making a binder for your pet is free.</p>,
  },
  {
    q: "Where can I use it?",
    a: (
      <p>
        On iPhone, and on the web at{" "}
        <Link href="/app" className="underline text-[var(--bindr-navy)]">petbindr.com/app</Link>, which works on Android and
        computers too. The iPhone app isn&rsquo;t out yet;{" "}
        <Link href="/#get-notified" className="underline text-[var(--bindr-navy)]">join the waitlist</Link> and we&rsquo;ll email you when it is.
      </p>
    ),
  },
  {
    q: "How do I share my pet with a sitter?",
    a: (
      <>
        <p>
          Open your pet, tap <strong>Share</strong>, and choose what the sitter can see (for example feeding and
          medications, but not your home access codes). You can set a start and end date. <strong>Preview as sitter</strong>{" "}
          shows you their screen before you send anything.
        </p>
        <p>
          If your sitter already uses PetBindr, they get the invite in the app. If not, we email them an invite.
        </p>
      </>
    ),
  },
  {
    q: "My sitter doesn't want to install anything. What now?",
    a: (
      <p>
        Make a <strong>sitter link</strong>. It&rsquo;s a web page they open in any browser, with no account.
        They can see what you shared, check off feedings and medications, and send you a note and photos
        during the visit. The link stops working when the visit ends, and you can turn it off at any time.
      </p>
    ),
  },
  {
    q: "What happens when the sit ends?",
    a: (
      <p>
        Access ends on the end date you chose. The sitter no longer sees your pet. You can also stop sharing
        yourself at any moment from your pet&rsquo;s sharing list.
      </p>
    ),
  },
  {
    q: "Who else can I add?",
    a: (
      <p>
        A partner or family member can be a <strong>co-owner</strong>, so you both keep the same binder up to date. Use{" "}
        <strong>Co-owners</strong> on your pet and enter their email. They accept in the app or at petbindr.com/app,
        signed in with that email.
      </p>
    ),
  },
  {
    q: "Will it remind me about feedings and medications?",
    a: (
      <p>
        Yes. On iPhone you get a reminder when a feeding or dose is due. If a medication or meal hasn&rsquo;t been
        checked off, the owners are alerted so nothing is missed. Check-offs also show who gave it and when.
      </p>
    ),
  },
  {
    q: "Can I print it?",
    a: (
      <p>
        Yes. The <strong>Quick Reference</strong> is a one-page sheet for the fridge or a sitter, with a QR code
        that opens the live version. You can also make a <strong>Lost Pet poster</strong>, a vet authorization
        letter, a health summary, and a full record as PDFs. The printed copy shows the date it was made, so
        check the app for the latest.
      </p>
    ),
  },
  {
    q: "My pet passed away. Can I keep their record?",
    a: <p>Yes. You can mark a pet as passed, and their record is kept in a memorial section on your Home screen.</p>,
  },
  {
    q: "I forgot my password.",
    a: (
      <p>
        On the sign-in screen, tap <strong>Forgot password</strong>. We email you a link to choose a new one. Nothing
        arriving? Check your spam folder, then write to us.
      </p>
    ),
  },
  {
    q: "How do I delete my account and data?",
    a: (
      <p>
        In the app, go to your account menu and choose <strong>Delete Account</strong>. It deletes your pets, records,
        photos and sign-in. If you&rsquo;d rather we do it, email{" "}
        <a href="mailto:hello@petbindr.com" className="underline text-[var(--bindr-navy)]">hello@petbindr.com</a>. More in the{" "}
        <Link href="/privacy" className="underline text-[var(--bindr-navy)]">privacy policy</Link> and{" "}
        <Link href="/security" className="underline text-[var(--bindr-navy)]">how we protect your info</Link>.
      </p>
    ),
  },
  {
    q: "Something isn't working, or I have an idea.",
    a: (
      <p>
        Email{" "}
        <a href="mailto:hello@petbindr.com?subject=PetBindr%20help" className="underline text-[var(--bindr-navy)]">hello@petbindr.com</a>.
        A real person reads it. Tell us what you tapped and what you expected; a screenshot helps.
      </p>
    ),
  },
];

export default function FaqPage() {
  return (
    <main style={{ background: "var(--warm-cream)", minHeight: "100vh" }} className="px-6 md:px-12 py-16">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: textOf(f.a).replace(/\s+/g, " ").trim() },
        })),
      }} />
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="font-inter text-[var(--slate-gray)] hover:text-[var(--bindr-navy)] transition-colors mb-10 inline-block"
          style={{ fontSize: "14px" }}
        >
          ← Back to PetBindr
        </Link>

        <h1 className="font-fraunces font-semibold text-[var(--bindr-navy)] mb-4" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>
          Help and FAQ
        </h1>
        <p className="font-inter text-[var(--charcoal)] leading-relaxed mb-12" style={{ fontSize: "18px" }}>
          Quick answers, in plain words. Can&rsquo;t find yours? Email{" "}
          <a href="mailto:hello@petbindr.com?subject=PetBindr%20help" className="underline text-[var(--bindr-navy)]">hello@petbindr.com</a>.
        </p>

        <div className="space-y-10">
          {faqs.map((f) => (
            <section key={f.q}>
              <h2 className="font-fraunces font-semibold text-[var(--bindr-navy)] mb-3" style={{ fontSize: "22px" }}>
                {f.q}
              </h2>
              <div className="font-inter text-[var(--charcoal)] leading-relaxed space-y-4" style={{ fontSize: "16px" }}>
                {f.a}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
