"use client";

// Account: download your data or delete your account, in the browser too
// (2026-11-18 review, item 20). People who signed up here, on Android or a
// computer, had no way to do either, but the privacy policy and terms point to
// "Account → Delete Account / Export My Data". Same server functions as the app.

import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, signOut, type User } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { firebase } from "./firebase";

export default function AccountCard({ user }: { user: User }) {
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");

  async function download() {
    setBusy("export"); setError(null); setNote(null);
    try {
      const call = httpsCallable(firebase().functions, "exportMyData", { timeout: 300_000 });
      const { data } = await call();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PetBindr data ${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setNote("Your data is downloading as a file.");
    } catch (e) {
      setError(message(e, "Couldn't get your data."));
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!user.email || !password) return;
    setBusy("delete"); setError(null);
    try {
      // The server only deletes right after the password was entered
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      await httpsCallable(firebase().functions, "deleteMyAccount", { timeout: 300_000 })();
      window.location.hash = "";
      await signOut(firebase().auth).catch(() => {});
    } catch (err) {
      const code = (err as { code?: string }).code || "";
      setError(/wrong-password|invalid-credential|invalid-login/.test(code)
        ? "That password isn't right."
        : message(err, "Couldn't delete your account."));
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl p-5 md:p-6" style={{ background: "var(--pure-white)", border: "1px solid var(--mist-gray)" }}>
      <h2 className="font-fraunces font-semibold mb-3" style={{ fontSize: "20px", color: "var(--bindr-navy)" }}>Your account</h2>
      <p className="font-inter text-[var(--charcoal)]" style={{ fontSize: "15px" }}>
        Signed in as <strong>{user.email}</strong>
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        <button className="btn-ghost" style={{ padding: "10px 16px" }} onClick={download} disabled={busy !== null}>
          {busy === "export" ? "Getting your data…" : "Download My Data"}
        </button>
        {!confirming && (
          <button className="btn-ghost" style={{ padding: "10px 16px", color: "var(--error-red)" }} onClick={() => { setConfirming(true); setError(null); }}>
            Delete Account…
          </button>
        )}
      </div>
      {confirming && (
        <form onSubmit={deleteAccount} className="mt-4 space-y-3 rounded-xl p-4" style={{ background: "#FDECEA" }}>
          <p className="font-inter text-[var(--charcoal)]" style={{ fontSize: "15px" }}>
            This deletes your account, your pets, their records and photos, and your home information, and
            ends access for everyone you shared with. A pet you co-own with someone stays with them.
            It can&rsquo;t be undone.
          </p>
          <label className="block font-inter" style={{ fontSize: "15px" }}>
            Enter your password to confirm
            <input type="password" className="email-input w-full mt-1" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-coral" style={{ padding: "10px 16px" }} disabled={busy !== null || !password}>
              {busy === "delete" ? "Deleting…" : "Delete My Account"}
            </button>
            <button type="button" className="btn-ghost" style={{ padding: "10px 16px" }} disabled={busy === "delete"}
              onClick={() => { setConfirming(false); setPassword(""); setError(null); }}>
              Keep My Account
            </button>
          </div>
        </form>
      )}
      {note && <p role="status" className="font-inter mt-3" style={{ fontSize: "15px", color: "var(--success-green)" }}>{note}</p>}
      {error && <p role="alert" className="font-inter mt-3" style={{ fontSize: "15px", color: "var(--error-red)" }}>{error}</p>}
    </section>
  );
}

function message(e: unknown, fallback: string) {
  const err = e as { code?: string; message?: string };
  if (err.code === "functions/resource-exhausted" && err.message) return err.message;
  if (err.code === "functions/failed-precondition" && err.message) return err.message;
  return `${fallback} Check your connection and try again.`;
}
