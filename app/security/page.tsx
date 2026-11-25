import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How We Protect Your Info — PetBindr",
  description: "Who can see your pet's info and your home access codes in PetBindr, how sharing ends, and how to turn it off.",
  // Its own link preview and address (shared links showed the homepage's;
  // 2026-11-18 review, item 21)
  alternates: { canonical: "/security" },
  openGraph: { title: "How We Protect Your Info — PetBindr", description: "Who can see your pet's info and your home access codes in PetBindr, how sharing ends, and how to turn it off.", url: "/security", siteName: "PetBindr", type: "article", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "How We Protect Your Info — PetBindr", description: "Who can see your pet's info and your home access codes in PetBindr, how sharing ends, and how to turn it off." , images: ["/opengraph-image"] },
};

// Keep every statement here true of the app as it ships today.
// Don't add claims until they exist.
// Encrypted home codes: true since 2026-11-13 (HOME_INFO_KEY; lock-home-info.js run on live data).
// Photos: true since 2026-11-06 (SDK loading + removeDownloadTokens + one-time token cleanup).
// Recently Viewed: true since 2026-11-06 (getSharedHousehold logs to households/{uid}/accessLog;
// rules: owner read only, no client writes).
// Links (2026-11-24): LINK_FORCED_OFF in functions/src/links.js (no home codes, no editing, no
// sits); helperPermissions (feedings + allergies only); SITTER_LINK_MAX_DAYS 30; helper end date
// optional; opens logged on the share (openCount, recentOpens with device). Delete Account in the
// app (Settings) and on petbindr.com/app (AccountCard) deletes links too (functions/src/account.js).

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
          On the Home Access screen, <strong>Who Can See This</strong> lists everyone
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
    title: "Links: what they can and can\u2019t see",
    body: (
      <>
        <p>
          A link lets someone open your pet&rsquo;s care page in a web browser, with no account
          or app. Anyone who has the link can open it, so send it only to the person it&rsquo;s
          for, and turn it off if it ends up somewhere it shouldn&rsquo;t.
        </p>
        <p>
          A <strong>sitter link</strong> shows only what you turned on when you made it, and it
          always has an end date, at most 30 days away. A <strong>helper link</strong> (for a
          kid, roommate or neighbor who feeds your pet) shows only feedings and allergies. It
          keeps working until you turn it off, or until the end date you set, if you set one.
        </p>
        <p>
          No link ever shows your home access codes, and no one can use a link to change your
          pet&rsquo;s records or plan sits. On a link, people can check off feedings and doses you
          shared, and a sitter can send you a note or photos.
        </p>
        <p>
          Each time a link is opened, it&rsquo;s logged: <strong>Sharing &amp; Sits</strong> shows
          how many times, when it was last opened, and on what kind of device. To stop a link,
          tap it there and turn it off. It stops working right away.
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
        <p>
          Your home access codes get an extra lock: they&rsquo;re stored encrypted with a key only
          our server holds, so even someone looking at the database sees gibberish.
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
    title: "Deleting your account, and questions",
    body: (
      <>
        <p>
          You can delete your account and everything in it yourself, any time: in the app under{" "}
          <strong>Account &rarr; Delete Account</strong>, or on{" "}
          <Link href="/app" className="text-(--bindr-navy) underline">
            petbindr.com/app
          </Link>{" "}
          under <strong>Your account</strong>. That also turns off every link and share you made.
        </p>
        <p>
          If something doesn&rsquo;t look right, or you&rsquo;d like help with anything, email{" "}
          <a href="mailto:hello@petbindr.com" className="text-(--bindr-navy) underline">
            hello@petbindr.com
          </a>
          . A real person reads every message. See also our{" "}
          <Link href="/privacy" className="text-(--bindr-navy) underline">
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
          className="font-inter text-(--slate-gray) hover:text-(--bindr-navy) transition-colors mb-10 inline-block"
          style={{ fontSize: "14px" }}
        >
          ← Back to PetBindr
        </Link>

        <h1
          className="font-fraunces font-semibold text-(--bindr-navy) mb-4"
          style={{ fontSize: "clamp(28px, 4vw, 40px)" }}
        >
          How we protect your info
        </h1>

        <p
          className="font-inter text-(--charcoal) leading-relaxed mb-12"
          style={{ fontSize: "18px" }}
        >
          You&rsquo;re trusting us with your pet&rsquo;s care, and sometimes the keys to your home.
          Here&rsquo;s exactly who can see what, in plain language.
        </p>

        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2
                className="font-fraunces font-semibold text-(--bindr-navy) mb-3"
                style={{ fontSize: "22px" }}
              >
                {section.title}
              </h2>
              <div
                className="font-inter text-(--charcoal) leading-relaxed space-y-4"
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
