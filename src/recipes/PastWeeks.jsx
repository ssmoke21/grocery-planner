import { useState, useMemo } from "react";
import { weekStart, formatWeekRange, othersWhoMade } from "./utils.js";
import { addToPlan } from "./recipeApi.js";
import { RecipeThumb } from "./RecipeTags.jsx";
import RecipeDetail from "./RecipeDetail.jsx";
import { ui, font, useBodyScrollLock, useBackToClose } from "./ui.js";

const TEAL = "#2f6b63";

// Looks back at earlier weeks' meals, and can plan any of them again for next week.
export default function PastWeeks({ code, publicId, profiles, recipes, mealPlan, usage, showToast, onClose }) {
  useBodyScrollLock();
  useBackToClose(onClose);
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy]     = useState(false);

  const thisWeek = weekStart(0);
  const nextWeek = weekStart(1);
  const byId = useMemo(() => Object.fromEntries(recipes.map((r) => [r.id, r])), [recipes]);

  const weeks = useMemo(() => {
    const groups = {};
    mealPlan.filter((m) => m.week_start < thisWeek).forEach((m) => {
      (groups[m.week_start] ||= []).push(m);
    });
    return Object.keys(groups).sort().reverse().map((week) => ({
      week,
      meals: groups[week].sort((a, b) => (a.recipe_name || "").localeCompare(b.recipe_name || "")),
    }));
  }, [mealPlan, thisWeek]);

  const isNextWeek = (recipeId) => mealPlan.some((m) => m.recipe_id === recipeId && m.week_start === nextWeek);

  const planAgain = async (meals) => {
    const toAdd = meals.filter((m) => byId[m.recipe_id] && !isNextWeek(m.recipe_id));
    if (!toAdd.length) return;
    setBusy(true);
    try {
      for (const m of toAdd) {
        await addToPlan(code, publicId, byId[m.recipe_id], nextWeek, mealPlan, m.scale || 1);
      }
      showToast(`Added ${toAdd.length} to next week`);
    } catch (e) {
      console.error(e);
      showToast("Couldn't update the plan — try again");
    }
    setBusy(false);
  };

  const open = openId && byId[openId];

  return (
    <div className="sheet-anim" style={{ ...ui.sheet, zIndex: 260 }}>
      <div style={ui.topBar}>
        <button className="secondary-btn" onClick={onClose} style={ui.backBtn}>← Back</button>
        <h2 style={ui.topTitle}>Past weeks</h2>
        <span style={{ width: 60 }} />
      </div>

      <div style={ui.body}>
        {weeks.length === 0 && (
          <p style={styles.empty}>No past weeks yet. Meals you plan will show up here once their week has passed.</p>
        )}

        {weeks.map(({ week, meals }) => {
          const canAddAll = meals.some((m) => byId[m.recipe_id] && !isNextWeek(m.recipe_id));
          return (
            <div key={week}>
              <div style={styles.weekHead}>
                <span>
                  <strong style={{ color: "#333" }}>{formatWeekRange(week)}</strong>
                  {" · "}{meals.length} meal{meals.length !== 1 ? "s" : ""}
                </span>
                {canAddAll && (
                  <button onClick={() => planAgain(meals)} disabled={busy} style={styles.allBtn}>Plan all again</button>
                )}
              </div>
              <div style={ui.card}>
                {meals.map((m, idx) => {
                  const recipe = byId[m.recipe_id];
                  const planned = isNextWeek(m.recipe_id);
                  return (
                    <div key={m.id} style={{
                      ...styles.row,
                      borderBottom: idx < meals.length - 1 ? "1px solid #f0efe8" : "none",
                    }}>
                      <button
                        onClick={() => recipe && setOpenId(recipe.id)}
                        disabled={!recipe}
                        style={styles.main}
                      >
                        {recipe && <RecipeThumb recipe={recipe} size={40} />}
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={styles.name}>{recipe?.name || m.recipe_name}</span>
                          {recipe?.ratings?.[publicId] > 0 && (
                            <span style={styles.stars}>★{recipe.ratings[publicId]}</span>
                          )}
                          {!recipe && <span style={styles.gone}>Recipe no longer in the library</span>}
                        </span>
                      </button>
                      {recipe && (
                        <button
                          onClick={() => planAgain([m])}
                          disabled={busy || planned}
                          style={{
                            ...styles.againBtn,
                            background: planned ? "#eef6f4" : "white",
                            borderColor: planned ? "transparent" : TEAL,
                          }}
                        >{planned ? "✓ Next week" : "+ Next week"}</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <RecipeDetail
          recipe={open}
          usage={usage[open.id]}
          zIndex={270}
          backLabel="← Past weeks"
          ownerName={profiles[open.owner_id]?.name}
          othersWhoMade={othersWhoMade(open, publicId, profiles)}
          myId={publicId}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

const styles = {
  empty: { textAlign: "center", color: "#999", fontSize: 14, lineHeight: 1.5, padding: "40px 16px" },
  weekHead: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
    minHeight: 36, padding: "16px 2px 6px", fontSize: 13, color: "#8a8478",
  },
  allBtn: {
    flexShrink: 0, padding: "8px 4px", border: "none", background: "transparent",
    color: TEAL, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
  row: { display: "flex", alignItems: "center", gap: 8, paddingRight: 10 },
  main: {
    flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, padding: "10px 0 10px 12px",
    border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontFamily: font,
  },
  name: { display: "block", fontSize: 14, fontWeight: 600, color: "#222", lineHeight: 1.3 },
  stars: { display: "block", fontSize: 12, fontWeight: 700, color: "#c98f00", marginTop: 2 },
  gone: { display: "block", fontSize: 12, color: "#a0998a", marginTop: 2 },
  againBtn: {
    flexShrink: 0, minHeight: 40, padding: "8px 10px", borderRadius: 10, border: "1.5px solid",
    color: TEAL, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: font, whiteSpace: "nowrap",
  },
};
