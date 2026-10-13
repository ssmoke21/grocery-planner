import { useState, useMemo } from "react";
import { weekStart, formatWeekRange, buildUsage, usageLabel } from "./utils.js";
import { addToPlan, removeFromPlan } from "./recipeApi.js";
import RecipeTags, { RecipeThumb } from "./RecipeTags.jsx";
import RecipeDetail from "./RecipeDetail.jsx";
import GroceryReview from "./GroceryReview.jsx";
import { ui, font, useBodyScrollLock } from "./ui.js";

const TEAL = "#2f6b63";
const WEEKS = [
  { offset: 0, label: "This week" },
  { offset: 1, label: "Next week" },
];

// Newest additions last; entries still being saved have no timestamp yet.
const addedAt = (m) => m.createdAt?.toMillis?.() ?? Infinity;
const byAdded = (a, b) => addedAt(a) - addedAt(b);

export default function WeekPlan({ recipes, mealPlan, groceryItems, showToast, onGoToList }) {
  const [offset, setOffset]       = useState(0);
  const [picking, setPicking]     = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [openId, setOpenId]       = useState(null);

  const week  = weekStart(offset);
  const usage = useMemo(() => buildUsage(mealPlan), [mealPlan]);
  const recipeById = useMemo(() => Object.fromEntries(recipes.map((r) => [r.id, r])), [recipes]);

  // This week's plan entries joined to their recipes.
  const planned = mealPlan
    .filter((m) => m.week_start === week && recipeById[m.recipe_id])
    .sort(byAdded)
    .map((m) => ({ entry: m, recipe: recipeById[m.recipe_id] }));
  const entryFor = (recipeId) => planned.find((p) => p.recipe.id === recipeId)?.entry;

  const togglePlan = async (recipe) => {
    const entry = entryFor(recipe.id);
    try {
      if (entry) await removeFromPlan(entry.id);
      else await addToPlan(recipe, week);
    } catch (e) {
      console.error(e);
      showToast("Couldn't update the plan — try again");
    }
  };

  const remove = async (p) => {
    try {
      await removeFromPlan(p.entry.id);
      showToast(`Removed "${p.recipe.name}"`);
    } catch (e) { console.error(e); }
  };

  const openRecipe = openId && recipeById[openId];

  return (
    <div style={{ padding: "10px 16px" }}>
      {/* ── Week switcher ── */}
      <div style={styles.weekPills}>
        {WEEKS.map((w) => (
          <button
            key={w.offset}
            className="tab-btn"
            onClick={() => setOffset(w.offset)}
            style={{
              ...styles.weekPill,
              background: offset === w.offset ? "white" : "transparent",
              color: offset === w.offset ? TEAL : "#8a8478",
              boxShadow: offset === w.offset ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <div style={{ fontWeight: 700 }}>{w.label}</div>
            <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>{formatWeekRange(weekStart(w.offset))}</div>
          </button>
        ))}
      </div>

      {/* ── Planned meals ── */}
      {planned.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px 20px", color: "#aaa" }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🗓️</div>
          <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px", color: "#555" }}>No meals planned yet</p>
          <p style={{ fontSize: 13, margin: 0 }}>Pick a few recipes for {offset ? "next" : "this"} week.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {planned.map((p) => {
            const n = p.recipe.ingredients?.length || 0;
            return (
              <div key={p.entry.id} style={styles.mealCard}>
                <button className="recipe-card" onClick={() => setOpenId(p.recipe.id)} style={styles.mealMain}>
                  <RecipeThumb recipe={p.recipe} size={52} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.mealName}>{p.recipe.name}</div>
                    <RecipeTags recipe={p.recipe} />
                    <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600, color: n ? "#a0998a" : "#c08a1e" }}>
                      {n ? `${n} ingredient${n !== 1 ? "s" : ""}` : "No ingredients saved"}
                    </div>
                  </div>
                </button>
                <button onClick={() => remove(p)} style={styles.removeBtn} aria-label={`Remove ${p.recipe.name}`}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      <button className="add-trigger-btn" onClick={() => setPicking(true)} style={styles.addBtn}>
        + Add recipes
      </button>

      {/* ── Bottom bar ── */}
      <div style={styles.bottomBar}>
        <button
          className="primary-btn"
          onClick={() => setReviewing(true)}
          disabled={planned.length === 0}
          style={{
            ...styles.primaryBtn,
            background: planned.length
              ? "linear-gradient(135deg, #2D5016 0%, #4A7C24 100%)" : "#d4d3cc",
            cursor: planned.length ? "pointer" : "default",
          }}
        >🛒 Build grocery list</button>
      </div>

      {picking && (
        <RecipePicker
          recipes={recipes}
          usage={usage}
          isPlanned={(id) => !!entryFor(id)}
          onToggle={togglePlan}
          title={offset ? "Add to next week" : "Add to this week"}
          onClose={() => setPicking(false)}
        />
      )}

      {openRecipe && (
        <RecipeDetail
          recipe={openRecipe}
          usage={usage[openRecipe.id]}
          backLabel="← This week"
          onClose={() => setOpenId(null)}
          planned={!!entryFor(openRecipe.id)}
          planLabel={offset ? "next week" : "this week"}
          onTogglePlan={() => togglePlan(openRecipe)}
        />
      )}

      {reviewing && (
        <GroceryReview
          recipes={planned.map((p) => p.recipe)}
          groceryItems={groceryItems}
          showToast={showToast}
          onClose={() => setReviewing(false)}
          onAdded={() => { setReviewing(false); onGoToList(); }}
        />
      )}
    </div>
  );
}

function RecipePicker({ recipes, usage, isPlanned, onToggle, title, onClose }) {
  useBodyScrollLock();
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const list = recipes
    .filter((r) => !q || r.name?.toLowerCase().includes(q))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  return (
    <div className="sheet-anim" style={{ ...ui.sheet, zIndex: 260 }}>
      <div style={ui.topBar}>
        <h2 style={ui.topTitle}>{title}</h2>
        <button className="primary-btn" onClick={onClose} style={{ ...ui.topActionBtn, background: TEAL }}>Done</button>
      </div>
      <div style={ui.body}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍  Search recipes…"
          style={{ ...ui.input, marginBottom: 12 }}
        />
        {list.length === 0 && (
          <p style={{ textAlign: "center", color: "#aaa", fontSize: 14, padding: "30px 0" }}>
            {recipes.length ? "No recipes match." : "Your library is empty — add recipes first."}
          </p>
        )}
        <div style={ui.card}>
          {list.map((r, idx) => {
            const on = isPlanned(r.id);
            return (
              <button
                key={r.id}
                className="item-row-shop"
                onClick={() => onToggle(r)}
                style={{
                  ...styles.pickRow,
                  borderBottom: idx < list.length - 1 ? "1px solid #f0efe8" : "none",
                  background: on ? "#eef6f4" : "white",
                }}
              >
                <RecipeThumb recipe={r} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#222" }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "#a0998a", marginTop: 2 }}>{usageLabel(usage[r.id])}</div>
                </div>
                <span style={{
                  ...styles.pickPill,
                  background: on ? TEAL : "white",
                  color: on ? "white" : TEAL,
                }}>{on ? "✓ Added" : "+ Add"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles = {
  weekPills: {
    display: "flex", gap: 4, padding: 4, borderRadius: 14,
    background: "#ebe9e1", margin: "6px 0 14px",
  },
  weekPill: {
    flex: 1, padding: "9px 6px", borderRadius: 11, border: "none",
    fontSize: 14, cursor: "pointer", fontFamily: font, lineHeight: 1.3,
  },
  mealCard: {
    display: "flex", alignItems: "stretch", background: "white", borderRadius: 14, overflow: "hidden",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
  },
  mealMain: {
    flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12,
    padding: 12, border: "none", background: "white",
    textAlign: "left", cursor: "pointer", fontFamily: font,
  },
  mealName: { fontSize: 15, fontWeight: 700, color: "#222", marginBottom: 6, lineHeight: 1.3 },
  removeBtn: {
    width: 52, flexShrink: 0, border: "none", borderLeft: "1px solid #f0efe8",
    background: "white", color: "#b0aa9c", fontSize: 16, cursor: "pointer", fontFamily: font,
  },
  addBtn: {
    width: "100%", marginTop: 12, padding: "14px", borderRadius: 12,
    border: `1.5px dashed ${TEAL}66`, background: "transparent",
    color: TEAL, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
  bottomBar: {
    position: "fixed", bottom: 0, left: 0, right: 0,
    background: "rgba(247,246,241,0.92)",
    backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
    borderTop: "1px solid rgba(0,0,0,0.07)",
    padding: "10px 16px 16px", display: "flex", gap: 10, justifyContent: "center",
    zIndex: 100, maxWidth: 500, margin: "0 auto",
    boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
  },
  primaryBtn: {
    flex: 1, padding: "13px", borderRadius: 12, border: "none",
    color: "white", fontSize: 14, fontWeight: 700, fontFamily: font,
  },
  pickRow: {
    display: "flex", alignItems: "center", gap: 12, width: "100%",
    padding: "11px 12px", border: "none", textAlign: "left",
    cursor: "pointer", fontFamily: font,
  },
  pickPill: {
    flexShrink: 0, padding: "7px 12px", borderRadius: 16,
    border: `1.5px solid ${TEAL}`, fontSize: 12, fontWeight: 700,
  },
};
