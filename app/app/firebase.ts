// Firebase for the web app (petbindr.com/app). The config is public (it only
// identifies the project); what anyone can read or write is decided by the
// same Firestore rules as the iPhone app.
//
// Set in Vercel (from the Firebase console's web app):
//   NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_APP_ID
// For local testing against the emulators: NEXT_PUBLIC_USE_EMULATORS=1

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";

const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "1";
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || (useEmulators ? "demo-key" : "");

/** False until the web app is registered in Firebase and its key is set */
export const webAppConfigured = !!apiKey;

let cached: { app: FirebaseApp; auth: Auth; db: Firestore; functions: Functions } | null = null;

export function firebase() {
  if (cached) return cached;
  const app = getApps()[0] || initializeApp({
    apiKey,
    authDomain: "petbindr-2d4bd.firebaseapp.com",
    projectId: "petbindr-2d4bd",
    storageBucket: "petbindr-2d4bd.firebasestorage.app",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || undefined,
  });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, "us-central1");
  if (useEmulators) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
  cached = { app, auth, db, functions };
  return cached;
}
