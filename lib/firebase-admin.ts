import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App;
let db: Firestore;

function getFirebaseAdmin() {
  if (!app) {
    const existingApps = getApps();

    if (existingApps.length > 0) {
      app = existingApps[0];
    } else {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

      if (!serviceAccountJson) {
        throw new Error(
          "FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set. " +
            "See README.md for setup instructions."
        );
      }

      let serviceAccount;
      try {
        // Support both raw JSON string and base64-encoded JSON
        const decoded = Buffer.from(serviceAccountJson, "base64").toString("utf8");
        serviceAccount = JSON.parse(decoded);
      } catch {
        // Not base64 — try parsing as raw JSON
        try {
          serviceAccount = JSON.parse(serviceAccountJson);
        } catch {
          throw new Error(
            "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON or base64-encoded JSON."
          );
        }
      }

      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || "petbindr-2d4bd",
      });
    }
  }

  if (!db) {
    db = getFirestore(app);
  }

  return { app, db };
}

export { getFirebaseAdmin };
