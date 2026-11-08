import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How We Protect Your Info — PetBindr",
  description:
    "Who can see your pet's info and your home access codes in PetBindr, how sharing ends, and how to turn it off.",
};

// Keep every statement here true of the app as it ships today.
// Don't add claims (e.g. "encrypted codes") until they exist.
// Photos: true since 2026-11-06 (SDK loading + removeDownloadTokens + one-time token cleanup).
// Recently Viewed: true since 2026-11-06 (getSharedHousehold logs to households/{uid}/accessLog;
// rules: owner read only, no client writes).

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "You decide who sees what",
    body: (
      <>
        <p>
          Nothing you put in PetBindr is shared until you invite someone. When you do, you pick
          what they can see: a pet sitter, a walker, family, or exactly the items you choose.
          Before you send the invite, <strong>Preview as sitter</strong> shows you their screen.
        </p>
        <p>
          Each person only sees the pets you shared with them, and only the parts you turned on.
        </p>
      </>
    ),
  },
  {
    title: "Your home access codes are opt-in",
    body: (
      <>
        <p>
          Your alarm code, lockbox, gate code, and Wi-Fi are hidden from everyone by default.
          They&rsquo;re only shown to someone if you switch on <strong>Home access</strong> for
          them, on purpose, for that person.
        </p>
        <p>
          On the Property Information screen, <strong>Who Can See This</strong> lists everyone
          who currently has your codes, with a <strong>Turn Off</strong> button next to each
          person and a <strong>Turn Off for Everyone</strong> button.
        </p>
        <p>
          The same screen shows <strong>Recently Viewed</strong>: each time someone you&rsquo;ve
          shared with opens your home info, it&rsquo;s recorded there with their name and the
          time. Only you can see this list, and no one you&rsquo;ve shared with can change or
          delete it.
        </p>
      </>
    ),
  },
  {
    title: "Access ends when the sit ends",
    body: (
      <>
        <p>
          When you share with an end date, access stops automatically within about 15 minutes of
          that date. You
          don&rsquo;t need to remember to do anything, and it doesn&rsquo;t depend on anyone
          having the app open.
        </p>
        <p>
          You can also change what someone sees, or remove them completely, at any time from{" "}
          <strong>Sharing &amp; Sits</strong>. Changes take effect right away.
        </p>
      </>
    ),
  },
  {
    title: "Checked on our servers, not just in the app",
    body: (
      <>
        <p>
          Who can see what isn&rsquo;t just hidden in the app. Our database checks permissions on
          every request, so someone without access can&rsquo;t read your pet&rsquo;s records or
          your home codes, even with a modified app.
        </p>
        <p>
          Pet photos, diary and sit-update photos, and health documents are protected the same
          way. There are no public links to them, so once someone&rsquo;s access ends, they
          can&rsquo;t keep opening your photos, even from a link they saved.
        </p>
      </>
    ),
  },
  {
    title: "Where your information lives",
    body: (
      <>
        <p>
          PetBindr runs on Google Firebase. Your information is encrypted while it travels
          between your phone and our servers, and Google encrypts it when it&rsquo;s stored.
        </p>
      </>
    ),
  },
  {
    title: "What we don't do",
    body: (
      <>
        <p>We don&rsquo;t sell your information, and we don&rsquo;t track you for advertising.</p>
      </>
    ),
  },
  {
    title: "Questions or concerns",
    body: (
      <>
        <p>
          If something doesn&rsquo;t look right, or you&rsquo;d like your account and information
          deleted, email{" "}
          <a href="mailto:hello@petbindr.com" className="text-[var(--bindr-navy)] underline">
            hello@petbindr.com
          </a>
          . A real person reads every message. See also our{" "}
          <Link href="/privacy" className="text-[var(--bindr-navy)] underline">
            Privacy Policy
          </Link>
          .
        </p>
      </>
    ),
  },
];

export default function SecurityPage() {
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
          className="font-fraunces font-semibold text-[var(--bindr-navy)] mb-4"
          style={{ fontSize: "clamp(28px, 4vw, 40px)" }}
        >
          How we protect your info
        </h1>

        <p
          className="font-inter text-[var(--charcoal)] leading-relaxed mb-12"
          style={{ fontSize: "18px" }}
        >
          You&rsquo;re trusting us with your pet&rsquo;s care, and sometimes the keys to your home.
          Here&rsquo;s exactly who can see what, in plain language.
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
