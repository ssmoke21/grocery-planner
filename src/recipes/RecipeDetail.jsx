import { useState } from "react";
import { COOK_METHODS, SEASONS, MEALS, byKey } from "./constants.js";
import { formatQty, formatMinutes, formatShortDate } from "./utils.js";
import { SECTION_ICONS } from "../sections.js";
import RecipeTags, { RecipeThumb, Tag, UsageLine } from "./RecipeTags.jsx";
import CookMode from "./CookMode.jsx";
import { rateRecipe } from "./recipeApi.js";
import { HouseholdAvatar } from "../Flair.jsx";
import { ui, font, BROWN, useBodyScrollLock, useBackToClose } from "./ui.js";

const M = byKey(COOK_METHODS);
const S = byKey(SEASONS);
const ML = byKey(MEALS);

export default function RecipeDetail({
  recipe, usage, onClose, onEdit, onDelete,
  backLabel = "← Recipes", planned, planLabel = "this week", onTogglePlan,
  ownerName, onCopy, hasCopy, othersWhoMade = [], zIndex = 250,
  myId, scale: startScale = 1, onScaleChange,
}) {
  useBodyScrollLock();
  useBackToClose(onClose);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [scale, setScale]                 = useState(startScale);
  const [cooking, setCooking]             = useState(false);

  const myRating = myId ? recipe.ratings?.[myId] : null;
  const otherRatings = Object.entries(recipe.ratings || {}).filter(([id]) => id !== myId).map(([, n]) => n);
  const otherAvg = otherRatings.length
    ? Math.round((otherRatings.reduce((a, b) => a + b, 0) / otherRatings.length) * 10) / 10
    : null;
  const rate = (n) => rateRecipe(recipe.id, myId, n === myRating ? null : n).catch(console.error);

  // Servings when the recipe has them; otherwise a plain multiplier.
  const base = recipe.servings || null;
  const changeScale = (dir) => {
    const next = base
      ? Math.max(1, Math.round(base * scale) + dir) / base
      : Math.max(0.5, scale + dir * 0.5);
    setScale(next);
    onScaleChange?.(next);
  };

  // On success the recipe vanishes from the live list, which closes this sheet.
  const doDelete = async () => {
    setDeleting(true);
    if (!(await onDelete())) setDeleting(false);
  };

  const ingredients = recipe.ingredients || [];
  const shownQty = (ing) => formatQty(typeof ing.qty === "number" ? ing.qty * scale : ing.qty, ing.unit);
  const facts = [
    recipe.total_minutes ? `⏱ ${formatMinutes(recipe.total_minutes)}` : null,
    recipe.servings ? `🍽 Serves ${recipe.servings}` : null,
  ].filter(Boolean);

  return (
    <div className="sheet-anim" style={{ ...ui.sheet, zIndex }}>
      <div style={ui.topBar}>
        <button className="secondary-btn" onClick={onClose} style={ui.backBtn}>{backLabel}</button>
        {onEdit && (
          <button className="secondary-btn" onClick={onEdit} style={{ ...ui.backBtn, color: BROWN }}>✏️ Edit</button>
        )}
      </div>

      <div style={ui.body}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
          <RecipeThumb recipe={recipe} size={72} />
          <div style={{ minWidth: 0 }}>
            <h2 style={styles.name}>{recipe.name}</h2>
            <UsageLine usage={usage} style={{ marginTop: 4 }} />
            {ownerName && <div style={styles.from}>from {ownerName}</div>}
          </div>
        </div>

        <RecipeTags recipe={recipe} />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
          {recipe.meals?.filter((m) => m !== "side" && m !== "dessert").map((m) => ML[m] && <Tag key={m}>{ML[m].icon} {ML[m].label}</Tag>)}
          {facts.map((f) => <Tag key={f}>{f}</Tag>)}
          {recipe.cook_methods?.map((m) => M[m] && <Tag key={m}>{M[m].label}</Tag>)}
          {recipe.seasons?.length
            ? recipe.seasons.map((s) => S[s] && <Tag key={s}>{S[s].icon} {S[s].label}</Tag>)
            : <Tag>🗓 Year-round</Tag>}
        </div>

        {myId && (
          <div style={styles.ratingRow}>
            <div>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => rate(n)}
                  aria-label={`Rate ${n} star${n !== 1 ? "s" : ""}`}
                  style={{ ...styles.star, color: n <= (myRating || 0) ? "var(--fg-e0a100)" : "var(--fg-d8d5ca)" }}
                >★</button>
              ))}
            </div>
            <span style={styles.ratingNote}>
              {myRating ? "Your rating" : "Tap to rate"}
              {otherAvg ? ` · others ★${otherAvg}` : ""}
            </span>
          </div>
        )}

        <button className="primary-btn" onClick={() => setCooking(true)} style={styles.cookBtn}>
          👩‍🍳 Cook mode
        </button>

        {onCopy && (
          <button className="secondary-btn" onClick={onCopy} style={styles.copyBtn}>
            {hasCopy ? "✓ You have a copy · open it" : "📋 Save a copy to my recipes"}
          </button>
        )}
        {onCopy && !hasCopy && (
          <p style={styles.copyHint}>Only {ownerName || "its owner"} can edit this one. A copy is yours to change.</p>
        )}

        {onTogglePlan && (
          <button
            className="primary-btn"
            onClick={() => onTogglePlan(scale)}
            style={{
              ...styles.planBtn,
              background: planned ? "var(--bg-eef6f4)" : "linear-gradient(135deg, var(--bg-1f4d47) 0%, var(--bg-2f6b63) 100%)",
              color: planned ? "var(--fg-2f6b63)" : "var(--fg-ffffff)",
              border: planned ? "1.5px solid color-mix(in srgb, var(--ln-2f6b63) 33%, transparent)" : "none",
            }}
          >{planned ? `✓ On ${planLabel}'s plan · tap to remove` : `＋ Add to ${planLabel}`}</button>
        )}

        {/* ── Ingredients ── */}
        <div style={styles.ingHead}>
          <div style={{ ...ui.sectionLabel, padding: 0 }}>Ingredients</div>
          {ingredients.length > 0 && (
            <div style={styles.stepper}>
              <button onClick={() => changeScale(-1)} aria-label="Fewer" style={styles.stepBtn}>−</button>
              <span style={styles.stepValue}>
                {base ? `Serves ${Math.round(base * scale)}` : `×${Math.round(scale * 100) / 100}`}
              </span>
              <button onClick={() => changeScale(1)} aria-label="More" style={styles.stepBtn}>+</button>
            </div>
          )}
        </div>
        <div style={ui.card}>
          {ingredients.length === 0 ? (
            <div style={{ padding: "14px 16px", fontSize: 13, color: "var(--fg-aaaaaa)" }}>No ingredients saved.</div>
          ) : ingredients.map((ing, idx) => (
            <div key={idx} style={{
              ...styles.ingRow,
              borderBottom: idx < ingredients.length - 1 ? "1px solid var(--ln-f0efe8)" : "none",
            }}>
              <span style={{ fontSize: 15, flexShrink: 0 }} title={ing.section}>
                {SECTION_ICONS[ing.section] || "📦"}
              </span>
              <span style={{ flex: 1, fontSize: 14, color: "var(--fg-222222)", fontWeight: 500 }}>{ing.name}</span>
              {shownQty(ing) && (
                <span style={{ fontSize: 13, color: "var(--fg-888888)", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {shownQty(ing)}
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
            <div style={{ ...ui.card, ...styles.textBlock, background: "var(--bg-fffbef)" }}>{recipe.notes}</div>
          </>
        )}

        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>
            View original recipe ↗
          </a>
        )}

        {othersWhoMade.length > 0 && (
          <>
            <div style={ui.sectionLabel}>🔥 Who else makes it</div>
            <div style={ui.card}>
              {othersWhoMade.map((o, idx) => (
                <div key={o.id} style={{
                  ...styles.ingRow,
                  borderBottom: idx < othersWhoMade.length - 1 ? "1px solid var(--ln-f0efe8)" : "none",
                }}>
                  <HouseholdAvatar profile={o.profile} size={28} />
                  <span style={{ flex: 1, fontSize: 14, color: "var(--fg-222222)", fontWeight: 600 }}>{o.name}</span>
                  <span style={{ fontSize: 12, color: "var(--fg-888888)", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {o.count}× · last {formatShortDate(o.last)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {usage?.weeks?.length > 0 && (
          <>
            <div style={ui.sectionLabel}>Weeks made</div>
            <div style={styles.history}>
              {usage.weeks.map((w, i) => <Tag key={w + i}>{formatShortDate(w)}</Tag>)}
            </div>
          </>
        )}

        {onDelete && (
          <button className="secondary-btn" onClick={() => setConfirmDelete(true)} style={styles.deleteBtn}>
            🗑️ Delete recipe
          </button>
        )}
      </div>

      {cooking && <CookMode recipe={recipe} scale={scale} myId={myId} onClose={() => setCooking(false)} />}

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
    fontFamily: "'Fraunces', serif", fontSize: 24, margin: 0, color: "var(--fg-1a1a1a)",
    fontWeight: 500, fontStyle: "italic", letterSpacing: "-0.01em", lineHeight: 1.15,
  },
  history: { display: "flex", flexWrap: "wrap", gap: 6 },
  from: { fontSize: 12, color: "var(--fg-a0998a)", marginTop: 3, fontWeight: 500 },
  copyBtn: {
    display: "block", width: "100%", marginTop: 16, padding: "13px", borderRadius: 12,
    border: `1.5px solid color-mix(in srgb, ${BROWN} 33%, transparent)`, background: "var(--bg-ffffff)", color: BROWN,
    fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
  copyHint: { fontSize: 12, color: "var(--fg-a0998a)", margin: "6px 2px 0", textAlign: "center" },
  ratingRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12 },
  star: { width: 36, height: 40, padding: 0, border: "none", background: "transparent", fontSize: 28, lineHeight: 1, cursor: "pointer" },
  ratingNote: { fontSize: 12, color: "var(--fg-a0998a)", fontWeight: 500, textAlign: "right" },
  cookBtn: {
    display: "block", width: "100%", marginTop: 12, padding: "14px", borderRadius: 12, border: "none",
    background: "var(--bg-16211d)", color: "var(--fg-f3f1e8)", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
  ingHead: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 2px 8px" },
  stepper: { display: "flex", alignItems: "center", gap: 2, background: "var(--bg-ffffff)", border: "1.5px solid var(--ln-e4e2d8)", borderRadius: 10 },
  stepBtn: { width: 40, height: 38, border: "none", background: "transparent", fontSize: 20, color: BROWN, cursor: "pointer", fontFamily: font },
  stepValue: { minWidth: 66, textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--fg-444444)" },
  planBtn: {
    display: "block", width: "100%", marginTop: 16, padding: "14px", borderRadius: 12,
    fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
  ingRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" },
  textBlock: { padding: "14px 16px", fontSize: 14, color: "var(--fg-333333)", lineHeight: 1.65, whiteSpace: "pre-wrap" },
  sourceLink: {
    display: "block", marginTop: 20, padding: "14px", borderRadius: 12,
    background: "var(--bg-ffffff)", border: "1.5px solid var(--ln-e0dfd8)", textAlign: "center",
    color: BROWN, fontSize: 14, fontWeight: 700, textDecoration: "none",
  },
  deleteBtn: {
    display: "block", width: "100%", marginTop: 28, padding: "14px", borderRadius: 12,
    border: "1.5px solid var(--ln-f0d4d0)", background: "transparent",
    color: "var(--fg-b3261e)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: font,
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20,
  },
  modal: {
    background: "var(--bg-ffffff)", borderRadius: 20, padding: "28px 24px",
    maxWidth: 320, width: "100%", textAlign: "center",
    boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
  },
  modalTitle: {
    margin: "0 0 10px", fontSize: 18,
    fontFamily: "'Fraunces', serif", fontWeight: 500, fontStyle: "italic", color: "var(--fg-1a1a1a)",
  },
  modalBody: { fontSize: 13, color: "var(--fg-888888)", margin: "0 0 22px", lineHeight: 1.6 },
  modalCancel: {
    flex: 1, padding: "12px", borderRadius: 10,
    border: "1.5px solid var(--ln-e0dfd8)", background: "var(--bg-ffffff)",
    color: "var(--fg-888888)", fontSize: 14, cursor: "pointer", fontFamily: font,
  },
  modalConfirm: {
    flex: 1, padding: "12px", borderRadius: 10, border: "none",
    background: "var(--bg-b3261e)", color: "var(--fg-ffffff)", fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: font,
  },
};
