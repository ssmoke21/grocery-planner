import { useState, useMemo } from "react";
import { db } from "../firebase.js";
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import {
  PROTEINS, DIFFICULTIES, TIME_BUCKETS, COOK_METHODS, SEASONS, SORTS, byKey, COURSES, courseOf,
  FAVORITE_MIN_TIMES, NOT_IN_A_WHILE_DAYS,
} from "./constants.js";
import {
  timeBucket, currentSeason, isInSeason, buildUsage, usageStatus, weekStart,
  othersWhoMade, madeByLabel,
} from "./utils.js";
import { SAMPLE_RECIPES } from "./sampleRecipes.js";
import RecipeTags, { RecipeThumb, UsageLine } from "./RecipeTags.jsx";
import RecipeDetail from "./RecipeDetail.jsx";
import RecipeForm from "./RecipeForm.jsx";
import ImportRecipes from "./ImportRecipes.jsx";
import { deleteRecipe, addToPlan, removeFromPlan, copyRecipe } from "./recipeApi.js";

const EMPTY_FILTERS = { household: [], usage: [], course: [], protein: [], difficulty: [], time: [], method: [], season: [] };

const USAGE_OPTIONS = [
  { key: "favorite", label: "⭐ Favorites",   hint: `${FAVORITE_MIN_TIMES}+ times` },
  { key: "never",    label: "Never made" },
  { key: "stale",    label: "Not in a while", hint: `${NOT_IN_A_WHILE_DAYS}+ days` },
];

const FILTER_GROUPS = [
  { key: "usage",      title: "Usage",       options: USAGE_OPTIONS },
  { key: "course",     title: "Dish",        options: COURSES },
  { key: "protein",    title: "Protein",     options: PROTEINS },
  { key: "difficulty", title: "Difficulty",  options: DIFFICULTIES },
  { key: "time",       title: "Time",        options: TIME_BUCKETS },
  { key: "method",     title: "Cook method", options: COOK_METHODS },
  { key: "season",     title: "Season",      options: SEASONS },
];

const SEASON_NOW = currentSeason();
const SEASON_LABEL = byKey(SEASONS)[SEASON_NOW];

const WHOSE = [
  { key: "all",    label: "All" },
  { key: "mine",   label: "Mine" },
  { key: "others", label: "Others" },
];

// Within a group, any selected option matches. Across groups, all must match.
const matchesFilters = (r, f, status) =>
  (!f.household.length  || f.household.includes(r.owner_id)) &&
  (!f.usage.length      || f.usage.some((k) => status[k])) &&
  (!f.course.length     || f.course.includes(courseOf(r))) &&
  (!f.protein.length    || f.protein.includes(r.protein)) &&
  (!f.difficulty.length || f.difficulty.includes(r.difficulty)) &&
  (!f.time.length       || f.time.includes(timeBucket(r.total_minutes))) &&
  (!f.method.length     || f.method.some((m) => r.cook_methods?.includes(m))) &&
  (!f.season.length     || f.season.some((s) => isInSeason(r, s)));

