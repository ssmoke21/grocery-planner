import { useState, useEffect, useCallback, useRef } from "react";
import { sbFetch } from "./supabase.js";

const SECTION_ORDER = [
  "Produce", "Meat & Seafood", "Dairy & Eggs", "Bakery", "Pantry",
  "Frozen", "Snacks", "Toddler", "Deli", "Household", "Recipe Items",
];

const SECTION_ICONS = {
  Produce: "🥬", "Meat & Seafood": "🥩", "Dairy & Eggs": "🥛",
  Bakery: "🍞", Pantry: "🥫", Frozen: "🧊", Snacks: "🍿",
  Toddler: "👶", Deli: "🧀", Household: "🏠", "Recipe Items": "🍳",
};

const FREQ_COLORS = {
  weekly: { bg: "#E8F5E9", text: "#2E7D32" },
  most: { bg: "#E3F2FD", text: "#1565C0" },
  regular: { bg: "#FFF3E0", text: "#E65100" },
};
const FREQ_LABEL = { weekly: "weekly", most: "most wks", regular: "2-3 wks" };

export default function App() {
  const [items, setItems] = useState([]);
  const [mode, setMode] = useState("plan");
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState({});
  const [editQty, setEditQty] = useState(null);
  const [qtyInput, setQtyInput] = useState("");
  const [unitInput, setUnitInput] = useState("");
  const [addingTo, setAddingTo] = useState(null);
  const [newItem, setNewItem] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const loadData = useCallback(async () => {
    try {
      const [itemsData, stateData] = await Promise.all([
        sbFetch("grocery_items?order=section.asc,sort_order.asc,created_at.asc"),
        sbFetch("app_state?id=eq.1"),
      ]);
      setItems(itemsData || []);
      if (stateData?.[0]) setMode(stateData[0].mode || "plan");
      setError(null);
    } catch (e) {
      setError("Couldn't connect to the database. Check your connection and try again.");
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    pollRef.current = setInterval(loadData, 4000);
    return () => clearInterval(pollRef.current);
  }, [loadData]);

  const updateItem = async (id, updates) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    try {
      await sbFetch(`grocery_items?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSelect = (item) => updateItem(item.id, { is_selected: !item.is_selected });
  const toggleCheck = (item) => updateItem(item.id, { is_checked: !item.is_checked });

  const saveQty = (id) => {
    updateItem(id, { qty: qtyInput, unit: unitInput });
    setEditQty(null);
  };

  const addCustomItem = async (section) => {
    if (!newItem.trim()) return;
    try {
      const result = await sbFetch("grocery_items", {
        method: "POST",
        body: JSON.stringify({
          name: newItem.trim(),
          section,
          is_selected: true,
          is_staple: false,
          source: "manual",
          sort_order: 999,
        }),
      });
      if (result) setItems((prev) => [...prev, ...result]);
      showToast(`Added "${newItem.trim()}"`);
      setNewItem("");
      setAddingTo(null);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteItem = async (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await sbFetch(`grocery_items?id=eq.${id}`, { method: "DELETE" });
    } catch (e) {
      console.error(e);
    }
  };

  const startShopping = async () => {
    const sel = items.filter((i) => i.is_selected && i.is_checked);
    for (const item of sel) {
      await updateItem(item.id, { is_checked: false });
    }
    setMode("shop");
    try {
      await sbFetch("app_state?id=eq.1", {
        method: "PATCH",
        body: JSON.stringify({ mode: "shop", updated_at: new Date().toISOString() }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const backToPlan = async () => {
    setMode("plan");
    try {
      await sbFetch("app_state?id=eq.1", {
        method: "PATCH",
        body: JSON.stringify({ mode: "plan", updated_at: new Date().toISOString() }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const newWeek = async () => {
    setShowConfirm(false);
    setLoading(true);
    try {
      const sel = items.filter((i) => i.is_selected);
      if (sel.length > 0) {
        const rows = sel.map((i) => ({
          item_name: i.name,
          section: i.section,
          qty: i.qty || "",
          unit: i.unit || "",
          week_of: new Date().toISOString().split("T")[0],
          was_purchased: !!i.is_checked,
        }));
        await sbFetch("shopping_history", {
          method: "POST",
          body: JSON.stringify(rows),
        });
      }
      await sbFetch("grocery_items?is_staple=eq.false", { method: "DELETE" });
      await sbFetch("grocery_items?is_staple=eq.true", {
        method: "PATCH",
        body: JSON.stringify({ is_selected: false, is_checked: false }),
      });
      await sbFetch("app_state?id=eq.1", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "plan",
          week_of: new Date().toISOString().split("T")[0],
        }),
      });
      showToast("Fresh week started!");
      await loadData();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // Build sections
  const sectionMap = {};
  items.forEach((item) => {
    if (!sectionMap[item.section]) sectionMap[item.section] = [];
    sectionMap[item.section].push(item);
  });

  const allSections = SECTION_ORDER
    .filter((s) => sectionMap[s]?.length > 0)
    .map((s) => ({ section: s, items: sectionMap[s].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) }));

  // Add extra sections not in order
  Object.keys(sectionMap).forEach((s) => {
    if (!SECTION_ORDER.includes(s)) {
      allSections.push({ section: s, items: sectionMap[s] });
    }
  });

  const selectedItems = items.filter((i) => i.is_selected);
  const checkedItems = selectedItems.filter((i) => i.is_checked);
  const shopSections = allSections
    .map((s) => ({ ...s, items: s.items.filter((i) => i.is_selected) }))
    .filter((s) => s.items.length > 0);

  // ---- RENDER ----

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
        <div style={{ color: "#888" }}>Loading your grocery list...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.loadingScreen}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <div style={{ color: "#c44", marginBottom: 16 }}>{error}</div>
        <button onClick={loadData} style={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap"
        rel="stylesheet"
      />

      {/* HEADER */}
      <div style={{
        ...styles.header,
        background: mode === "plan"
          ? "linear-gradient(135deg, #2D5016 0%, #4A7C24 100%)"
          : "linear-gradient(135deg, #1B3A5C 0%, #2E6EA6 100%)",
      }}>
        <div style={styles.headerTop}>
          <div>
            <h1 style={styles.title}>
              {mode === "plan" ? "📋 Plan Your List" : "🛒 Shopping Mode"}
            </h1>
            <div style={styles.subtitle}>
              {mode === "plan"
                ? `${selectedItems.length} items selected`
                : `${checkedItems.length} of ${selectedItems.length} grabbed`}
            </div>
          </div>
          <div style={styles.modePills}>
            <button
              onClick={backToPlan}
              style={{
                ...styles.modePill,
                background: mode === "plan" ? "rgba(255,255,255,0.3)" : "transparent",
              }}
            >Plan</button>
            <button
              onClick={() => { if (mode === "plan") startShopping(); }}
              style={{
                ...styles.modePill,
                background: mode === "shop" ? "rgba(255,255,255,0.3)" : "transparent",
              }}
            >Shop</button>
          </div>
        </div>
        {mode === "shop" && selectedItems.length > 0 && (
          <div style={styles.progressBg}>
            <div style={{
              ...styles.progressFill,
              width: `${(checkedItems.length / selectedItems.length) * 100}%`,
            }} />
          </div>
        )}
      </div>

      {/* PLAN MODE */}
      {mode === "plan" && (
        <div style={styles.content}>
          <p style={styles.hint}>
            Toggle items you need this week. Tap the quantity to adjust. Hit <strong>Shop</strong> when ready.
          </p>

          {allSections.map(({ section, items: sectionItems }) => {
            const isCollapsed = collapsed[section];
            const selCount = sectionItems.filter((i) => i.is_selected).length;

            return (
              <div key={section} style={{ marginBottom: 4 }}>
                {/* Section header */}
                <button
                  onClick={() => setCollapsed((p) => ({ ...p, [section]: !p[section] }))}
                  style={styles.sectionHeader}
                >
                  <span style={styles.sectionTitle}>
                    {SECTION_ICONS[section] || "📦"} {section}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {selCount > 0 && <span style={styles.badge}>{selCount}</span>}
                    <span style={{
                      ...styles.chevron,
                      transform: isCollapsed ? "rotate(-90deg)" : "rotate(0)",
                    }}>▼</span>
                  </span>
                </button>

                {!isCollapsed && (
                  <div style={styles.card}>
                    {sectionItems.map((item, idx) => {
                      const isOn = item.is_selected;
                      const fc = FREQ_COLORS[item.freq];

                      return (
                        <div
                          key={item.id}
                          style={{
                            ...styles.itemRow,
                            borderBottom: idx < sectionItems.length - 1 ? "1px solid #f2f1ea" : "none",
                            background: isOn ? "#f0f7e8" : "white",
                          }}
                        >
                          {/* Toggle */}
                          <button onClick={() => toggleSelect(item)} style={{
                            ...styles.toggle,
                            background: isOn ? "#4A7C24" : "#ddd",
                          }}>
                            <div style={{
                              ...styles.toggleKnob,
                              left: isOn ? 19 : 3,
                            }} />
                          </button>

                          {/* Name */}
                          <span style={{
                            flex: 1, fontSize: 14,
                            color: isOn ? "#333" : "#999",
                            fontWeight: isOn ? 500 : 400,
                          }}>{item.name}</span>

                          {/* Qty editor */}
                          {isOn && (
                            editQty === item.id ? (
                              <div style={styles.qtyEditor} onClick={(e) => e.stopPropagation()}>
                                <input
                                  autoFocus
                                  value={qtyInput}
                                  onChange={(e) => setQtyInput(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && saveQty(item.id)}
                                  style={styles.qtyInputSmall}
                                />
                                <input
                                  value={unitInput}
                                  onChange={(e) => setUnitInput(e.target.value)}
                                  placeholder="unit"
                                  onKeyDown={(e) => e.key === "Enter" && saveQty(item.id)}
                                  style={styles.unitInputSmall}
                                />
                                <button onClick={() => saveQty(item.id)} style={styles.qtyConfirm}>✓</button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditQty(item.id);
                                  setQtyInput(item.qty || "");
                                  setUnitInput(item.unit || "");
                                }}
                                style={styles.qtyPill}
                              >
                                {item.qty && item.unit ? `${item.qty} ${item.unit}` :
                                  item.qty || item.unit || "qty"}
                              </button>
                            )
                          )}

                          {/* Freq badge */}
                          {fc && !isOn && (
                            <span style={{
                              fontSize: 10, padding: "2px 7px", borderRadius: 10,
                              background: fc.bg, color: fc.text, fontWeight: 600,
                              marginLeft: 6, whiteSpace: "nowrap",
                            }}>{FREQ_LABEL[item.freq]}</span>
                          )}

                          {/* Staple toggle */}
                          <button
                            onClick={(e) => { e.stopPropagation(); updateItem(item.id, { is_staple: !item.is_staple }); }}
                            title={item.is_staple ? "Remove from staples" : "Make a staple"}
                            style={{
                              ...styles.stapleBtn,
                              color: item.is_staple ? "#D4A017" : "#ccc",
                            }}
                          >📌</button>

                          {/* Delete item */}
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                            style={styles.deleteBtn}
                          >×</button>
                        </div>
                      );
                    })}

                    {/* Add item */}
                    {addingTo === section ? (
                      <div style={styles.addRow}>
                        <input
                          autoFocus
                          value={newItem}
                          onChange={(e) => setNewItem(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addCustomItem(section)}
                          placeholder="Item name..."
                          style={styles.addInput}
                        />
                        <button onClick={() => addCustomItem(section)} style={styles.addBtn}>Add</button>
                        <button onClick={() => { setAddingTo(null); setNewItem(""); }} style={styles.cancelBtn}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setAddingTo(section)} style={styles.addTrigger}>+ Add item</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* SHOP MODE */}
      {mode === "shop" && (
        <div style={styles.content}>
          {selectedItems.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <p style={{ fontSize: 15 }}>No items selected!</p>
              <p style={{ fontSize: 13 }}>Switch to <strong>Plan</strong> to build your list.</p>
            </div>
          ) : (
            shopSections.map(({ section, items: sectionItems }) => {
              const allDone = sectionItems.every((i) => i.is_checked);
              return (
                <div key={section} style={{ marginBottom: 6 }}>
                  <div style={{ padding: "12px 4px 6px" }}>
                    <span style={{
                      fontSize: 14, fontWeight: 700,
                      color: allDone ? "#aaa" : "#1B3A5C",
                    }}>
                      {SECTION_ICONS[section] || "📦"} {section}
                      {allDone && " ✓"}
                    </span>
                  </div>
                  <div style={{
                    ...styles.card,
                    opacity: allDone ? 0.5 : 1,
                    transition: "opacity 0.3s",
                  }}>
                    {sectionItems.map((item, idx) => {
                      const isDone = item.is_checked;
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleCheck(item)}
                          style={{
                            display: "flex", alignItems: "center",
                            padding: "15px 14px", cursor: "pointer",
                            borderBottom: idx < sectionItems.length - 1 ? "1px solid #f2f1ea" : "none",
                            background: isDone ? "#f8f8f4" : "white",
                          }}
                        >
                          <div style={{
                            width: 28, height: 28, borderRadius: 8,
                            border: isDone ? "2px solid #2E6EA6" : "2px solid #ccc",
                            background: isDone ? "#2E6EA6" : "white",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            marginRight: 14, flexShrink: 0,
                          }}>
                            {isDone && (
                              <svg width="14" height="11" viewBox="0 0 13 10" fill="none">
                                <path d="M1 5L4.5 8.5L12 1" stroke="white" strokeWidth="2.5"
                                  strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span style={{
                            flex: 1, fontSize: 16,
                            color: isDone ? "#bbb" : "#222",
                            textDecoration: isDone ? "line-through" : "none",
                            fontWeight: isDone ? 400 : 500,
                          }}>{item.name}</span>
                          {(item.qty || item.unit) && (
                            <span style={{
                              fontSize: 13, color: isDone ? "#ccc" : "#666",
                              fontWeight: 600, whiteSpace: "nowrap",
                            }}>{item.qty} {item.unit}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {checkedItems.length === selectedItems.length && selectedItems.length > 0 && (
            <div style={styles.celebration}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#2D5016", margin: 0 }}>All done!</p>
              <p style={{ fontSize: 13, color: "#555", marginTop: 4 }}>Great shopping trip.</p>
            </div>
          )}
        </div>
      )}

      {/* BOTTOM BAR */}
      <div style={styles.bottomBar}>
        {mode === "plan" ? (
          <>
            <button onClick={() => setShowConfirm(true)} style={styles.secondaryBtn}>New Week</button>
            <button onClick={startShopping} style={{
              ...styles.primaryBtn,
              background: selectedItems.length > 0
                ? "linear-gradient(135deg, #1B3A5C, #2E6EA6)" : "#ccc",
            }}>Start Shopping →</button>
          </>
        ) : (
          <>
            <button onClick={backToPlan} style={styles.secondaryBtn}>← Edit List</button>
            <button onClick={() => {
              const txt = selectedItems
                .filter((i) => !i.is_checked)
                .map((i) => `${i.qty || ""} ${i.unit || ""} ${i.name}`.trim())
                .join("\n");
              if (navigator.clipboard) {
                navigator.clipboard.writeText(txt);
                showToast("Copied to clipboard!");
              }
            }} style={{
              ...styles.primaryBtn,
              background: "#1B3A5C",
              flex: 1,
            }}>Copy Remaining</button>
          </>
        )}
      </div>

      {/* NEW WEEK MODAL */}
      {showConfirm && (
        <div style={styles.overlay} onClick={() => setShowConfirm(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🔄</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 17, fontFamily: "inherit" }}>Start a new week?</h3>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 20px", lineHeight: 1.5 }}>
              This saves your shopping data for habit tracking, then clears all selections.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} style={styles.modalCancel}>Cancel</button>
              <button onClick={newWeek} style={styles.modalConfirm}>New Week</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "'DM Sans', sans-serif",
    maxWidth: 500,
    margin: "0 auto",
    background: "#FAFAF7",
    minHeight: "100vh",
    paddingBottom: 90,
  },
  loadingScreen: {
    display: "flex", flexDirection: "column", justifyContent: "center",
    alignItems: "center", height: "100vh",
    fontFamily: "'DM Sans', sans-serif", background: "#FAFAF7",
  },
  retryBtn: {
    padding: "10px 24px", borderRadius: 10, border: "none",
    background: "#2D5016", color: "white", fontSize: 14,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  header: {
    padding: "24px 20px 18px", color: "white",
    position: "sticky", top: 0, zIndex: 100,
  },
  headerTop: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
  },
  title: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 24, margin: 0, fontWeight: 400,
  },
  subtitle: { fontSize: 13, opacity: 0.85, marginTop: 4 },
  modePills: {
    display: "flex", background: "rgba(255,255,255,0.15)",
    borderRadius: 20, padding: 3,
  },
  modePill: {
    padding: "6px 14px", borderRadius: 17, border: "none",
    color: "white", fontSize: 12, fontWeight: 600,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  progressBg: {
    height: 5, background: "rgba(255,255,255,0.2)",
    borderRadius: 3, overflow: "hidden", marginTop: 14,
  },
  progressFill: {
    height: "100%", background: "#64B5F6", borderRadius: 3,
    transition: "width 0.3s ease",
  },
  content: { padding: "8px 16px" },
  hint: { fontSize: 13, color: "#888", margin: "8px 0 12px", lineHeight: 1.5 },
  sectionHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    width: "100%", padding: "12px 4px 8px", border: "none",
    background: "transparent", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: "#2D5016" },
  badge: {
    fontSize: 11, background: "#4A7C24", color: "white",
    borderRadius: 10, padding: "1px 8px", fontWeight: 600,
  },
  chevron: {
    fontSize: 10, color: "#bbb", transition: "transform 0.2s", display: "inline-block",
  },
  card: {
    background: "white", borderRadius: 12, overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  itemRow: {
    display: "flex", alignItems: "center", padding: "11px 14px",
  },
  toggle: {
    width: 40, height: 24, borderRadius: 12, border: "none",
    position: "relative", cursor: "pointer",
    marginRight: 12, flexShrink: 0, transition: "background 0.2s",
  },
  toggleKnob: {
    width: 18, height: 18, borderRadius: 9, background: "white",
    position: "absolute", top: 3, transition: "left 0.2s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  },
  qtyEditor: { display: "flex", alignItems: "center", gap: 4 },
  qtyInputSmall: {
    width: 32, border: "1px solid #ccc", borderRadius: 6,
    padding: "4px 6px", fontSize: 13, textAlign: "center",
    fontFamily: "'DM Sans', sans-serif",
  },
  unitInputSmall: {
    width: 50, border: "1px solid #ccc", borderRadius: 6,
    padding: "4px 6px", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
  },
  qtyConfirm: {
    background: "#4A7C24", color: "white", border: "none",
    borderRadius: 6, padding: "4px 8px", fontSize: 12,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  qtyPill: {
    background: "#f0efe8", border: "1px solid #e0dfd8",
    borderRadius: 8, padding: "4px 10px", fontSize: 12,
    color: "#555", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    fontWeight: 500, whiteSpace: "nowrap",
  },
  stapleBtn: {
    background: "none", border: "none",
    fontSize: 14, cursor: "pointer", padding: "0 4px", lineHeight: 1,
    transition: "color 0.2s",
  },
  deleteBtn: {
    background: "none", border: "none", color: "#ccc",
    fontSize: 18, cursor: "pointer", padding: "0 0 0 2px", lineHeight: 1,
  },
  addRow: {
    display: "flex", padding: "8px 14px", gap: 6, borderTop: "1px solid #f2f1ea",
  },
  addInput: {
    flex: 1, border: "1px solid #ddd", borderRadius: 8,
    padding: "8px 10px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none",
  },
  addBtn: {
    background: "#4A7C24", color: "white", border: "none",
    borderRadius: 8, padding: "8px 12px", fontSize: 12,
    fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  cancelBtn: {
    background: "#eee", color: "#666", border: "none",
    borderRadius: 8, padding: "8px 8px", fontSize: 12,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  addTrigger: {
    width: "100%", padding: "10px 14px", border: "none",
    borderTop: "1px solid #f2f1ea", background: "transparent",
    color: "#4A7C24", fontSize: 12, fontWeight: 600,
    cursor: "pointer", textAlign: "left", fontFamily: "'DM Sans', sans-serif",
  },
  emptyState: { textAlign: "center", padding: "60px 20px", color: "#888" },
  celebration: {
    textAlign: "center", padding: "30px 20px",
    background: "linear-gradient(135deg, #E8F5E9, #C8E6C9)",
    borderRadius: 16, margin: "20px 0",
  },
  bottomBar: {
    position: "fixed", bottom: 0, left: 0, right: 0,
    background: "white", borderTop: "1px solid #e8e8e0",
    padding: "10px 16px", display: "flex", gap: 10, justifyContent: "center",
    zIndex: 100, maxWidth: 500, margin: "0 auto",
  },
  secondaryBtn: {
    flex: 1, padding: "12px", borderRadius: 10,
    border: "1px solid #ddd", background: "white",
    color: "#888", fontSize: 13, fontWeight: 600,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  primaryBtn: {
    flex: 2, padding: "12px", borderRadius: 10, border: "none",
    color: "white", fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 200, padding: 20,
  },
  modal: {
    background: "white", borderRadius: 16, padding: 24,
    maxWidth: 320, width: "100%", textAlign: "center",
  },
  modalCancel: {
    flex: 1, padding: "12px", borderRadius: 10,
    border: "1px solid #ddd", background: "white",
    color: "#666", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  modalConfirm: {
    flex: 1, padding: "12px", borderRadius: 10, border: "none",
    background: "#4A7C24", color: "white", fontSize: 14,
    fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  toast: {
    position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)",
    background: "#333", color: "white", padding: "10px 20px",
    borderRadius: 10, fontSize: 14, zIndex: 300,
    fontFamily: "'DM Sans', sans-serif",
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
  },
};
