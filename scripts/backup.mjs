// Saves every top-level collection (and app_state) to backups/<timestamp>.json.
// Usage: node scripts/backup.mjs
import { writeFileSync, mkdirSync } from "fs";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../src/firebase.js";

const COLLECTIONS = [
  "grocery_items", "app_state", "shopping_history", "meal_plan",
  "recipes", "household_profiles",
];

// Firestore Timestamps → { _timestamp: ISO string } so the file is plain JSON.
const plain = (v) => {
  if (v && typeof v.toDate === "function") return { _timestamp: v.toDate().toISOString() };
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
};

const out = { createdAt: new Date().toISOString(), collections: {} };
for (const name of COLLECTIONS) {
  const snap = await getDocs(collection(db, name));
  out.collections[name] = Object.fromEntries(snap.docs.map((d) => [d.id, plain(d.data())]));
  console.log(`${name}: ${snap.size}`);
}

mkdirSync("backups", { recursive: true });
const file = `backups/firestore-backup-${out.createdAt.replace(/[:.]/g, "-")}.json`;
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`Saved ${file}`);
process.exit(0);
