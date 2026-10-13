import { useEffect } from "react";
import { COOK_METHODS, SEASONS, byKey } from "./constants.js";
import { usageLabel, formatQty, formatMinutes } from "./utils.js";
import { SECTION_ICONS } from "../sections.js";
import RecipeTags, { RecipeThumb, Tag } from "./RecipeTags.jsx";

const M = byKey(COOK_METHODS);
const S = byKey(SEASONS);

export default function RecipeDetail({ recipe, usage, onClose }) {
  // Stop the list behind from scrolling while the detail sheet is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const ingredients = recipe.ingredients || [];
  const facts = [
    recipe.total_minutes ? `⏱ ${formatMinutes(recipe.total_minutes)}` : null,
    recipe.servings ? `🍽 Serves ${recipe.servings}` : null,
  ].filter(Boolean);

  return (
    <div className="sheet-anim" style={styles.sheet}>
      <div style={styles.topBar}>
        <button className="secondary-btn" onClick={onClose} style={styles.backBtn}>← Recipes</button>
      </div>

      <div style={styles.body}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
          <RecipeThumb recipe={recipe} size={72} />
          <div style={{ minWidth: 0 }}>
            <h2 style={styles.name}>{recipe.name}</h2>
            <div style={{
              fontSize: 12, fontWeight: 600, marginTop: 4,
              color: usage?.count ? "#4A7C24" : "#b0aa9c",
            }}>{usageLabel(usage)}</div>
          </div>
        </div>

        <RecipeTags recipe={recipe} />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
          {facts.map((f) => <Tag key={f}>{f}</Tag>)}
          {recipe.cook_methods?.map((m) => M[m] && <Tag key={m}>{M[m].label}</Tag>)}
          {recipe.seasons?.length
            ? recipe.seasons.map((s) => S[s] && <Tag key={s}>{S[s].icon} {S[s].label}</Tag>)
            : <Tag>🗓 Year-round</Tag>}
        </div>

        {/* ── Ingredients ── */}
        <div style={styles.sectionLabel}>Ingredients</div>
        <div style={styles.card}>
          {ingredients.length === 0 ? (
            <div style={{ padding: "14px 16px", fontSize: 13, color: "#aaa" }}>No ingredients saved.</div>
          ) : ingredients.map((ing, idx) => (
            <div key={idx} style={{
              ...styles.ingRow,
              borderBottom: idx < ingredients.length - 1 ? "1px solid #f0efe8" : "none",
            }}>
              <span style={{ fontSize: 15, flexShrink: 0 }} title={ing.section}>
                {SECTION_ICONS[ing.section] || "📦"}
              </span>
              <span style={{ flex: 1, fontSize: 14, color: "#222", fontWeight: 500 }}>{ing.name}</span>
              {formatQty(ing.qty, ing.unit) && (
                <span style={{ fontSize: 13, color: "#888", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {formatQty(ing.qty, ing.unit)}
                </span>
              )}
            </div>
          ))}
        </div>

        {recipe.instructions && (
          <>
            <div style={styles.sectionLabel}>Instructions</div>
            <div style={{ ...styles.card, ...styles.textBlock }}>{recipe.instructions}</div>
          </>
        )}

        {recipe.notes && (
          <>
            <div style={styles.sectionLabel}>Notes</div>
            <div style={{ ...styles.card, ...styles.textBlock, background: "#FFFBEF" }}>{recipe.notes}</div>
          </>
        )}

        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>
            View original recipe ↗
          </a>
        )}
      </div>
    </div>
  );
}

const font = "'DM Sans', sans-serif";

const styles = {
  sheet: {
    position: "fixed", inset: 0, zIndex: 250, overflowY: "auto",
    background: "#F7F6F1", fontFamily: font,
    maxWidth: 500, margin: "0 auto",
  },
  topBar: {
    position: "sticky", top: 0, zIndex: 1, padding: "14px 16px 10px",
    background: "rgba(247,246,241,0.92)",
    backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
  },
  backBtn: {
    padding: "10px 16px", borderRadius: 10, border: "1.5px solid #e0dfd8",
    background: "white", color: "#555", fontSize: 14, fontWeight: 600,
    cursor: "pointer", fontFamily: font,
  },
  body: { padding: "4px 16px 40px" },
  name: {
    fontFamily: "'Fraunces', serif", fontSize: 24, margin: 0, color: "#1a1a1a",
    fontWeight: 500, fontStyle: "italic", letterSpacing: "-0.01em", lineHeight: 1.15,
  },
  sectionLabel: {
    fontSize: 13, fontWeight: 700, color: "#8a4a22",
    letterSpacing: "0.04em", textTransform: "uppercase",
    padding: "20px 2px 8px",
  },
  card: {
    background: "white", borderRadius: 14, overflow: "hidden",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
  },
  ingRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" },
  textBlock: { padding: "14px 16px", fontSize: 14, color: "#333", lineHeight: 1.65, whiteSpace: "pre-wrap" },
  sourceLink: {
    display: "block", marginTop: 20, padding: "14px", borderRadius: 12,
    background: "white", border: "1.5px solid #e0dfd8", textAlign: "center",
    color: "#8a4a22", fontSize: 14, fontWeight: 700, textDecoration: "none",
  },
};
