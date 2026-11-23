// Checks for app/s/glucose.ts (glucose readings on sitter links). Run: node scripts/glucose-test.mts
import { glucoseUnitFor, parseGlucose, glucoseText } from "../app/s/glucose.ts";

let ok = 0, bad = 0;
const check = (label: string, cond: boolean) => { cond ? ok++ : bad++; console.log(cond ? "ok   " : "WRONG", label); };
const mg = (r: ReturnType<typeof parseGlucose>) => (r.kind === "valid" ? r.mgdL : r.kind);

check("link's unit wins", glucoseUnitFor("mmolL", "en-US") === "mmolL");
check("link's mg/dL wins", glucoseUnitFor("mgdL", "en-GB") === "mgdL");
check("US browser: mg/dL", glucoseUnitFor(null, "en-US") === "mgdL");
check("UK browser: mmol/L", glucoseUnitFor(null, "en-GB") === "mmolL");
check("plain 'en' (US by likely subtags): mg/dL", glucoseUnitFor(undefined, "en") === "mgdL");
check("Canadian French: mmol/L", glucoseUnitFor(null, "fr-CA") === "mmolL");
check("junk link unit ignored", glucoseUnitFor("mg", "en-AU") === "mmolL");
check("bad locale: mg/dL", glucoseUnitFor(null, "!!") === "mgdL");

check("empty", mg(parseGlucose("  ", "mgdL")) === "empty");
check("320 mg/dL", mg(parseGlucose("320", "mgdL")) === 320);
check("unit typed after it", mg(parseGlucose("320 mg/dL", "mgdL")) === 320);
check("17.8 mmol/L stored as mg/dL", mg(parseGlucose("17.8", "mmolL")) === 320.4);
check("comma decimal", mg(parseGlucose("17,8", "mmolL")) === 320.4);
check("too low", mg(parseGlucose("5", "mgdL")) === "invalid");
check("too high", mg(parseGlucose("1200", "mgdL")) === "invalid");
check("mg/dL number in mmol/L region is too high", mg(parseGlucose("320", "mmolL")) === "invalid");
check("words", mg(parseGlucose("high", "mgdL")) === "invalid");
check("negative", mg(parseGlucose("-50", "mgdL")) === "invalid");
check("two numbers", mg(parseGlucose("320 340", "mgdL")) === "invalid");
check("text mg/dL", glucoseText(320, "mgdL") === "320 mg/dL");
check("text mmol/L", glucoseText(320.4, "mmolL") === "17.8 mmol/L");

console.log(`\n${ok} ok, ${bad} wrong`);
process.exit(bad ? 1 : 0);
