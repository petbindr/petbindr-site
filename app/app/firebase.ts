// Firebase for the web app (petbindr.com/app). The config is public (it only
// identifies the project); what anyone can read or write is decided by the
// same Firestore rules as the iPhone app.
//
// The "PetBindr Web" app registered in Firebase (2026-11-12). Web API keys
// aren't secrets: they're in every page that uses Firebase. Vercel env vars
// NEXT_PUBLIC_FIREBASE_API_KEY / NEXT_PUBLIC_FIREBASE_APP_ID override them.
// For local testing against the emulators: NEXT_PUBLIC_USE_EMULATORS=1
const WEB_API_KEY = "AIzaSyC-Yc92DGkgvm9X63WhEQViyyIpYvgDyzE";
const WEB_APP_ID = "1:116519914036:web:680378a11f742f9cb09861";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator, type Firestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";
import { getStorage, connectStorageEmulator, type FirebaseStorage } from "firebase/storage";

const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "1";
const apiKey = useEmulators ? "demo-key" : (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || WEB_API_KEY);

/** False until the web app is registered in Firebase and its key is set */
export const webAppConfigured = !!apiKey;

let cached: { app: FirebaseApp; auth: Auth; db: Firestore; functions: Functions; storage: FirebaseStorage } | null = null;

export function firebase() {
  if (cached) return cached;
  const app = getApps()[0] || initializeApp({
    apiKey,
    authDomain: "petbindr-2d4bd.firebaseapp.com",
    projectId: "petbindr-2d4bd",
    storageBucket: "petbindr-2d4bd.firebasestorage.app",
    appId: useEmulators ? undefined : (process.env.NEXT_PUBLIC_FIREBASE_APP_ID || WEB_APP_ID),
  });
  const auth = getAuth(app);
  // Kept on the device (IndexedDB): a check-off made with no signal is sent when the
  // signal's back, even after the tab was closed (in memory only, it was lost)
  let db: Firestore;
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    db = getFirestore(app); // already set up (hot reload), or storage not available
  }
  const functions = getFunctions(app, "us-central1");
  const storage = getStorage(app);
  if (useEmulators) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
  }
  cached = { app, auth, db, functions, storage };
  return cached;
}
