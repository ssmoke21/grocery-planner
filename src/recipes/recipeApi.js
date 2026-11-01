import { db } from "../firebase.js";
import {
  collection, doc, addDoc, updateDoc, writeBatch, serverTimestamp, deleteField,
} from "firebase/firestore";
import { hCol, hDoc } from "../household.js";

export const createRecipe = async (recipe) => {
  const ref = await addDoc(collection(db, "recipes"), {
    ...recipe, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
};

// Makes an editable copy of someone else's recipe, owned by this household.
export const copyRecipe = (recipe, ownerId) => {
  // eslint-disable-next-line no-unused-vars
  const { id, createdAt, updatedAt, owner_id, is_sample, planned_by, ratings, ...rest } = recipe;
  return createRecipe({ ...rest, owner_id: ownerId, copied_from: id });
};

export const updateRecipe = (id, recipe) =>
  updateDoc(doc(db, "recipes", id), { ...recipe, course: deleteField(), updatedAt: serverTimestamp() });

// Deletes the recipe and this household's meal-plan history for it.
export const deleteRecipe = async (code, id, mealPlan) => {
  const batch = writeBatch(db);
  batch.delete(doc(db, "recipes", id));
  mealPlan.filter((m) => m.recipe_id === id).forEach((m) => {
    batch.delete(hDoc(code, "meal_plan", m.id));
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

const LEDGER = (code) => hDoc(code, "app_state", "list_ledger");

// ── Meal plan ──
// Each recipe also carries a public summary of who has made it, shared among
// friends for "Popular with others":
//   planned_by.{household public_id} = { count, last }
// The meal-plan entries themselves stay private to the household.
const plannedBySummary = (weeks) =>
  weeks.length ? { count: weeks.length, last: weeks.reduce((a, b) => (b > a ? b : a)) } : deleteField();

export const addToPlan = async (code, publicId, recipe, week, mealPlan, scale = 1) => {
  const weeks = [...mealPlan.filter((m) => m.recipe_id === recipe.id).map((m) => m.week_start), week];
  const batch = writeBatch(db);
  batch.set(doc(hCol(code, "meal_plan")), {
    recipe_id: recipe.id, recipe_name: recipe.name, week_start: week,
    ...(scale !== 1 ? { scale } : {}),
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, "recipes", recipe.id), { [`planned_by.${publicId}`]: plannedBySummary(weeks) });
  await batch.commit();
};

// `listPlan` (from planMealRemoval) updates the ledger; with `removeItems` it
// also takes the meal's items back off the grocery list.
export const removeFromPlan = async (code, publicId, entry, mealPlan, listPlan = null, removeItems = false) => {
  const weeks = mealPlan
    .filter((m) => m.recipe_id === entry.recipe_id && m.id !== entry.id)
    .map((m) => m.week_start);
  const batch = writeBatch(db);
  batch.delete(hDoc(code, "meal_plan", entry.id));
  batch.update(doc(db, "recipes", entry.recipe_id), { [`planned_by.${publicId}`]: plannedBySummary(weeks) });
  if (listPlan) {
    batch.set(LEDGER(code), { entries: listPlan.ledger });
    if (removeItems) {
      listPlan.items.forEach((i) => {
        if (i.remove) batch.delete(hDoc(code, "grocery_items", i.id));
        else batch.update(hDoc(code, "grocery_items", i.id), { ...i.changes, updatedAt: serverTimestamp() });
      });
    }
  }
  await batch.commit();
};

export const setPlanScale = (code, entryId, scale) =>
  updateDoc(hDoc(code, "meal_plan", entryId), { scale });

// 1–5 stars per household, shared with friends. null clears it.
export const rateRecipe = (recipeId, publicId, stars) =>
  updateDoc(doc(db, "recipes", recipeId), { [`ratings.${publicId}`]: stars ?? deleteField() });

// A fresh id for a new grocery item, so the ledger can refer to it.
export const newGroceryItemId = (code) => doc(hCol(code, "grocery_items")).id;

// plan comes from planListWrites
export const applyGroceryWrites = async (code, { creates, updates, ledger }) => {
  const batch = writeBatch(db);
  creates.forEach(({ id, data }) => {
    batch.set(hDoc(code, "grocery_items", id), { ...data, createdAt: serverTimestamp() });
  });
  batch.set(LEDGER(code), { entries: ledger });
  updates.forEach(({ id, changes }) => {
    batch.update(hDoc(code, "grocery_items", id), { ...changes, updatedAt: serverTimestamp() });
  });
  await batch.commit();
};
