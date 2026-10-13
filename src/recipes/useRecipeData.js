import { useState, useEffect } from "react";
import { db } from "../firebase.js";
import { collection, onSnapshot } from "firebase/firestore";

// Live subscription to recipes + meal plan. Kept at the App level so
// switching tabs doesn't re-download everything.
export function useRecipeData() {
  const [recipes, setRecipes]   = useState([]);
  const [mealPlan, setMealPlan] = useState([]);
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
      collection(db, "meal_plan"),
      (snap) => {
        setMealPlan(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoaded((p) => ({ ...p, mealPlan: true }));
      },
      (err) => { console.error(err); setLoaded((p) => ({ ...p, mealPlan: true })); }
    );
    return () => { recipesUnsub(); planUnsub(); };
  }, []);

  return { recipes, mealPlan, loading: !loaded.recipes || !loaded.mealPlan };
}
