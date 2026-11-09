import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — PetBindr",
  description: "What PetBindr collects, why, who it's shared with, and your choices.",
};

// Keep in sync with PetBindr/APP_PRIVACY.md (App Store answers) and
// PetBindr/PetBindr/PrivacyInfo.xcprivacy. Every statement must be true of the
// app and website as they ship. Not legal advice: have it reviewed before launch.

const LAST_UPDATED = "November 8, 2026";

const link = "text-[var(--bindr-navy)] underline";

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "The short version",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>We collect what you put into PetBindr so we can show it to you and the people you choose to share with.</li>
        <li>We don&rsquo;t sell your information, and we don&rsquo;t use it to track you for advertising.</li>
        <li>You control who sees your pets&rsquo; information and your home access details, and you can turn sharing off at any time.</li>
        <li>You can ask us to delete your information by emailing <a href="mailto:hello@petbindr.com" className={link}>hello@petbindr.com</a>.</li>
      </ul>
    ),
  },
  {
    title: "Who we are",
    body: (
      <p>
        PetBindr is run by PetBindr LLC, a Kentucky company (&ldquo;PetBindr&rdquo;, &ldquo;we&rdquo;,
        &ldquo;us&rdquo;). This policy covers the PetBindr iOS app and the petbindr.com website.
      </p>
    ),
  },
  {
    title: "What we collect",
    body: (
      <>
        <p><strong>Your account.</strong> Your name, email address, and password (stored by our sign-in provider; we never see it). Optionally, a profile photo.</p>
        <p>
          <strong>What you add about your pets and home.</strong> Pet profiles and photos, feeding
          and medication schedules, health records, vet and groomer details, notes, diary entries,
          routines, and, if you choose to add them, home access details such as alarm and lockbox
          codes and Wi-Fi. If you add emergency contacts or vet details, that includes other
          people&rsquo;s names and phone numbers; please only add people who&rsquo;d expect it.
        </p>
        <p>
          <strong>Sharing and sits.</strong> Who you&rsquo;ve invited (their email address), what
          you&rsquo;ve allowed them to see, dates, check-offs (&ldquo;fed&rdquo;, &ldquo;medication
          given&rdquo;), and updates or photos sitters post.
        </p>
        <p>
          <strong>Technical information.</strong> An account ID; app and device identifiers used for
          analytics, crash reports, and notifications; a notification token if you allow
          notifications; and your time zone, so reminders and missed-dose alerts arrive at the right
          time.
        </p>
        <p>
          <strong>How the app is used.</strong> A small set of events, such as &ldquo;signed
          up&rdquo;, &ldquo;added a pet&rdquo;, &ldquo;sent an invite&rdquo;, or &ldquo;checked off a
          task&rdquo;, so we can see which features help. These events don&rsquo;t include your
          pets&rsquo; names, notes, or contact details.
        </p>
        <p><strong>Crash reports.</strong> If the app crashes, technical details about the crash.</p>
        <p>
          <strong>Website and waitlist.</strong> If you join the waitlist, your email address.
        </p>
        <p>
          <strong>What we don&rsquo;t collect.</strong> The &ldquo;find a vet nearby&rdquo; search
          uses your location on your phone through Apple Maps; we don&rsquo;t receive or store your
          location. We don&rsquo;t collect payment information.
        </p>
      </>
    ),
  },
  {
    title: "How we use it",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>To run PetBindr: store your information, show it to you, and show the parts you choose to the people you share with.</li>
        <li>To send the emails and notifications you&rsquo;d expect: invites, account verification and password resets, reminders, check-off updates, and missed-dose alerts. You can turn notifications off in the app or in iPhone Settings.</li>
        <li>To keep PetBindr working and secure: fix crashes, prevent abuse, and enforce who can see what.</li>
        <li>To improve PetBindr, using the usage events and crash reports described above.</li>
        <li>For the waitlist: to email you about the launch and occasional product updates. Every one has an unsubscribe link, or you can write to <a href="mailto:hello@petbindr.com" className={link}>hello@petbindr.com</a>.</li>
      </ul>
    ),
  },
  {
    title: "Who we share it with",
    body: (
      <>
        <p>
          <strong>People you choose.</strong> When you share a pet, the person you invite sees only
          what you allowed. Your home access details are shown only to people you turn on
          &ldquo;Home access&rdquo; for. See{" "}
          <Link href="/security" className={link}>How we protect your info</Link>.
        </p>
        <p>
          <strong>Service providers</strong> who run parts of PetBindr for us and may only use your
          information to provide that service:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Google Firebase</strong> (Google LLC): sign-in, database, photo storage, notifications, analytics, and crash reporting.</li>
          <li><strong>Resend</strong>: sending our emails.</li>
          <li><strong>Vercel</strong>: hosting the petbindr.com website.</li>
          <li><strong>Apple</strong>: delivering notifications to your iPhone.</li>
        </ul>
        <p>
          <strong>Legal reasons.</strong> If required by law, or to protect someone&rsquo;s safety.
        </p>
        <p>
          <strong>If PetBindr changes hands.</strong> If PetBindr is sold or merged, your
          information may transfer to the new owner, who must keep this policy&rsquo;s promises or
          tell you first.
        </p>
        <p>We don&rsquo;t sell your information or share it for advertising.</p>
      </>
    ),
  },
  {
    title: "How long we keep it",
    body: (
      <p>
        We keep your information while you have an account. When people you shared with lose
        access, because you turned it off or the end date passed, they can no longer see your
        information. Deleting your account in the app removes your information right away; if you
        ask us by email instead, we&rsquo;ll delete it within 30 days. Our database is backed up
        daily and each backup is kept for 14 days, so deleted information is fully gone from backups
        within 14 days. We keep something longer only where the law requires it. Waitlist emails are
        kept until you unsubscribe or ask us to remove them.
      </p>
    ),
  },
  {
    title: "Your choices",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li><strong>Sharing:</strong> change or remove anyone&rsquo;s access at any time in Sharing &amp; Sits, and turn home access off for anyone on the Property Information screen.</li>
        <li><strong>Notifications:</strong> turn them off in the app&rsquo;s Notification Settings or in iPhone Settings.</li>
        <li><strong>Your information:</strong> view and edit it in the app. To get a copy, use Account &rarr; Export My Data. To delete everything, use Account &rarr; Delete Account: it deletes your account, pets, records, photos, home information, and reminders, and ends access for everyone you shared with. Check-offs and updates you made on other people&rsquo;s pets stay with those pets. You can also email <a href="mailto:hello@petbindr.com" className={link}>hello@petbindr.com</a> for either.</li>
        <li>Depending on where you live, you may have additional rights to access, correct, or delete your information, or to object to how it&rsquo;s used. Email us and we&rsquo;ll help.</li>
      </ul>
    ),
  },
  {
    title: "Security",
    body: (
      <p>
        Your information is encrypted in transit and when stored, and our database checks
        permissions on every request. No system is perfect, but we take this seriously. Details
        are on <Link href="/security" className={link}>How we protect your info</Link>. If you think
        something&rsquo;s wrong, email us right away.
      </p>
    ),
  },
  {
    title: "Children",
    body: (
      <p>
        PetBindr isn&rsquo;t meant for children under 13, and we don&rsquo;t knowingly collect their
        information. If you think a child has signed up, email us and we&rsquo;ll delete the account.
      </p>
    ),
  },
  {
    title: "Where your information is stored",
    body: (
      <p>
        PetBindr is based in the United States, and your information is stored on servers in the
        United States.
      </p>
    ),
  },
  {
    title: "Changes to this policy",
    body: (
      <p>
        If we make a significant change, we&rsquo;ll tell you in the app or by email before it takes
        effect. The date at the top shows when this policy last changed.
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

export default function PrivacyPage() {
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
          Privacy Policy
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
