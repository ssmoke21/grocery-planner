import { useState } from "react";
import { planMealRemoval } from "./combine.js";
import { removeFromPlan } from "./recipeApi.js";
import { font } from "./ui.js";

// Taking a meal off the plan: if it put things on the grocery list, ask whether
// they should come off too. Returns `requestRemove` and the prompt to render.
export function useMealRemoval({ code, publicId, mealPlan, ledger, groceryItems, showToast }) {
  const [pending, setPending] = useState(null); // { entry, recipe, plan }
  const [busy, setBusy] = useState(false);

  const finish = async (entry, recipe, plan, removeItems) => {
    await removeFromPlan(code, publicId, entry, mealPlan, plan, removeItems);
    const n = removeItems ? plan.items.length : 0;
    showToast(n ? `Removed "${recipe.name}" and ${n} list item${n !== 1 ? "s" : ""}` : `Removed "${recipe.name}"`);
  };

  const requestRemove = async (entry, recipe) => {
    const plan = planMealRemoval({ ledger, week: entry.week_start, recipeId: recipe.id, groceryItems });
    if (plan.items.length) { setPending({ entry, recipe, plan }); return; }
    try {
      await finish(entry, recipe, plan, false);
    } catch (e) {
      console.error(e);
      showToast("Couldn't update the plan — try again");
    }
  };

  const answer = async (removeItems) => {
    setBusy(true);
    try {
      await finish(pending.entry, pending.recipe, pending.plan, removeItems);
    } catch (e) {
      console.error(e);
      showToast("Couldn't update the plan — try again");
    }
    setBusy(false);
    setPending(null);
  };

  const prompt = pending && (
    <div className="overlay-anim" style={styles.overlay}>
      <div className="modal-anim" style={styles.modal}>
        <h3 style={styles.title}>Remove {pending.recipe.name}?</h3>
        <p style={styles.body}>This meal added these to your grocery list:</p>
        <div style={styles.list}>
          {pending.plan.items.map((i) => <div key={i.id} style={styles.item}>• {i.name}</div>)}
        </div>
        {pending.plan.bought.length > 0 && (
          <p style={styles.note}>Already checked off, so left alone: {pending.plan.bought.join(", ")}</p>
        )}
        <button onClick={() => answer(true)} disabled={busy} style={styles.primary}>
          {busy ? "Working…" : "Remove meal and these items"}
        </button>
        <button onClick={() => answer(false)} disabled={busy} style={styles.secondary}>
          Remove meal, keep list as is
        </button>
        <button onClick={() => setPending(null)} disabled={busy} style={styles.cancel}>Cancel</button>
      </div>
    </div>
  );

  return { requestRemove, prompt };
}

const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 320, padding: 20,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  modal: {
    width: "100%", maxWidth: 340, maxHeight: "85vh", overflowY: "auto", boxSizing: "border-box",
    background: "var(--bg-ffffff)", borderRadius: 20, padding: "24px 20px", fontFamily: font,
    boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
  },
  title: { margin: "0 0 8px", fontSize: 18, lineHeight: 1.25, fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 500, color: "var(--fg-1a1a1a)" },
  body: { fontSize: 13, color: "var(--fg-777777)", margin: "0 0 8px" },
  list: { maxHeight: 180, overflowY: "auto", marginBottom: 10 },
  item: { fontSize: 14, color: "var(--fg-333333)", padding: "3px 0" },
  note: { fontSize: 12, color: "var(--fg-a0998a)", margin: "0 0 10px", lineHeight: 1.45 },
  primary: {
    width: "100%", padding: "13px", marginTop: 4, borderRadius: 10, border: "none", background: "var(--bg-2f6b63)",
    color: "var(--fg-ffffff)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
  secondary: {
    width: "100%", padding: "12px", marginTop: 8, borderRadius: 10, border: "1.5px solid var(--ln-e0dfd8)", background: "var(--bg-ffffff)",
    color: "var(--fg-555555)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: font,
  },
  cancel: {
    width: "100%", padding: "11px", marginTop: 4, border: "none", background: "transparent",
    color: "var(--fg-999999)", fontSize: 13, cursor: "pointer", fontFamily: font,
  },
};
