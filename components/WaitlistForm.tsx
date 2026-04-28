"use client";

import { useState } from "react";

interface WaitlistFormProps {
  variant?: "light" | "dark";
}

export default function WaitlistForm({ variant = "light" }: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "duplicate" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(data.alreadyExists ? "duplicate" : "success");
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
      <div className="rounded-xl border border-[var(--success-green)] bg-[#4FAE7C1F] px-7 py-5 max-w-lg text-[var(--success-green)] font-semibold text-base font-inter">
        You&rsquo;re on the list. Welcome, Founding Member.
      </div>
    );
  }

  if (status === "duplicate") {
    return (
      <div className="rounded-xl border border-[var(--bindr-teal)] bg-[#74C4CD1F] px-7 py-5 max-w-lg text-[var(--bindr-navy)] font-medium text-base font-inter">
        You&rsquo;re already on the list. We&rsquo;ll see you at launch.
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg">
      <form onSubmit={handleSubmit} noValidate>
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
