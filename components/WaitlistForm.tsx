"use client";

import { useState } from "react";

interface WaitlistFormProps {
  variant?: "light" | "dark";
}

export default function WaitlistForm({ variant = "light" }: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  // Honeypot: hidden from people; bots that fill every field fill it too
  const [website, setWebsite] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...(website ? { website } : {}) }),
      });
      const data = await res.json();
      if (res.ok) {
        // Same reply whether or not the address was already on the list (so the
        // page can't be used to check someone's email); the email says which
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div role="status" className="rounded-xl border border-[var(--success-green)] bg-[#4FAE7C1F] px-7 py-5 max-w-lg text-[var(--success-green)] font-semibold text-base font-inter">
        Thanks! Check your email: we&rsquo;ve sent you a note about your spot on the list.
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
          <p className="mt-2 text-sm text-[var(--error-red)] font-inter">{errorMsg}</p>
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
        early access, in-app badge, and locked-in best pricing forever.
      </p>
    </div>
  );
}
