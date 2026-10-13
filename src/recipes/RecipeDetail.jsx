import { useState } from "react";
import { COOK_METHODS, SEASONS, byKey } from "./constants.js";
import { usageLabel, formatQty, formatMinutes } from "./utils.js";
import { SECTION_ICONS } from "../sections.js";
import RecipeTags, { RecipeThumb, Tag } from "./RecipeTags.jsx";
import { ui, font, BROWN, useBodyScrollLock } from "./ui.js";

const M = byKey(COOK_METHODS);
const S = byKey(SEASONS);

export default function RecipeDetail({ recipe, usage, onClose, onEdit, onDelete }) {
  useBodyScrollLock();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]           = useState(false);

  // On success the recipe vanishes from the live list, which closes this sheet.
  const doDelete = async () => {
    setDeleting(true);
    if (!(await onDelete())) setDeleting(false);
  };

  const ingredients = recipe.ingredients || [];
  const facts = [
    recipe.total_minutes ? `⏱ ${formatMinutes(recipe.total_minutes)}` : null,
    recipe.servings ? `🍽 Serves ${recipe.servings}` : null,
  ].filter(Boolean);

  return (
    <div className="sheet-anim" style={ui.sheet}>
      <div style={ui.topBar}>
        <button className="secondary-btn" onClick={onClose} style={ui.backBtn}>← Recipes</button>
        <button className="secondary-btn" onClick={onEdit} style={{ ...ui.backBtn, color: BROWN }}>✏️ Edit</button>
      </div>

      <div style={ui.body}>
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
        <div style={ui.sectionLabel}>Ingredients</div>
        <div style={ui.card}>
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
            <div style={ui.sectionLabel}>Instructions</div>
            <div style={{ ...ui.card, ...styles.textBlock }}>{recipe.instructions}</div>
          </>
        )}

        {recipe.notes && (
          <>
            <div style={ui.sectionLabel}>Notes</div>
            <div style={{ ...ui.card, ...styles.textBlock, background: "#FFFBEF" }}>{recipe.notes}</div>
          </>
        )}

        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>
            View original recipe ↗
          </a>
        )}

        <button className="secondary-btn" onClick={() => setConfirmDelete(true)} style={styles.deleteBtn}>
          🗑️ Delete recipe
        </button>
      </div>

      {confirmDelete && (
        <div className="overlay-anim" style={styles.overlay} onClick={() => !deleting && setConfirmDelete(false)}>
          <div className="modal-anim" style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🗑️</div>
            <h3 style={styles.modalTitle}>Delete this recipe?</h3>
            <p style={styles.modalBody}>
              "{recipe.name}" and its "made it" history will be removed from both phones. This can't be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="secondary-btn" onClick={() => setConfirmDelete(false)} disabled={deleting}
                style={styles.modalCancel}>Cancel</button>
              <button className="primary-btn" onClick={doDelete} disabled={deleting}
                style={styles.modalConfirm}>{deleting ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  name: {
    fontFamily: "'Fraunces', serif", fontSize: 24, margin: 0, color: "#1a1a1a",
    fontWeight: 500, fontStyle: "italic", letterSpacing: "-0.01em", lineHeight: 1.15,
  },
  ingRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" },
  textBlock: { padding: "14px 16px", fontSize: 14, color: "#333", lineHeight: 1.65, whiteSpace: "pre-wrap" },
  sourceLink: {
    display: "block", marginTop: 20, padding: "14px", borderRadius: 12,
    background: "white", border: "1.5px solid #e0dfd8", textAlign: "center",
    color: BROWN, fontSize: 14, fontWeight: 700, textDecoration: "none",
  },
  deleteBtn: {
    display: "block", width: "100%", marginTop: 28, padding: "14px", borderRadius: 12,
    border: "1.5px solid #f0d4d0", background: "transparent",
    color: "#b3261e", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: font,
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20,
  },
  modal: {
    background: "white", borderRadius: 20, padding: "28px 24px",
    maxWidth: 320, width: "100%", textAlign: "center",
    boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
  },
  modalTitle: {
    margin: "0 0 10px", fontSize: 18,
    fontFamily: "'Fraunces', serif", fontWeight: 500, fontStyle: "italic", color: "#1a1a1a",
  },
  modalBody: { fontSize: 13, color: "#888", margin: "0 0 22px", lineHeight: 1.6 },
  modalCancel: {
    flex: 1, padding: "12px", borderRadius: 10,
    border: "1.5px solid #e0dfd8", background: "white",
    color: "#888", fontSize: 14, cursor: "pointer", fontFamily: font,
  },
  modalConfirm: {
    flex: 1, padding: "12px", borderRadius: 10, border: "none",
    background: "#b3261e", color: "white", fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: font,
  },
};
