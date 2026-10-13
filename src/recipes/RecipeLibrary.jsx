import { useState, useMemo } from "react";
import { db } from "../firebase.js";
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import {
  PROTEINS, DIFFICULTIES, TIME_BUCKETS, COOK_METHODS, SEASONS, SORTS, byKey,
} from "./constants.js";
import { timeBucket, currentSeason, isInSeason, buildUsage, usageLabel } from "./utils.js";
import { SAMPLE_RECIPES } from "./sampleRecipes.js";
import RecipeTags, { RecipeThumb } from "./RecipeTags.jsx";
import RecipeDetail from "./RecipeDetail.jsx";

const EMPTY_FILTERS = { protein: [], difficulty: [], time: [], method: [], season: [] };

const FILTER_GROUPS = [
  { key: "protein",    title: "Protein",     options: PROTEINS },
  { key: "difficulty", title: "Difficulty",  options: DIFFICULTIES },
  { key: "time",       title: "Time",        options: TIME_BUCKETS },
  { key: "method",     title: "Cook method", options: COOK_METHODS },
  { key: "season",     title: "Season",      options: SEASONS },
];

const SEASON_NOW = currentSeason();
const SEASON_LABEL = byKey(SEASONS)[SEASON_NOW];

// Within a group, any selected option matches. Across groups, all must match.
const matchesFilters = (r, f) =>
  (!f.protein.length    || f.protein.includes(r.protein)) &&
  (!f.difficulty.length || f.difficulty.includes(r.difficulty)) &&
  (!f.time.length       || f.time.includes(timeBucket(r.total_minutes))) &&
  (!f.method.length     || f.method.some((m) => r.cook_methods?.includes(m))) &&
  (!f.season.length     || f.season.some((s) => isInSeason(r, s)));

export default function RecipeLibrary({ recipes, mealPlan, showToast }) {
  const [search, setSearch]       = useState("");
  const [filters, setFilters]     = useState(EMPTY_FILTERS);
  const [inSeasonNow, setInSeasonNow] = useState(false);
  const [sort, setSort]           = useState("az");
  const [panelOpen, setPanelOpen] = useState(false);
  const [openId, setOpenId]       = useState(null);
  const [seeding, setSeeding]     = useState(false);

  const usage = useMemo(() => buildUsage(mealPlan), [mealPlan]);

  const filterCount =
    Object.values(filters).reduce((n, arr) => n + arr.length, 0) + (inSeasonNow ? 1 : 0);

  const toggleFilter = (group, key) =>
    setFilters((f) => ({
      ...f,
      [group]: f[group].includes(key) ? f[group].filter((k) => k !== key) : [...f[group], key],
    }));

  const clearAll = () => { setFilters(EMPTY_FILTERS); setInSeasonNow(false); setSearch(""); };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = recipes.filter((r) =>
      (!q || r.name?.toLowerCase().includes(q)) &&
      (!inSeasonNow || isInSeason(r, SEASON_NOW)) &&
      matchesFilters(r, filters)
    );
    const byName = (a, b) => (a.name || "").localeCompare(b.name || "");
    if (sort === "most") {
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
  }, [recipes, search, filters, inSeasonNow, sort, usage]);

  const loadSamples = async () => {
    setSeeding(true);
    try {
      const batch = writeBatch(db);
      SAMPLE_RECIPES.forEach((r) => {
        batch.set(doc(collection(db, "recipes")), {
          ...r, is_sample: true,
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
        </div>
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
          {FILTER_GROUPS.map((g) => (
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
                <div style={{
                  ...styles.usage,
                  color: usage[r.id]?.count ? "#4A7C24" : "#b0aa9c",
                }}>{usageLabel(usage[r.id])}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {openRecipe && (
        <RecipeDetail
          recipe={openRecipe}
          usage={usage[openRecipe.id]}
          onClose={() => setOpenId(null)}
        />
      )}
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
  cardName: { fontSize: 15, fontWeight: 700, color: "#222", marginBottom: 6, letterSpacing: "-0.01em", lineHeight: 1.3 },
  usage: { fontSize: 12, fontWeight: 600, marginTop: 7 },
};
