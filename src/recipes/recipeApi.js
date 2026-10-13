import { db } from "../firebase.js";
import {
  collection, doc, addDoc, updateDoc, writeBatch, serverTimestamp,
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