export default function RecipeLibrary({ household, profiles, recipes, mealPlan, groceryItems, showToast }) {
  const { code, public_id: myId } = household;
  const isMine = (r) => r.owner_id === myId;
  const ownerName = (r) => profiles[r.owner_id]?.name || null;
  const [search, setSearch]       = useState("");
  const [filters, setFilters]     = useState(EMPTY_FILTERS);
  const [inSeasonNow, setInSeasonNow] = useState(false);
  const [sort, setSort]           = useState("az");
  const [panelOpen, setPanelOpen] = useState(false);
  const [openId, setOpenId]       = useState(null);
  const [seeding, setSeeding]     = useState(false);
  const [editing, setEditing]     = useState(null); // null | {} (new) | recipe
  const [importing, setImporting] = useState(false);
  const [whose, setWhose]         = useState("all");

  const usage = useMemo(() => buildUsage(mealPlan), [mealPlan]);

  const filterCount =
    Object.values(filters).reduce((n, arr) => n + arr.length, 0) + (inSeasonNow ? 1 : 0) + (whose !== "all" ? 1 : 0);

  // Households that own at least one recipe, for the "Household" filter.
  const ownerOptions = useMemo(() => {
    const ids = [...new Set(recipes.map((r) => r.owner_id).filter((id) => profiles[id]))];
    return ids
      .map((id) => ({ key: id, label: id === myId ? `${profiles[id].name} (you)` : profiles[id].name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [recipes, profiles, myId]);

  const toggleFilter = (group, key) =>
    setFilters((f) => ({
      ...f,
      [group]: f[group].includes(key) ? f[group].filter((k) => k !== key) : [...f[group], key],
    }));

  const clearAll = () => { setFilters(EMPTY_FILTERS); setInSeasonNow(false); setSearch(""); setWhose("all"); };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = recipes.filter((r) =>
      (!q || r.name?.toLowerCase().includes(q)) &&
      (!inSeasonNow || isInSeason(r, SEASON_NOW)) &&
      (whose === "all" || (whose === "mine") === isMine(r)) &&
      matchesFilters(r, filters, usageStatus(usage[r.id]))
    );
    const byName = (a, b) => (a.name || "").localeCompare(b.name || "");
    if (sort === "popular") {
      // Most other households first, then most times made by others.
      const score = (r) => {
        const o = othersWhoMade(r, myId, profiles);
        return [o.length, o.reduce((n, x) => n + x.count, 0)];
      };
      list.sort((a, b) => {
        const [ha, ta] = score(a), [hb, tb] = score(b);
        return hb - ha || tb - ta || byName(a, b);
      });
    } else if (sort === "most") {
      list.sort((a, b) => (usage[b.id]?.count || 0) - (usage[a.id]?.count || 0) || byName(a, b));
    } else if (sort === "oldest") {
      // Never made first, then longest since last made.
      list.sort((a, b) => {
        const la = usage[a.id]?.last || "", lb = usage[b.id]?.last || "";
        return la === lb ? byName(a, b) : la < lb ? -1 : 1;
      });
    } else {
      list.sort(byName);
    }
    return list;
  }, [recipes, search, filters, inSeasonNow, sort, usage, whose, myId, profiles]);

  const loadSamples = async () => {
    setSeeding(true);
    try {
      const batch = writeBatch(db);
      SAMPLE_RECIPES.forEach((r) => {
        batch.set(doc(collection(db, "recipes")), {
          ...r, is_sample: true, owner_id: myId,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      showToast("Added 4 sample recipes");
    } catch (e) {
      console.error(e);
      showToast("Couldn't add samples — try again");
    }
    setSeeding(false);
  };

  const openRecipe = recipes.find((r) => r.id === openId);

  // "Add to this week" from the detail sheet.
  const thisWeek = weekStart(0);
  const planEntry = openRecipe && mealPlan.find((m) => m.recipe_id === openRecipe.id && m.week_start === thisWeek);
  const togglePlan = async () => {
    try {
      if (planEntry) await removeFromPlan(code, myId, planEntry, mealPlan);
      else { await addToPlan(code, myId, openRecipe, thisWeek, mealPlan); showToast("Added to this week"); }
    } catch (e) {
      console.error(e);
      showToast("Couldn't update the plan — try again");
    }
  };

  // "Save a copy" of another household's recipe. If we already have one, open it.
  const myCopy = openRecipe && !isMine(openRecipe)
    && recipes.find((r) => isMine(r) && r.copied_from === openRecipe.id);
  const handleCopy = async () => {
    if (myCopy) { setOpenId(myCopy.id); return; }
    try {
      const id = await copyRecipe(openRecipe, myId);
      showToast("Saved a copy to your recipes");
      setOpenId(id);
    } catch (e) {
      console.error(e);
      showToast("Couldn't save a copy — try again");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteRecipe(code, openRecipe.id, mealPlan);
      showToast(`Deleted "${openRecipe.name}"`);
      setOpenId(null);
      return true;
    } catch (e) {
      console.error(e);
      showToast("Couldn't delete — check your connection");
      return false;
    }
  };

  // Sheets and the bottom bar render the same whether or not the library is empty.
  const overlays = (
    <>
      {openRecipe && (
        <RecipeDetail
          recipe={openRecipe}
          usage={usage[openRecipe.id]}
          onClose={() => setOpenId(null)}
          ownerName={ownerName(openRecipe)}
          othersWhoMade={othersWhoMade(openRecipe, myId, profiles)}
          onEdit={isMine(openRecipe) ? () => setEditing(openRecipe) : null}
          onDelete={isMine(openRecipe) ? handleDelete : null}
          onCopy={isMine(openRecipe) ? null : handleCopy}
          hasCopy={!!myCopy}
          planned={!!planEntry}
          onTogglePlan={togglePlan}
        />
      )}
      {editing && (
        <RecipeForm
          initial={editing}
          ownerId={myId}
          groceryItems={groceryItems}
          showToast={showToast}
          onCancel={() => setEditing(null)}
          onSaved={(id) => { setEditing(null); setOpenId(id); }}
        />
      )}
      {importing && (
        <ImportRecipes
          recipes={recipes.filter(isMine)}
          ownerId={myId}
          groceryItems={groceryItems}
          showToast={showToast}
          onClose={() => setImporting(false)}
        />
      )}
      <div style={styles.bottomBar}>
        <button className="secondary-btn" onClick={() => setImporting(true)} style={styles.secondaryBtn}>
          Import
        </button>
        <button className="primary-btn" onClick={() => setEditing({})} style={styles.primaryBtn}>
          + New Recipe
        </button>
      </div>
    </>
  );

  // ── Empty library ──
  if (recipes.length === 0) {
    return (
      <div style={styles.content}>
        <div style={styles.emptyState}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📖</div>
          <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px", color: "#555" }}>No recipes yet</p>
          <p style={{ fontSize: 13, color: "#aaa", margin: "0 0 20px" }}>
            Load a few samples to try things out.
          </p>
          <button
            className="primary-btn"
            onClick={loadSamples}
            disabled={seeding}
            style={styles.sampleBtn}
          >{seeding ? "Adding…" : "Load 4 sample recipes"}</button>
          <p style={{ fontSize: 13, color: "#aaa", margin: "18px 0 0" }}>
            …or add your own with the buttons below.
          </p>
        </div>
        {overlays}
      </div>
    );
  }

  return (
    <div style={styles.content}>
      {/* ── Search ── */}
      <div style={styles.searchWrap}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipes…"
          style={styles.searchInput}
        />
      </div>

      {/* ── Filter / sort bar ── */}
      <div style={styles.toolbar}>
        <button
          className="secondary-btn"
          onClick={() => setPanelOpen((o) => !o)}
          style={{
            ...styles.toolBtn,
            borderColor: filterCount ? "#8a4a22" : "#e0dfd8",
            color: filterCount ? "#8a4a22" : "#777",
          }}
        >
          Filters{filterCount ? ` (${filterCount})` : ""}
          <span style={{
            ...styles.chevron,
            transform: panelOpen ? "rotate(0deg)" : "rotate(-90deg)",
          }}>▼</span>
        </button>
        <button
          className="secondary-btn"
          onClick={() => setInSeasonNow((v) => !v)}
          style={{
            ...styles.toolBtn,
            background: inSeasonNow ? "#8a4a22" : "white",
            borderColor: inSeasonNow ? "#8a4a22" : "#e0dfd8",
            color: inSeasonNow ? "white" : "#777",
          }}
        >{SEASON_LABEL.icon} In season</button>
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={styles.sortSelect}>
          {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {/* ── Filter panel ── */}
      {panelOpen && (
        <div className="section-card" style={styles.panel}>
          <div style={{ marginBottom: 12 }}>
            <div style={styles.groupTitle}>Recipes from</div>
            <div style={styles.segment}>
              {WHOSE.map((o) => (
                <button
                  key={o.key}
                  onClick={() => setWhose(o.key)}
                  style={{
                    ...styles.segmentBtn,
                    background: whose === o.key ? "white" : "transparent",
                    color: whose === o.key ? "#8a4a22" : "#8a8478",
                    boxShadow: whose === o.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  }}
                >{o.label}</button>
              ))}
            </div>
          </div>
          {[...(ownerOptions.length > 1 ? [{ key: "household", title: "Household", options: ownerOptions }] : []),
            ...FILTER_GROUPS].map((g) => (
            <div key={g.key} style={{ marginBottom: 12 }}>
              <div style={styles.groupTitle}>{g.title}</div>
              <div style={styles.chipRow}>
                {g.options.map((o) => {
                  const on = filters[g.key].includes(o.key);
                  return (
                    <button
                      key={o.key}
                      onClick={() => toggleFilter(g.key, o.key)}
                      style={{
                        ...styles.chip,
                        background: on ? "#8a4a22" : "#f4f3ee",
                        color: on ? "white" : "#555",
                        borderColor: on ? "#8a4a22" : "#e8e6dc",
                      }}
                    >
                      {o.icon ? `${o.icon} ` : ""}{o.label}
                      {o.hint && <span style={{ opacity: 0.65, fontWeight: 500 }}> · {o.hint}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="secondary-btn" onClick={clearAll} style={styles.panelBtn}>Clear all</button>
            <button
              className="primary-btn"
              onClick={() => setPanelOpen(false)}
              style={{ ...styles.panelBtn, background: "#8a4a22", color: "white", border: "none" }}
            >Show {visible.length}</button>
          </div>
        </div>
      )}

      <p style={styles.hint}>
        {visible.length === recipes.length
          ? `${recipes.length} recipe${recipes.length !== 1 ? "s" : ""}`
          : `${visible.length} of ${recipes.length} recipes`}
      </p>

      {/* ── Cards ── */}
      {visible.length === 0 ? (
        <div style={{ ...styles.emptyState, padding: "40px 20px" }}>
          <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px", color: "#777" }}>No recipes match</p>
          <button className="secondary-btn" onClick={clearAll} style={{ ...styles.panelBtn, flex: "none", padding: "10px 20px" }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map((r) => (
            <button
              key={r.id}
              className="recipe-card"
              onClick={() => setOpenId(r.id)}
              style={styles.recipeCard}
            >
              <RecipeThumb recipe={r} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.cardName}>{r.name}</div>
                <RecipeTags recipe={r} />
                <UsageLine usage={usage[r.id]} style={{ marginTop: 7 }} />
                {sort === "popular" && (() => {
                  const o = othersWhoMade(r, myId, profiles);
                  return o.length > 0 && <div style={styles.popular}>🔥 Made by {madeByLabel(o)}</div>;
                })()}
                {ownerName(r) && (
                  <div style={styles.from}>from {isMine(r) ? `${ownerName(r)} (you)` : ownerName(r)}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {overlays}
    </div>
  );
}

const font = "'DM Sans', sans-serif";

const styles = {
  content: { padding: "10px 16px" },
  hint: { fontSize: 12, color: "#a0998a", margin: "4px 2px 10px", letterSpacing: "0.01em" },
  emptyState: { textAlign: "center", padding: "70px 20px", color: "#aaa" },
  sampleBtn: {
    padding: "13px 24px", borderRadius: 12, border: "none",
    background: "linear-gradient(135deg, #5a2c14 0%, #8a4a22 100%)",
    color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
  searchWrap: { position: "relative", margin: "6px 0 10px" },
  searchIcon: { position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.5 },
  searchInput: {
    width: "100%", boxSizing: "border-box",
    padding: "13px 14px 13px 38px", borderRadius: 12,
    border: "1.5px solid #e4e2d8", background: "white",
    fontSize: 16, fontFamily: font, outline: "none",
  },
  toolbar: { display: "flex", gap: 8, marginBottom: 10 },
  toolBtn: {
    display: "flex", alignItems: "center", gap: 6,
    padding: "10px 13px", borderRadius: 10, border: "1.5px solid #e0dfd8",
    background: "white", fontSize: 13, fontWeight: 600,
    cursor: "pointer", fontFamily: font, whiteSpace: "nowrap",
  },
  chevron: { fontSize: 8, transition: "transform 0.22s ease", display: "inline-block" },
  sortSelect: {
    flex: 1, minWidth: 0, padding: "10px 8px", borderRadius: 10,
    border: "1.5px solid #e0dfd8", background: "white",
    fontSize: 13, fontWeight: 600, color: "#777", fontFamily: font,
  },
  panel: {
    background: "white", borderRadius: 14, padding: "14px 14px 12px", marginBottom: 10,
    boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
  },
  groupTitle: {
    fontSize: 11, fontWeight: 700, color: "#8a4a22",
    letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7,
  },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: {
    padding: "9px 12px", borderRadius: 18, border: "1.5px solid",
    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font,
    transition: "background 0.15s ease, color 0.15s ease",
  },
  panelBtn: {
    flex: 1, padding: "11px", borderRadius: 10,
    border: "1.5px solid #e0dfd8", background: "white",
    color: "#888", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
  recipeCard: {
    display: "flex", alignItems: "center", gap: 14, width: "100%",
    padding: 12, border: "none", borderRadius: 14, background: "white",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
    textAlign: "left", cursor: "pointer", fontFamily: font,
  },
  from: { fontSize: 11, color: "#a0998a", marginTop: 3, fontWeight: 500 },
  popular: { fontSize: 12, color: "#b5521b", marginTop: 4, fontWeight: 600 },
  segment: { display: "flex", gap: 3, padding: 3, borderRadius: 11, background: "#efede6" },
  segmentBtn: {
    flex: 1, padding: "9px 0", borderRadius: 9, border: "none",
    fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
  cardName: { fontSize: 15, fontWeight: 700, color: "#222", marginBottom: 6, letterSpacing: "-0.01em", lineHeight: 1.3 },
  bottomBar: {
    position: "fixed", bottom: 0, left: 0, right: 0,
    background: "rgba(247,246,241,0.92)",
    backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
    borderTop: "1px solid rgba(0,0,0,0.07)",
    padding: "10px 16px 16px", display: "flex", gap: 10, justifyContent: "center",
    zIndex: 100, maxWidth: 500, margin: "0 auto",
    boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
  },
  secondaryBtn: {
    flex: 1, padding: "13px", borderRadius: 12,
    border: "1.5px solid #e0dfd8", background: "white",
    color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font,
  },
  primaryBtn: {
    flex: 2, padding: "13px", borderRadius: 12, border: "none",
    background: "linear-gradient(135deg, #5a2c14 0%, #8a4a22 100%)",
    color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
};
