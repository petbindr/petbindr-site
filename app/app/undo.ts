// "Not done yet" on a dose or meal this person checked off, sent like the app's
// Undo (MedicationStore.deleteLog, Fresh list 8 O1; FeedingStore.removeLog,
// Fresh list 9 O1). One dose (or one meal a day) has one log ID, so a tab that
// was offline when it checked it off and then undid it could, on reconnect,
// have its check-off refused (someone else's got there first) and then delete
// theirs. With the doseUndos / mealUndos marker in the same batch the rules let
// this delete remove only a log this person made; theirs stays.
import { doc, getDocFromServer, serverTimestamp, writeBatch, type Firestore } from "firebase/firestore";

export const DOSE_KEPT = "dose-kept";
export const MEAL_KEPT = "meal-kept";

async function undoOwn(db: Firestore, petId: string, logId: string, uid: string, isMeal: boolean) {
  const ref = doc(db, `pets/${petId}/${isMeal ? "feedingLogs" : "medicationLogs"}/${logId}`);
  const batch = writeBatch(db);
  batch.set(doc(db, `pets/${petId}/${isMeal ? "mealUndos" : "doseUndos"}/${uid}`), { logId, at: serverTimestamp() });
  batch.delete(ref);
  try {
    await batch.commit();
  } catch (err) {
    // Refused because the log is now someone else's: say so instead of an error
    const code = (err as { code?: string }).code || "";
    if (code.includes("permission-denied")) {
      const snap = await getDocFromServer(ref).catch(() => null);
      const data = snap?.exists() ? snap.data() : null;
      const by = data ? (isMeal ? data.completedBy : (data.givenBy || data.ownerId)) : null;
      if (by && by !== uid) {
        throw Object.assign(new Error(`Someone else logged this ${isMeal ? "meal" : "dose"}`), { code: isMeal ? MEAL_KEPT : DOSE_KEPT });
      }
    }
    throw err;
  }
}

export const undoOwnDose = (db: Firestore, petId: string, logId: string, uid: string) => undoOwn(db, petId, logId, uid, false);
export const undoOwnMeal = (db: Firestore, petId: string, logId: string, uid: string) => undoOwn(db, petId, logId, uid, true);
