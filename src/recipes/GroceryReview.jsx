import { useState, useMemo } from "react";
import { combineIngredients, formatAmounts, planGroceryWrites } from "./combine.js";
import { applyGroceryWrites } from "./recipeApi.js";
import { SECTION_ICONS } from "../sections.js";
import { ui, font, useBodyScrollLock } from "./ui.js";

const GREEN = "#4A7C24";

export default function GroceryReview({ recipes, groceryItems, onClose, onAdded, showToast }) {
  useBodyScrollLock();
  const [have, setHave]     = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  const { sections, noIngredients } = useMemo(
    () => combineIngredients(recipes, groceryItems),
    [recipes, groceryItems]
  );
  const allItems  = sections.flatMap((s) => s.items);
  const needItems = allItems.filter((i) => !have.has(i.key));

  const toggle = (key) =>
    setHave((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const setSection = (items, markHave) =>
    setHave((prev) => {
      const next = new Set(prev);
      items.forEach((i) => (markHave ? next.add(i.key) : next.delete(i.key)));
      return next;
    });

  const addToList = async () => {
    setSaving(true);
    try {
      await applyGroceryWrites(planGroceryWrites(needItems));
      const n = needItems.length;
      showToast(`Added ${n} item${n !== 1 ? "s" : ""} to your list`);
      onAdded();
    } catch (e) {
      console.error(e);
      showToast("Couldn't update the list — try again");
      setSaving(false);
    }
  };

  return (
    <div className="sheet-anim" style={{ ...ui.sheet, zIndex: 260, display: "flex", flexDirection: "column" }}>
      <div style={ui.topBar}>
        <button className="secondary-btn" onClick={onClose} style={ui.backBtn}>← Back</button>
        <h2 style={ui.topTitle}>What do we have?</h2>
        <span style={{ width: 60 }} />
      </div>

      <div style={{ ...ui.body, flex: 1 }}>
        <p style={styles.intro}>
          Everything starts as <strong style={{ color: GREEN }}>Need</strong>. Tap anything you already have.
        </p>

        {noIngredients.length > 0 && (
          <div style={styles.notice}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>📝 No ingredients saved — add manually:</div>
            {noIngredients.map((n) => <div key={n}>• {n}</div>)}
          </div>
        )}

        {sections.length === 0 && (
          <p style={{ textAlign: "center", color: "#aaa", fontSize: 14, padding: "40px 0" }}>
            None of these recipes have ingredients saved.
          </p>
        )}

        {sections.map(({ section, items }) => {
          const allHave = items.every((i) => have.has(i.key));
          return (
            <div key={section}>
              <div style={styles.sectionHead}>
                <span>{SECTION_ICONS[section] || "📦"} {section}</span>
                <button onClick={() => setSection(items, !allHave)} style={styles.markAll}>
                  {allHave ? "Mark all need" : "Mark all have"}
                </button>
              </div>
              <div style={ui.card}>
                {items.map((item, idx) => {
                  const isHave = have.has(item.key);
                  const onList = item.existing?.is_selected;
                  return (
                    <button
                      key={item.key}
                      className="item-row-shop"
                      onClick={() => toggle(item.key)}
                      style={{
                        ...styles.row,
                        borderBottom: idx < items.length - 1 ? "1px solid #f0efe8" : "none",
                        background: isHave ? "#f8f8f4" : "white",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, opacity: isHave ? 0.45 : 1 }}>
                        <div style={{
                          fontSize: 15, fontWeight: 600, color: "#222",
                          textDecoration: isHave ? "line-through" : "none",
                        }}>
                          {item.name}
                          {item.amounts.length > 0 && (
                            <span style={styles.amount}> · {formatAmounts(item.amounts)}</span>
                          )}
                        </div>
                        <div style={styles.meta}>
                          for {item.recipes.join(", ")}
                        </div>
                        {onList && (
                          <span style={styles.onList}>
                            📋 Already on list{item.existing.qty || item.existing.unit
                              ? ` (${[item.existing.qty, item.existing.unit].filter(Boolean).join(" ")})` : ""}
                          </span>
                        )}
                      </div>
                      <span style={{
                        ...styles.pill,
                        background: isHave ? "#eceae2" : GREEN,
                        color: isHave ? "#888" : "white",
                      }}>{isHave ? "Have" : "Need"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={styles.footer}>
        <button
          className="primary-btn"
          onClick={addToList}
          disabled={saving || needItems.length === 0}
          style={{ ...styles.addBtn, opacity: needItems.length ? 1 : 0.45 }}
        >
          {saving ? "Adding…"
            : needItems.length ? `Add ${needItems.length} item${needItems.length !== 1 ? "s" : ""} to list`
            : "Nothing to add"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  intro: { fontSize: 14, color: "#666", margin: "2px 2px 6px", lineHeight: 1.5 },
  notice: {
    marginTop: 10, padding: "12px 14px", borderRadius: 12,
    background: "#FFF6DD", color: "#6b5310", fontSize: 13, lineHeight: 1.6,
  },
  sectionHead: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "18px 2px 8px",
    fontSize: 13, fontWeight: 700, color: "#3a5c1a",
    letterSpacing: "0.04em", textTransform: "uppercase",
  },
  markAll: {
    border: "none", background: "transparent", color: "#8a8478",
    fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: font,
    padding: "6px 4px", textTransform: "none", letterSpacing: 0,
  },
  row: {
    display: "flex", alignItems: "center", gap: 12, width: "100%",
    padding: "13px 14px", border: "none", textAlign: "left",
    cursor: "pointer", fontFamily: font,
  },
  amount: { fontWeight: 600, color: "#888", fontSize: 13 },
  meta: { fontSize: 12, color: "#a0998a", marginTop: 3 },
  onList: {
    display: "inline-block", marginTop: 6, fontSize: 11, fontWeight: 700,
    padding: "3px 8px", borderRadius: 10, background: "#E3F2FD", color: "#1565C0",
  },
  pill: {
    flexShrink: 0, minWidth: 54, textAlign: "center",
    padding: "7px 12px", borderRadius: 16, fontSize: 12, fontWeight: 700,
    transition: "background 0.15s ease, color 0.15s ease",
  },
  footer: {
    position: "sticky", bottom: 0, padding: "10px 16px 16px",
    background: "rgba(247,246,241,0.92)",
    backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
    borderTop: "1px solid rgba(0,0,0,0.07)",
  },
  addBtn: {
    width: "100%", padding: "15px", borderRadius: 12, border: "none",
    background: "linear-gradient(135deg, #2D5016 0%, #4A7C24 100%)",
    color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
};
