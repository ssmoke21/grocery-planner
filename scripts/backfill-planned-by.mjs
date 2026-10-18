// Rebuilds every recipe's public planned_by summary from each household's
// private meal plan. Safe to re-run any time the summaries look off.
// Usage: node scripts/backfill-planned-by.mjs   (uses backups/admin-household.json)
import { readFileSync } from "fs";
import { collection, doc, getDocs, writeBatch, deleteField } from "firebase/firestore";
import { db } from "../src/firebase.js";
import { hCol } from "../src/household.js";

const { code: adminCode } = JSON.parse(readFileSync("backups/admin-household.json", "utf8"));
const households = (await getDocs(hCol(adminCode, "directory"))).docs.map((d) => ({ code: d.id, ...d.data() }));

// recipeId → { publicId → { count, last } }
const summary = {};
for (const h of households) {
  const plan = (await getDocs(hCol(h.code, "meal_plan"))).docs.map((d) => d.data());
  for (const m of plan) {
    const byHh = (summary[m.recipe_id] ||= {});
    const s = (byHh[h.public_id] ||= { count: 0, last: "" });
    s.count += 1;
    if (m.week_start > s.last) s.last = m.week_start;
  }
  console.log(`${h.name}: ${plan.length} planned meals`);
}

const recipes = (await getDocs(collection(db, "recipes"))).docs;
const batch = writeBatch(db);
let touched = 0;
for (const r of recipes) {
  const next = summary[r.id];
  if (next) { batch.update(r.ref, { planned_by: next }); touched++; }
  else if (r.data().planned_by) { batch.update(r.ref, { planned_by: deleteField() }); touched++; }
}
await batch.commit();
console.log(`Updated ${touched} recipes`);
process.exit(0);
