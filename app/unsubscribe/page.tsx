import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unsubscribe — PetBindr",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ e?: string; t?: string; status?: string }> };

export default async function UnsubscribePage({ searchParams }: Props) {
  const { e = "", t = "", status } = await searchParams;

  let heading = "Unsubscribe from PetBindr emails";
  let message: React.ReactNode = (
    <>
      Stop launch and product update emails to <strong>{e}</strong>? You&rsquo;ll still get
      emails you need for your account, like password resets and pet sharing invites.
    </>
  );
  let showButton = Boolean(e && t);

  if (status === "done") {
    heading = "You're unsubscribed";
    message = "You won't get launch or product update emails from us anymore. Sorry to see you go.";
    showButton = false;
  } else if (status === "invalid" || (!status && !showButton)) {
    heading = "That link didn't work";
    message = (
      <>
        The link may be incomplete. Email{" "}
        <a href="mailto:hello@petbindr.com?subject=unsubscribe" className="text-[var(--bindr-navy)] underline">
          hello@petbindr.com
        </a>{" "}
        and we&rsquo;ll take you off the list.
      </>
    );
    showButton = false;
  }

  return (
    <main style={{ background: "var(--warm-cream)", minHeight: "100vh" }} className="px-6 md:px-12 py-16">
      <div className="max-w-xl mx-auto">
        <Link
          href="/"
          className="font-inter text-[var(--slate-gray)] hover:text-[var(--bindr-navy)] transition-colors mb-10 inline-block"
          style={{ fontSize: "14px" }}
        >
          ← Back to PetBindr
        </Link>

        <h1
          className="font-fraunces font-semibold text-[var(--bindr-navy)] mb-4"
          style={{ fontSize: "clamp(26px, 4vw, 36px)" }}
        >
          {heading}
        </h1>

        <p className="font-inter text-[var(--charcoal)] leading-relaxed mb-8" style={{ fontSize: "16px" }}>
          {message}
        </p>

        {showButton && (
          <form method="POST" action="/api/unsubscribe">
            <input type="hidden" name="e" value={e} />
            <input type="hidden" name="t" value={t} />
            <input type="hidden" name="source" value="page" />
            <button type="submit" className="btn-coral">
              Unsubscribe
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
