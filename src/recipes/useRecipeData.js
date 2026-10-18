import { useState, useEffect } from "react";
import { db } from "../firebase.js";
import { collection, onSnapshot } from "firebase/firestore";
import { hCol } from "../household.js";

// Live subscription to the shared recipe library + this household's meal plan.
// Kept at the App level so switching tabs doesn't re-download everything.
export function useRecipeData(code) {
  const [recipes, setRecipes]   = useState([]);
  const [mealPlan, setMealPlan] = useState([]);
  const [profiles, setProfiles] = useState({}); // public_id → { name }
  const [loaded, setLoaded]     = useState({ recipes: false, mealPlan: false });

  useEffect(() => {
    const recipesUnsub = onSnapshot(
      collection(db, "recipes"),
      (snap) => {
        setRecipes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoaded((p) => ({ ...p, recipes: true }));
      },
      (err) => { console.error(err); setLoaded((p) => ({ ...p, recipes: true })); }
    );
    const planUnsub = onSnapshot(
      hCol(code, "meal_plan"),
      (snap) => {
        setMealPlan(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoaded((p) => ({ ...p, mealPlan: true }));
      },
      (err) => { console.error(err); setLoaded((p) => ({ ...p, mealPlan: true })); }
    );
    const profilesUnsub = onSnapshot(
      collection(db, "household_profiles"),
      (snap) => setProfiles(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))),
      (err) => console.error(err)
    );
    return () => { recipesUnsub(); planUnsub(); profilesUnsub(); };
  }, [code]);

  return { recipes, mealPlan, profiles, loading: !loaded.recipes || !loaded.mealPlan };
}
