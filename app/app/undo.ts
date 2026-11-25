// "Not done yet" on a dose this person checked off, sent like the app's Undo
// (MedicationStore.deleteLog, Fresh list 8 O1). One dose has one log ID, so a
// tab that was offline when it checked a dose off and then undid it could, on
// reconnect, have its check-off refused (someone else's got there first) and
// then delete theirs. With the doseUndos marker in the same batch the rules
// let this delete remove only a log this person made; theirs stays.
import { doc, getDocFromServer, serverTimestamp, writeBatch, type Firestore } from "firebase/firestore";

export const DOSE_KEPT = "dose-kept";

export async function undoOwnDose(db: Firestore, petId: string, logId: string, uid: string) {
  const ref = doc(db, `pets/${petId}/medicationLogs/${logId}`);
  const batch = writeBatch(db);
  batch.set(doc(db, `pets/${petId}/doseUndos/${uid}`), { logId, at: serverTimestamp() });
  batch.delete(ref);
  try {
    await batch.commit();
  } catch (err) {
    // Refused because the log is now someone else's: say so instead of an error
    const code = (err as { code?: string }).code || "";
    if (code.includes("permission-denied")) {
      const snap = await getDocFromServer(ref).catch(() => null);
      const by = snap?.exists() ? (snap.data().givenBy || snap.data().ownerId) : null;
      if (by && by !== uid) throw Object.assign(new Error("Someone else logged this dose"), { code: DOSE_KEPT });
    }
    throw err;
  }
}
