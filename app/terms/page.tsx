import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — PetBindr",
  description: "The rules for using PetBindr: your account, sharing with sitters, what PetBindr is and isn't, and our responsibilities.",
};

// Plain-English terms for the PetBindr iOS app and petbindr.com. Every statement
// must be true of the app and website as they ship (see PetBindr/NOTES.md and
// the privacy page). Not legal advice: have it reviewed before launch, and add
// subscription terms (price, renewal, cancellation) before any paid feature ships.

const LAST_UPDATED = "November 8, 2026";

const link = "text-[var(--bindr-navy)] underline";

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "The short version",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>PetBindr helps you keep track of your pets&rsquo; care and share it with the people who help you.</li>
        <li>What you put in is yours. We use it only to run PetBindr, as described in our <Link href="/privacy" className={link}>Privacy Policy</Link>.</li>
        <li>PetBindr is not a vet. In an emergency, call your vet or an emergency clinic.</li>
        <li>Reminders and notifications help, but they can be late or missed. Don&rsquo;t rely on them alone for medication or other critical care.</li>
        <li>You choose who you share with and what they see, including your home access details. Share only with people you trust.</li>
      </ul>
    ),
  },
  {
    title: "Who we are and what these terms cover",
    body: (
      <>
        <p>
          PetBindr is run by PetBindr LLC, a Kentucky company (&ldquo;PetBindr&rdquo;, &ldquo;we&rdquo;,
          &ldquo;us&rdquo;). These terms cover the PetBindr iOS app, the petbindr.com website, and
          sitter links (pages at petbindr.com that show a pet&rsquo;s care information to someone
          without the app).
        </p>
        <p>
          By creating an account, using the app, or opening a sitter link, you agree to these terms
          and to our <Link href="/privacy" className={link}>Privacy Policy</Link>. If you don&rsquo;t
          agree, please don&rsquo;t use PetBindr.
        </p>
      </>
    ),
  },
  {
    title: "Your account",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>You must be at least 13 years old to use PetBindr.</li>
        <li>Give us an email address you can receive mail at, and keep your password to yourself. You&rsquo;re responsible for what happens in your account.</li>
        <li>If you think someone else has gotten into your account, change your password and email <a href="mailto:hello@petbindr.com" className={link}>hello@petbindr.com</a>.</li>
        <li>You can delete your account at any time in the app (Account &rarr; Delete Account). That deletes your pets, records, photos, and home information, and ends the access of everyone you shared with.</li>
      </ul>
    ),
  },
  {
    title: "What PetBindr is, and isn't",
    body: (
      <>
        <p>
          PetBindr is a place to record and share your pets&rsquo; care: feeding, medications,
          health records, vets and contacts, routines, and the details someone needs to look after
          your pets and your home.
        </p>
        <p>
          <strong>Not veterinary advice.</strong> PetBindr doesn&rsquo;t diagnose, treat, or give
          medical advice. Suggestions in the app, such as starter reminders, are general starting
          points, not recommendations for your pet. Follow your vet&rsquo;s instructions, and in an
          emergency contact your vet or an emergency clinic right away.
        </p>
        <p>
          <strong>Reminders aren&rsquo;t guaranteed.</strong> Reminders, missed-dose alerts, and
          check-off notifications depend on your phone, your settings, internet connections, and
          services we don&rsquo;t control, so they can arrive late or not at all. They&rsquo;re a
          backup, not a replacement for your own plan, especially for medications.
        </p>
        <p>
          <strong>Not a sitter service.</strong> PetBindr doesn&rsquo;t find, screen, employ, or
          vouch for pet sitters, walkers, or anyone else you share with, and we aren&rsquo;t part of
          any arrangement between you and them, including payments you record in the app. Those are
          between you and the people you choose.
        </p>
      </>
    ),
  },
  {
    title: "Sharing with sitters, family, and co-owners",
    body: (
      <>
        <p>
          <strong>If you share:</strong> you decide who gets access and what they can see. You&rsquo;re
          responsible for choosing people you trust, especially before turning on home access (alarm
          and lockbox codes, Wi-Fi, key locations). You can change or end anyone&rsquo;s access at any
          time, and it takes effect right away in the app.
        </p>
        <p>
          <strong>Sitter links</strong> let someone see your pets&rsquo; care information in a web
          browser without an account. Anyone who has the link can open it until it ends, so send it
          only to the person caring for your pets. Every link has an end date (at most 30 days), you
          can turn it off at any time, and home access details are never shown on a link.
        </p>
        <p>
          <strong>If someone shares with you:</strong> use what you see only to care for their pets
          and home, keep it private, and don&rsquo;t copy or pass it on. When your access ends,
          stop using any details you remember or wrote down, like door codes. Check-offs, updates,
          and photos you add are shared with the owner.
        </p>
      </>
    ),
  },
  {
    title: "Your content",
    body: (
      <>
        <p>
          You own what you add to PetBindr: pet information, photos, documents, notes, and updates.
          So that PetBindr can work, you give us permission to store, process, and display it to you
          and to the people you share it with, and to make copies needed to run and back up the
          service. This permission ends when you delete the content or your account, except for
          backups that expire on their own schedule and anything we must keep by law.
        </p>
        <p>
          Only add things you have the right to add. If you add other people&rsquo;s details, such as
          emergency contacts or a vet&rsquo;s number, make sure they&rsquo;d expect it.
        </p>
      </>
    ),
  },
  {
    title: "Acceptable use",
    body: (
      <>
        <p>Please don&rsquo;t:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Use PetBindr to harass, spam, or harm anyone, including by sending invites to people who don&rsquo;t want them.</li>
          <li>Upload anything illegal, or anything you don&rsquo;t have the right to share.</li>
          <li>Try to get into accounts, pets, or links that aren&rsquo;t shared with you, or get around who-can-see-what controls.</li>
          <li>Interfere with PetBindr, overload it, or copy it with automated tools.</li>
        </ul>
        <p>
          We may remove content or suspend an account that breaks these rules or puts others at risk.
          Where it&rsquo;s safe to, we&rsquo;ll tell you why first.
        </p>
      </>
    ),
  },
  {
    title: "Paid features",
    body: (
      <>
        <p>
          PetBindr is free right now. If we add paid features, we&rsquo;ll show the price, what you
          get, and how renewal and cancellation work before you buy, and these terms will be updated
          with the details.
        </p>
        <p>
          <strong>Waitlist and Founding Members.</strong> Joining the waitlist isn&rsquo;t a
          purchase and doesn&rsquo;t guarantee particular features or availability. Founding Member
          benefits will be described in the app when paid features launch.
        </p>
      </>
    ),
  },
  {
    title: "Our responsibilities and their limits",
    body: (
      <>
        <p>
          We work hard to keep PetBindr running, accurate, and secure, and we back up our database
          every day. Still, PetBindr is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;:
          to the extent the law allows, we don&rsquo;t promise it will always be available, error-free,
          or that information in it (including what other people enter) is correct.
        </p>
        <p>
          To the extent the law allows, PetBindr LLC isn&rsquo;t liable for indirect or consequential
          losses, or for harm that comes from relying on reminders, from the actions of people you
          share with, or from information entered by you or others. Our total liability for any claim
          about PetBindr is limited to the greater of the amount you paid us in the 12 months before
          the claim, or $50. Some places don&rsquo;t allow these limits, so they may not all apply to
          you.
        </p>
        <p>
          You agree to cover PetBindr LLC&rsquo;s reasonable costs if a claim against us arises from
          content you added or from your breaking these terms.
        </p>
      </>
    ),
  },
  {
    title: "The iOS app and Apple",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>These terms are between you and PetBindr LLC, not Apple. PetBindr LLC, not Apple, is responsible for the app and its content.</li>
        <li>Apple has no obligation to provide maintenance or support for the app. For help, email <a href="mailto:hello@petbindr.com" className={link}>hello@petbindr.com</a>.</li>
        <li>Questions or claims about the app (including product, legal, or intellectual property claims) should come to us, not Apple. If the app fails to meet a warranty that applies by law, you may notify Apple, and Apple may refund the app&rsquo;s purchase price, if any; Apple has no other warranty obligation.</li>
        <li>You confirm that you&rsquo;re not in a country under U.S. government embargo and not on a U.S. government list of prohibited or restricted parties.</li>
        <li>Apple and its subsidiaries are third-party beneficiaries of these terms and may enforce them against you.</li>
        <li>Your use of the app also has to follow the App Store&rsquo;s terms.</li>
      </ul>
    ),
  },
  {
    title: "Ending your use",
    body: (
      <p>
        You can stop using PetBindr and delete your account at any time. We may suspend or end
        accounts that break these terms, and we may change or stop parts of PetBindr. If we ever
        shut PetBindr down, we&rsquo;ll give you notice and a way to export your information first
        (Account &rarr; Export My Data in the app).
      </p>
    ),
  },
  {
    title: "Changes to these terms",
    body: (
      <p>
        If we make a significant change, we&rsquo;ll tell you in the app or by email before it takes
        effect. Continuing to use PetBindr after that means you accept the new terms. The date at the
        top shows when these terms last changed.
      </p>
    ),
  },
  {
    title: "Governing law",
    body: (
      <p>
        These terms are governed by the laws of the Commonwealth of Kentucky, USA, except where the
        law where you live gives you rights that can&rsquo;t be changed by agreement. If there&rsquo;s
        a problem, please email us first; most things can be sorted out quickly.
      </p>
    ),
  },
  {
    title: "Contact",
    body: (
      <p>
        PetBindr LLC &middot;{" "}
        <a href="mailto:hello@petbindr.com" className={link}>hello@petbindr.com</a>
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <main
      style={{ background: "var(--warm-cream)", minHeight: "100vh" }}
      className="px-6 md:px-12 py-16"
    >
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="font-inter text-[var(--slate-gray)] hover:text-[var(--bindr-navy)] transition-colors mb-10 inline-block"
          style={{ fontSize: "14px" }}
        >
          ← Back to PetBindr
        </Link>

        <h1
          className="font-fraunces font-semibold text-[var(--bindr-navy)] mb-3"
          style={{ fontSize: "clamp(28px, 4vw, 40px)" }}
        >
          Terms of Service
        </h1>

        <p className="font-inter text-[var(--slate-gray)] text-sm mb-12">
          Last updated: {LAST_UPDATED}
        </p>

        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2
                className="font-fraunces font-semibold text-[var(--bindr-navy)] mb-3"
                style={{ fontSize: "22px" }}
              >
                {section.title}
              </h2>
              <div
                className="font-inter text-[var(--charcoal)] leading-relaxed space-y-4"
                style={{ fontSize: "16px" }}
              >
                {section.body}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
