// One-time: moves each recipe's old "course" (Dish) into its meals list.
// Saves a copy of the recipes first. Run with --apply to write; otherwise it
// only prints what would change.
import { writeFileSync } from "fs";
import { collection, getDocs, writeBatch, deleteField } from "firebase/firestore";
import { db } from "../src/firebase.js";
import { withCombinedMeals } from "../src/recipes/constants.js";

const apply = process.argv.includes("--apply");
const docs = (await getDocs(collection(db, "recipes"))).docs;
const withCourse = docs.filter((d) => d.data().course !== undefined);

const tally = {};
const updates = withCourse.map((d) => {
  const { meals = [] } = withCombinedMeals(d.data());
  const key = meals.join("+") || "none";
  tally[key] = (tally[key] || 0) + 1;
  return { ref: d.ref, name: d.data().name, from: d.data().course, meals };
});
updates.filter((u) => u.from !== "main").forEach((u) => console.log(`${u.name}: ${u.meals.join(", ")}`));
console.log(`${withCourse.length} of ${docs.length} recipes have the old field`, tally);

if (apply) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(`backups/recipes-before-meal-merge-${stamp}.json`, JSON.stringify(docs.map((d) => ({ id: d.id, ...d.data() })), null, 1));
  for (let i = 0; i < updates.length; i += 400) {
    const batch = writeBatch(db);
    updates.slice(i, i + 400).forEach((u) => batch.update(u.ref, { meals: u.meals, course: deleteField() }));
    await batch.commit();
  }
  console.log("Applied.");
}
process.exit(0);
