// Checks the live database rules from the outside, as a stranger would see them.
// Usage: node scripts/check-rules.mjs <HOUSEHOLD_CODE>
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, collectionGroup } from "firebase/firestore";
import { db } from "../src/firebase.js";
import { hCol, randomId } from "../src/household.js";

const code = process.argv[2];
const results = [];
const expect = async (label, shouldWork, fn) => {
  let worked = true;
  try { await fn(); } catch { worked = false; }
  results.push({ check: label, expected: shouldWork ? "allowed" : "blocked", actual: worked ? "allowed" : "blocked", ok: worked === shouldWork ? "✅" : "❌" });
};

await expect("Open a household by its code", true, () => getDoc(doc(db, "households", code)));
await expect("Read that household's list", true, () => getDocs(hCol(code, "grocery_items")));
await expect("List ALL households", false, () => getDocs(collection(db, "households")));
await expect("Search every household's lists at once", false, () => getDocs(collectionGroup(db, "grocery_items")));
await expect("Read the old (pre-household) list", false, () => getDocs(collection(db, "grocery_items")));
await expect("Read shared recipes", true, () => getDocs(collection(db, "recipes")));
const fake = randomId(12);
await expect("Create a household that claims to be admin", false, async () => {
  await setDoc(doc(db, "households", fake), { name: "rules-test", public_id: "rules-test", is_admin: true });
  await deleteDoc(doc(db, "households", fake)); // only reached if the rules wrongly allowed it
});
// Uses a throwaway household only — never touches a real one.
const temp = randomId(12);
await expect("Create a normal household", true, () =>
  setDoc(doc(db, "households", temp), { name: "rules-test", public_id: "rules-test", is_admin: false }));
await expect("Turn a normal household into an admin", false, () =>
  setDoc(doc(db, "households", temp), { is_admin: true }, { merge: true }));
await expect("Delete that household", true, () => deleteDoc(doc(db, "households", temp)));

console.table(results);
process.exit(results.every((r) => r.ok === "✅") ? 0 : 1);
