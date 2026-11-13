// Checks for notesChangedSinceOpened (app/app/records.ts): pet notes edited in
// two places at once. Run: node scripts/notes-test.mts
import { notesChangedSinceOpened } from "../app/app/records.ts";

let ok = 0, bad = 0;
const check = (label: string, cond: boolean) => { cond ? ok++ : bad++; console.log(cond ? "ok   " : "WRONG", label); };

check("nobody else changed them: save", !notesChangedSinceOpened("Shy with men", "Shy with men", "Shy with men. Loves cheese"));
check("changed by someone else meanwhile: stop", notesChangedSinceOpened("Shy with men", "Shy with men. Hides in storms", "Shy with men. Loves cheese"));
check("someone else saved the same text: save", !notesChangedSinceOpened("a", "a b", "a b "));
check("added from empty in another tab: stop", notesChangedSinceOpened("", "Allergic to chicken", "Loves walks"));
check("cleared elsewhere while editing: stop", notesChangedSinceOpened("Old note", "", "Old note, edited"));

console.log(`\n${ok} passed, ${bad} wrong`);
process.exit(bad ? 1 : 0);
