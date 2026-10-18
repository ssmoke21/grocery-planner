// Admin-only data operations. The household directory lives inside the admin
// household's own private folder (households/{adminCode}/directory), so only
// someone holding the admin link can list households.
import { db } from "../firebase.js";
import {
  collection, doc, getDocs, query, where, writeBatch, deleteField,
} from "firebase/firestore";
import { hCol, hDoc } from "../household.js";

// Everything stored inside a household's private folder.
export const PRIVATE_SUBCOLLECTIONS = [
  "grocery_items", "app_state", "shopping_history", "meal_plan", "directory",
];

export const directoryCol = (adminCode) => hCol(adminCode, "directory");

export const renameHousehold = async (adminCode, entry, newName) => {
  const batch = writeBatch(db);
  batch.update(doc(db, "households", entry.code), { name: newName });
  batch.update(doc(db, "household_profiles", entry.public_id), { name: newName });
  batch.update(hDoc(adminCode, "directory", entry.code), { name: newName });
  await batch.commit();
};

export const recipesOwnedBy = async (publicId) =>
  (await getDocs(query(collection(db, "recipes"), where("owner_id", "==", publicId)))).docs;

// Firestore batches allow 500 writes; stay well under.
const commitInChunks = async (ops) => {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach((op) => op(batch));
    await batch.commit();
  }
};

/**
 * Deletes a household's private folder, its public name, and its directory
 * entry. Its shared recipes are either handed to the admin household
 * (recipes: "keep") or deleted (recipes: "delete").
 */
export const deleteHousehold = async (adminCode, adminPublicId, entry, { recipes = "keep" } = {}) => {
  const ops = [];
  for (const sub of PRIVATE_SUBCOLLECTIONS) {
    const snap = await getDocs(hCol(entry.code, sub));
    snap.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
  }
  (await recipesOwnedBy(entry.public_id)).forEach((d) => {
    ops.push(recipes === "delete"
      ? (b) => b.delete(d.ref)
      : (b) => b.update(d.ref, { owner_id: adminPublicId }));
  });
  const madeIt = await getDocs(query(collection(db, "recipes"), where(`planned_by.${entry.public_id}.count`, ">", 0)));
  madeIt.docs.forEach((d) => {
    if (recipes === "delete" && d.data().owner_id === entry.public_id) return; // already being deleted
    ops.push((b) => b.update(d.ref, { [`planned_by.${entry.public_id}`]: deleteField() }));
  });
  ops.push((b) => b.delete(doc(db, "household_profiles", entry.public_id)));
  ops.push((b) => b.delete(hDoc(adminCode, "directory", entry.code)));
  // The household doc goes last so a half-finished delete can simply be retried.
  ops.push((b) => b.delete(doc(db, "households", entry.code)));
  await commitInChunks(ops);
};
