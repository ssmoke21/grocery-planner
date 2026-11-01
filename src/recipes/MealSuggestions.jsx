import { useState, useMemo, useRef } from "react";
import { currentSeason, parseDay, othersWhoMade, madeByLabel } from "./utils.js";
import { eligibleDinners, suggestDinners, pickDinner, rotationKind, reasonFor } from "./recommend.js";
import RecipeTags, { RecipeThumb } from "./RecipeTags.jsx";
import RecipeDetail from "./RecipeDetail.jsx";
import { ui, font, useBodyScrollLock, useBackToClose } from "./ui.js";

const TEAL = "#2f6b63";
const COUNTS = [3, 4, 5, 6, 7];

// Optional helper on the This Week tab: suggests dinners to add. Nothing joins
// the plan until it's tapped, and it works alongside meals already picked.
export default function MealSuggestions({
  recipes, usage, profiles, publicId, week, weekLabel,
  plannedRecipes, isPlanned, onToggle, onClose,
}) {
  useBodyScrollLock();
  useBackToClose(onClose);

  const season = currentSeason(parseDay(week));
  const pool = useMemo(
    () => eligibleDinners({ recipes, usage, season }),
    // Keep the pool steady while this screen is open, so adding a meal
    // doesn't change what's on offer. eslint-disable-next-line
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const popularity = (r) => othersWhoMade(r, publicId, profiles).length;

  // Ids already shown, so Swap and Shuffle bring something different.
  const seen = useRef(new Set());
  const fresh = (count, keep) => {
    const skip = new Set([...seen.current, ...plannedRecipes.map((r) => r.id)]);
    let picks = suggestDinners({ pool, usage, count, keep, skip, popularity });
    if (picks.length < count) {
      // Ran out of unseen recipes: start over, leaving out only what's in use.
      seen.current = new Set();
      picks = suggestDinners({
        pool, usage, count, keep,
        skip: new Set(plannedRecipes.map((r) => r.id)), popularity,
      });
    }
    picks.forEach((r) => seen.current.add(r.id));
    return picks;
  };

  const [count, setCount] = useState(5);
  const [ids, setIds]     = useState(() => fresh(5, plannedRecipes).map((r) => r.id));
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);

  const byId = useMemo(() => Object.fromEntries(recipes.map((r) => [r.id, r])), [recipes]);
  const shown = ids.map((id) => byId[id]).filter(Boolean);
  const toAdd = shown.filter((r) => !isPlanned(r.id));

  // New set of the given size; anything already added to the plan stays put.
  const rebuild = (size) => {
    const kept = shown.filter((r) => isPlanned(r.id));
    const others = plannedRecipes.filter((r) => !kept.includes(r));
    const picks = fresh(Math.max(size - kept.length, 0), [...others, ...kept]);
    setIds([...kept, ...picks].map((r) => r.id));
  };

  const changeCount = (n) => { setCount(n); rebuild(n); };

  const swap = (recipe, idx) => {
    const chosen = [...plannedRecipes, ...shown.filter((r) => r.id !== recipe.id)];
    const skip = new Set([...seen.current, ...chosen.map((r) => r.id), recipe.id]);
    let next = pickDinner({ pool, usage, kind: rotationKind(idx), chosen, skip, popularity });
    if (!next) {
      // Everything has been shown once; reuse anything not currently on screen.
      seen.current = new Set();
      next = pickDinner({
        pool, usage, kind: rotationKind(idx), chosen,
        skip: new Set([...chosen.map((r) => r.id), recipe.id]), popularity,
      });
    }
    if (!next) return;
    seen.current.add(next.id);
    setIds((cur) => cur.map((id) => (id === recipe.id ? next.id : id)));
  };

  const addAll = async () => {
    setAdding(true);
    for (const r of toAdd) await onToggle(r);
    setAdding(false);
  };

  const open = openId && byId[openId];

  return (
    <div className="sheet-anim" style={{ ...ui.sheet, zIndex: 260, display: "flex", flexDirection: "column" }}>
      <div style={ui.topBar}>
        <h2 style={ui.topTitle}>Dinner ideas</h2>
        <button className="primary-btn" onClick={onClose} style={{ ...ui.topActionBtn, background: TEAL }}>Done</button>
      </div>

      <div style={{ ...ui.body, flex: 1 }}>
        <p style={styles.intro}>
          A mix of favorites, regulars and new things for {season}, for {weekLabel}. Add the ones you like, swap the rest.
        </p>

        <div style={styles.countRow}>
          <span style={styles.countLabel}>How many?</span>
          {COUNTS.map((n) => (
            <button
              key={n}
              onClick={() => changeCount(n)}
              style={{
                ...styles.countBtn,
                background: count === n ? TEAL : "white",
                color: count === n ? "white" : "#666",
                borderColor: count === n ? TEAL : "#e0dfd8",
              }}
            >{n}</button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p style={styles.empty}>
            No dinner recipes fit right now. Check that your recipes are marked Dinner and in season.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {shown.map((r, idx) => {
              const on = isPlanned(r.id);
              const made = madeByLabel(othersWhoMade(r, publicId, profiles));
              return (
                <div key={r.id} style={{ ...ui.card, background: on ? "#eef6f4" : "white" }}>
                  <button onClick={() => setOpenId(r.id)} style={styles.main}>
                    <RecipeThumb recipe={r} size={52} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.name}>{r.name}</div>
                      <RecipeTags recipe={r} />
                      <div style={styles.reason}>{reasonFor(usage[r.id], made)}</div>
                    </div>
                  </button>
                  <div style={styles.actions}>
                    {!on && (
                      <button className="secondary-btn" onClick={() => swap(r, idx)} style={styles.swapBtn}>🔄 Swap</button>
                    )}
                    <button
                      className="primary-btn"
                      onClick={() => onToggle(r)}
                      style={{
                        ...styles.addBtn,
                        background: on ? "white" : TEAL,
                        color: on ? TEAL : "white",
                      }}
                    >{on ? "✓ Added · tap to remove" : "+ Add"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={styles.footer}>
        <button className="secondary-btn" onClick={() => rebuild(count)} style={styles.shuffleBtn}>🔀 Shuffle</button>
        <button
          className="primary-btn"
          onClick={addAll}
          disabled={adding || toAdd.length === 0}
          style={{ ...styles.addAllBtn, opacity: toAdd.length ? 1 : 0.45 }}
        >{adding ? "Adding…" : toAdd.length ? `Add ${toAdd.length} to ${weekLabel}` : "All added"}</button>
      </div>

      {open && (
        <RecipeDetail
          recipe={open}
          usage={usage[open.id]}
          zIndex={270}
          backLabel="← Dinner ideas"
          ownerName={profiles[open.owner_id]?.name}
          othersWhoMade={othersWhoMade(open, publicId, profiles)}
          planned={isPlanned(open.id)}
          planLabel={weekLabel}
          onTogglePlan={() => onToggle(open)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

const styles = {
  intro: { fontSize: 14, color: "#666", lineHeight: 1.5, margin: "2px 2px 12px" },
  countRow: { display: "flex", alignItems: "center", gap: 6, margin: "0 2px 14px" },
  countLabel: { flex: 1, fontSize: 13, fontWeight: 700, color: "#777" },
  countBtn: {
    width: 40, height: 40, borderRadius: 10, border: "1.5px solid",
    fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
  empty: { textAlign: "center", color: "#999", fontSize: 14, lineHeight: 1.5, padding: "30px 10px" },
  main: {
    display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 12px 8px",
    border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontFamily: font,
  },
  name: { fontSize: 15, fontWeight: 700, color: "#222", marginBottom: 6, lineHeight: 1.3 },
  reason: { fontSize: 12, fontWeight: 600, color: TEAL, marginTop: 6 },
  actions: { display: "flex", gap: 8, padding: "0 12px 12px" },
  swapBtn: {
    flex: 1, padding: "11px", borderRadius: 10, border: "1.5px solid #e0dfd8", background: "white",
    color: "#666", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font,
  },
  addBtn: {
    flex: 2, padding: "11px", borderRadius: 10, border: `1.5px solid ${TEAL}`,
    fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
  footer: {
    position: "sticky", bottom: 0, display: "flex", gap: 10, padding: "10px 16px 16px",
    background: "rgba(247,246,241,0.92)",
    backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
    borderTop: "1px solid rgba(0,0,0,0.07)",
  },
  shuffleBtn: {
    flex: 1, padding: "13px", borderRadius: 12, border: "1.5px solid #e0dfd8", background: "white",
    color: "#666", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: font,
  },
  addAllBtn: {
    flex: 2, padding: "13px", borderRadius: 12, border: "none",
    background: "linear-gradient(135deg, #173a36 0%, #2f6b63 100%)",
    color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
};
