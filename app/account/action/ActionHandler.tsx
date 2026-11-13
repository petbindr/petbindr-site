"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// Talks to Firebase Auth's REST API directly (the same calls Firebase's own
// action page makes), using the project's public web API key from the link.
const IDENTITY_TOOLKIT = "https://identitytoolkit.googleapis.com/v1";
const FIREBASE_DEFAULT_HANDLER = "https://petbindr-2d4bd.firebaseapp.com/__/auth/action";
const MIN_PASSWORD_LENGTH = 6; // same as the app (SignUpView / ChangePasswordView)

type State =
  | { kind: "working"; text: string }
  | { kind: "resetForm"; email: string }
  | { kind: "done"; heading: string; text: string }
  | { kind: "error"; heading: string; text: string };

// Same key as app/app/firebase.ts (WEB_API_KEY)
const PETBINDR_WEB_API_KEY = "AIzaSyC-Yc92DGkgvm9X63WhEQViyyIpYvgDyzE";

async function callAuth(endpoint: string, apiKey: string, body: Record<string, string>) {
  const res = await fetch(`${IDENTITY_TOOLKIT}/${endpoint}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = String(json?.error?.message || "UNKNOWN").split(" ")[0].split(":")[0];
    throw new Error(code);
  }
  return json;
}

function friendlyLinkError(code: string, mode: string) {
  if (code === "EXPIRED_OOB_CODE" || code === "INVALID_OOB_CODE") {
    return mode === "verifyEmail"
      ? "This link has expired or was already used. If the app still says your email isn't verified, open Account in the PetBindr app and send a new verification email."
      : "This link has expired or was already used. Open the PetBindr app, tap Forgot password? on the sign-in screen, and we'll email you a new one.";
  }
  if (code === "USER_DISABLED") return "This account has been turned off. Email hello@petbindr.com if you think that's a mistake.";
  if (code === "USER_NOT_FOUND") return "We couldn't find this account. It may have been deleted.";
  return "Something went wrong on our end. Please try the link again in a minute.";
}

export default function ActionHandler() {
  const params = useSearchParams();
  const mode = params.get("mode") || "";
  const oobCode = params.get("oobCode") || "";
  // Always PetBindr's own (public) web key, never the one in the link: a link made
  // in someone else's Firebase project, carrying their key, would otherwise show
  // "Choose a new password for you@…" on petbindr.com and send the password there.
  // The one-time code works with any of this project's keys.
  const apiKey = PETBINDR_WEB_API_KEY;

  const [state, setState] = useState<State>({ kind: "working", text: "One moment…" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setState({
        kind: "error",
        heading: "That link didn't work",
        text: "The link looks incomplete. Try tapping the button in the email again, or copy the whole link into your browser.",
      });
      return;
    }

    if (mode === "verifyEmail") {
      setState({ kind: "working", text: "Verifying your email…" });
      callAuth("accounts:update", apiKey, { oobCode })
        .then(() =>
          setState({
            kind: "done",
            heading: "Your email is verified",
            text: "Thanks! You can go back to the PetBindr app now. If it still shows the reminder, close and reopen the app.",
          })
        )
        .catch((e: Error) =>
          setState({ kind: "error", heading: "We couldn't verify your email", text: friendlyLinkError(e.message, mode) })
        );
      return;
    }

    if (mode === "resetPassword") {
      setState({ kind: "working", text: "Checking your link…" });
      // Checking the code doesn't use it up; only saving a new password does.
      callAuth("accounts:resetPassword", apiKey, { oobCode })
        .then((json) => setState({ kind: "resetForm", email: String(json.email || "") }))
        .catch((e: Error) =>
          setState({ kind: "error", heading: "We couldn't reset your password", text: friendlyLinkError(e.message, mode) })
        );
      return;
    }

    // Any other kind of account link (e.g. undoing an email change): hand it
    // to Firebase's standard page so it keeps working.
    window.location.replace(`${FIREBASE_DEFAULT_HANDLER}?${params.toString()}`);
  }, [mode, oobCode, apiKey, params]);

  async function saveNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setFormError("The two passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      await callAuth("accounts:resetPassword", apiKey, { oobCode, newPassword: password });
      setState({
        kind: "done",
        heading: "Your password is changed",
        text: "Go back to the PetBindr app and sign in with your new password.",
      });
    } catch (err) {
      const code = (err as Error).message;
      if (code === "WEAK_PASSWORD") {
        setFormError(`That password is too weak. Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      } else {
        setState({ kind: "error", heading: "We couldn't reset your password", text: friendlyLinkError(code, mode) });
      }
    } finally {
      setSaving(false);
    }
  }

  const heading =
    state.kind === "resetForm" ? "Choose a new password" : state.kind === "working" ? "Your PetBindr account" : state.heading;

  return (
    <>
      <h1
        className="font-fraunces font-semibold text-[var(--bindr-navy)] mb-4"
        style={{ fontSize: "clamp(26px, 4vw, 36px)" }}
      >
        {heading}
      </h1>

      {state.kind === "working" && (
        <p className="font-inter text-[var(--slate-gray)]" style={{ fontSize: "16px" }}>
          {state.text}
        </p>
      )}

      {(state.kind === "done" || state.kind === "error") && (
        <p className="font-inter text-[var(--charcoal)] leading-relaxed" style={{ fontSize: "16px" }}>
          {state.text}
        </p>
      )}

      {state.kind === "resetForm" && (
        <form onSubmit={saveNewPassword} className="space-y-4">
          {state.email && (
            <p className="font-inter text-[var(--charcoal)] leading-relaxed" style={{ fontSize: "16px" }}>
              For <strong>{state.email}</strong>
            </p>
          )}
          {/* Lets password managers save the new password under the right account */}
          <input type="email" autoComplete="username" value={state.email} readOnly hidden />
          <input
            type={showPassword ? "text" : "password"}
            className="email-input w-full"
            placeholder="New password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            type={showPassword ? "text" : "password"}
            className="email-input w-full"
            placeholder="Confirm new password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <label className="font-inter text-[var(--slate-gray)] flex items-center gap-2" style={{ fontSize: "14px" }}>
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            Show passwords
          </label>
          {formError && (
            <p className="font-inter" style={{ fontSize: "14px", color: "#C0392B" }} role="alert">
              {formError}
            </p>
          )}
          <button type="submit" className="btn-coral" disabled={saving}>
            {saving ? "Saving…" : "Save new password"}
          </button>
        </form>
      )}
    </>
  );
}
