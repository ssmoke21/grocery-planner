import { useState, useEffect } from "react";
import { db } from "../firebase.js";
import { collection, onSnapshot } from "firebase/firestore";
import { hCol, hDoc } from "../household.js";
import { withCombinedMeals } from "./constants.js";

// Live subscription to the shared recipe library + this household's meal plan.
// Kept at the App level so switching tabs doesn't re-download everything.
export function useRecipeData(code) {
  const [recipes, setRecipes]   = useState([]);
  const [mealPlan, setMealPlan] = useState([]);
  const [profiles, setProfiles] = useState({}); // public_id → { name }
  const [ledger, setLedger]     = useState([]); // what each planned meal added to the list
  const [loaded, setLoaded]     = useState({ recipes: false, mealPlan: false });

  useEffect(() => {
    const recipesUnsub = onSnapshot(
      collection(db, "recipes"),
      (snap) => {
        setRecipes(snap.docs.map((d) => withCombinedMeals({ id: d.id, ...d.data() })));
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
    const ledgerUnsub = onSnapshot(
      hDoc(code, "app_state", "list_ledger"),
      (snap) => setLedger(snap.data()?.entries || []),
      (err) => console.error(err)
    );
    return () => { recipesUnsub(); planUnsub(); profilesUnsub(); ledgerUnsub(); };
  }, [code]);

  return { recipes, mealPlan, profiles, ledger, loading: !loaded.recipes || !loaded.mealPlan };
}
