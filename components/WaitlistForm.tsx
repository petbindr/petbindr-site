"use client";

import { useEffect, useState } from "react";
import { track } from "@vercel/analytics";
import { signupSource } from "@/lib/signupSource";

interface WaitlistFormProps {
  variant?: "light" | "dark";
}

export default function WaitlistForm({ variant = "light" }: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  // Honeypot: hidden from people; bots that fill every field fill it too
  const [website, setWebsite] = useState("");
  // This address's referral link (?ref=<code>) from the reply, for "Know someone…"
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => { setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"); }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      track("referral_link_copied");
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard blocked: the link is on screen to select by hand */ }
  }

  async function shareLink() {
    try {
      await navigator.share({
        title: "PetBindr",
        text: "PetBindr keeps your pet's care, meds and vet info in one place, and hands it to your sitter. Join the waitlist:",
        url: shareUrl,
      });
      track("referral_link_shared");
    } catch { /* cancelled */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Where this visit came from (utm_* tags, referring site), if known
        body: JSON.stringify({ email, ...signupSource(), ...(website ? { website } : {}) }),
      });
      const data = await res.json();
      if (res.ok) {
        // Same reply whether or not the address was already on the list (so the
        // page can't be used to check someone's email); the email says which
        setStatus("success");
        setEmail("");
        if (typeof data.shareUrl === "string" && data.shareUrl.startsWith("https://petbindr.com/?ref=")) setShareUrl(data.shareUrl);
        track("waitlist_signup"); // no email or other personal data in the event
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  }

  // On the navy section the usual green and red were unreadable (2.2 to 2.5:1);
  // lighter shades there (7.9:1 and 6.6:1). 2026-11-18 review, item 19.
  const dark = variant === "dark";
  if (status === "success") {
    return (
      <div role="status" className={`rounded-xl border px-7 py-5 max-w-lg font-semibold text-base font-inter ${
        dark ? "border-[#A8E6C4] bg-[#A8E6C41F] text-[#A8E6C4]" : "border-[var(--success-green)] bg-[#2E7D561F] text-[var(--success-green)]"}`}>
        {/* True for everyone (new or already signed up), so it says nothing about the address */}
        Thanks! That address is on the list. We&rsquo;ll email you when we launch.
        {shareUrl && (
          <div className={`mt-4 pt-4 border-t font-normal ${dark ? "border-[#A8E6C455]" : "border-[#2E7D5640]"}`}>
            <p className={`font-semibold ${dark ? "text-white" : "text-[var(--bindr-navy)]"}`}>Know someone who&rsquo;d use this?</p>
            <p className={`mt-1 text-sm ${dark ? "text-[var(--soft-teal)]" : "text-[var(--slate-gray)]"}`}>
              Send them your link. It&rsquo;s also in your confirmation email.
            </p>
            <p className={`mt-2 text-sm break-all select-all ${dark ? "text-white" : "text-[var(--bindr-navy)]"}`}>{shareUrl}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={copyLink} className="btn-coral !py-2 !px-4 text-sm">
                {copied ? "Copied" : "Copy link"}
              </button>
              {canShare && (
                <button type="button" onClick={shareLink}
                  className={`rounded-[10px] border px-4 py-2 text-sm font-semibold ${dark ? "border-white text-white" : "border-[var(--bindr-navy)] text-[var(--bindr-navy)]"}`}>
                  Share…
                </button>
              )}
            </div>
            <span className="sr-only" aria-live="polite">{copied ? "Link copied" : ""}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg">
      <form onSubmit={handleSubmit} noValidate>
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", left: "-10000px", width: 1, height: 1, opacity: 0 }}
        />
        <div className="flex flex-wrap gap-2.5">
          <input
            type="email"
            className="email-input"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-label="Email address"
            aria-invalid={status === "error"}
            aria-describedby={status === "error" ? `waitlist-error-${variant ?? "light"}` : undefined}
            style={{ flexBasis: "240px" }}
          />
          <button
            type="submit"
            className="btn-coral"
            disabled={status === "loading" || !email}
          >
            {status === "loading" ? "Joining…" : "Join the waitlist"}
          </button>
        </div>
        {status === "error" && (
          // role="alert": read out when it appears (it was silent for screen readers)
          <p id={`waitlist-error-${variant ?? "light"}`} role="alert"
            className={`mt-2 text-sm font-inter ${dark ? "text-[#FFB4A8]" : "text-[var(--error-red)]"}`}>{errorMsg}</p>
        )}
      </form>
      <p
        className={`mt-3 text-sm font-medium font-inter ${
          variant === "dark"
            ? "text-[var(--soft-teal)]"
            : "text-[var(--slate-gray)]"
        }`}
      >
        Launching on iOS soon. The first 1,000 signups become Founding Members —
        early access, an in-app badge, and special Founding Member pricing when paid features arrive.
      </p>
    </div>
  );
}
