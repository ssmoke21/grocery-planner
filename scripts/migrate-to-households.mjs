// One-time move to households. COPIES (doesn't move) the original top-level
// data into a new admin household, and marks every unowned recipe as theirs.
// Safe to re-run: pass the code from backups/admin-household.json and it
// re-syncs into the same household using the same document IDs.
//
// Usage: node scripts/migrate-to-households.mjs "Amy"          (first run)
//        node scripts/migrate-to-households.mjs "Amy" <CODE>   (re-sync)
import { writeFileSync } from "fs";
import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../src/firebase.js";
import { createHousehold, hCol, hDoc } from "../src/household.js";

const [name, existingCode] = process.argv.slice(2);
if (!name) { console.error("Give the household name, e.g. \"Amy\""); process.exit(1); }

// 1. The admin household (+ its own directory entry).
let code = existingCode;
if (!code) {
  ({ code } = await createHousehold(name, { isAdmin: true }));
  console.log(`Created admin household "${name}"`);
}
const hh = (await getDoc(doc(db, "households", code))).data();
if (!hh?.is_admin) throw new Error("That code isn't an admin household");
await setDoc(hDoc(code, "directory", code), {
  name: hh.name, public_id: hh.public_id, is_admin: true, createdAt: hh.createdAt,
});
writeFileSync("backups/admin-household.json", JSON.stringify({ name: hh.name, code, public_id: hh.public_id }, null, 2));

// 2. Copy private data, keeping document IDs.
const writeAll = async (ops) => {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach((op) => op(batch));
    await batch.commit();
  }
};
const counts = {};
for (const sub of ["grocery_items", "app_state", "shopping_history", "meal_plan"]) {
  const snap = await getDocs(collection(db, sub));
  await writeAll(snap.docs.map((d) => (b) => b.set(hDoc(code, sub, d.id), d.data())));
  const copied = (await getDocs(hCol(code, sub))).size;
  counts[sub] = { original: snap.size, copied };
}

// 3. Every recipe without an owner becomes this household's.
const recipes = await getDocs(collection(db, "recipes"));
const unowned = recipes.docs.filter((d) => !d.data().owner_id);
await writeAll(unowned.map((d) => (b) => b.update(d.ref, { owner_id: hh.public_id })));
const ownedNow = (await getDocs(collection(db, "recipes"))).docs.filter((d) => d.data().owner_id === hh.public_id).length;
counts.recipes = { total: recipes.size, newlyOwned: unowned.length, ownedByHousehold: ownedNow };

console.table(counts);
const ok = ["grocery_items", "app_state", "shopping_history", "meal_plan"].every((s) => counts[s].original === counts[s].copied);
console.log(ok ? "✅ All counts match." : "⚠️ Counts don't match — don't deploy yet.");
console.log(`Saved household details to backups/admin-household.json`);
process.exit(ok ? 0 : 1);
