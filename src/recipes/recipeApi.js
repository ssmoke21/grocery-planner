import { db } from "../firebase.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp,
} from "firebase/firestore";

export const createRecipe = async (recipe) => {
  const ref = await addDoc(collection(db, "recipes"), {
    ...recipe, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateRecipe = (id, recipe) =>
  updateDoc(doc(db, "recipes", id), { ...recipe, updatedAt: serverTimestamp() });

// Deletes the recipe and its meal-plan history ("made it" entries).
export const deleteRecipe = async (id, mealPlan) => {
  const batch = writeBatch(db);
  batch.delete(doc(db, "recipes", id));
  mealPlan.filter((m) => m.recipe_id === id).forEach((m) => {
    batch.delete(doc(db, "meal_plan", m.id));
  });
  await batch.commit();
};

// Firestore batches max out at 500 writes, so import in chunks.
export const importRecipes = async (recipes) => {
  for (let i = 0; i < recipes.length; i += 400) {
    const batch = writeBatch(db);
    recipes.slice(i, i + 400).forEach((r) => {
      batch.set(doc(collection(db, "recipes")), {
        ...r, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
};

// ── Meal plan ──
export const addToPlan = (recipe, week) =>
  addDoc(collection(db, "meal_plan"), {
    recipe_id: recipe.id, recipe_name: recipe.name, week_start: week,
    createdAt: serverTimestamp(),
  });

export const removeFromPlan = (entryId) => deleteDoc(doc(db, "meal_plan", entryId));

// ── Grocery list ── (plan comes from planGroceryWrites)
export const applyGroceryWrites = async ({ creates, updates }) => {
  const batch = writeBatch(db);
  creates.forEach((item) => {
    batch.set(doc(collection(db, "grocery_items")), { ...item, createdAt: serverTimestamp() });
  });
  updates.forEach(({ id, changes }) => {
    batch.update(doc(db, "grocery_items", id), { ...changes, updatedAt: serverTimestamp() });
  });
  await batch.commit();
};
