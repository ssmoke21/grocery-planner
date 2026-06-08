import { useState, useEffect, useRef } from "react";
import { db } from "./firebase.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  writeBatch, onSnapshot, serverTimestamp,
} from "firebase/firestore";
import "./App.css";

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
  most:   { bg: "#E3F2FD", text: "#1565C0" },
  regular:{ bg: "#FFF3E0", text: "#E65100" },
};
const FREQ_LABEL = { weekly: "weekly", most: "most wks", regular: "2-3 wks" };

export default function App() {
  const [items, setItems]             = useState([]);
  const [mode, setMode]               = useState("plan");
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [collapsed, setCollapsed]     = useState({});
  const [editQty, setEditQty]         = useState(null);
  const [qtyInput, setQtyInput]       = useState("");
  const [unitInput, setUnitInput]     = useState("");
  const [addingTo, setAddingTo]       = useState(null);
  const [newItem, setNewItem]         = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast]             = useState(null);

  // Track when both listeners have fired at least once
  const loadedRef = useRef({ items: false, state: false });
  const checkLoaded = () => {
    if (loadedRef.current.items && loadedRef.current.state) setLoading(false);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  // ── Real-time listeners (replaces polling) ──────────────────
  useEffect(() => {
    const itemsUnsub = onSnapshot(
      collection(db, "grocery_items"),
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setError(null);
        loadedRef.current.items = true;
        checkLoaded();
      },
      (err) => {
        console.error(err);
        setError("Couldn't connect. Check your connection and try again.");
        setLoading(false);
      }
    );

    const stateUnsub = onSnapshot(
      doc(db, "app_state", "main"),
      (snap) => {
        if (snap.exists()) setMode(snap.data().mode || "plan");
        loadedRef.current.state = true;
        checkLoaded();
      },
      (err) => {
        console.error(err);
        // Non-fatal — app still works without state doc
        loadedRef.current.state = true;
        checkLoaded();
      }
    );

    return () => { itemsUnsub(); stateUnsub(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data operations ─────────────────────────────────────────

  const updateItem = async (id, updates) => {
    // Optimistic update for instant UI response
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    try {
      await updateDoc(doc(db, "grocery_items", id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (e) { console.error(e); }
  };

  const toggleSelect = (item) => updateItem(item.id, { is_selected: !item.is_selected });
  const toggleCheck  = (item) => updateItem(item.id, { is_checked:  !item.is_checked  });

  const saveQty = (id) => {
    updateItem(id, { qty: qtyInput, unit: unitInput });
    setEditQty(null);
  };

  const addCustomItem = async (section) => {
    if (!newItem.trim()) return;
    try {
      await addDoc(collection(db, "grocery_items"), {
        name: newItem.trim(),
        section,
        is_selected: true,
        is_staple: false,
        source: "manual",
        sort_order: 999,
        createdAt: serverTimestamp(),
      });
      showToast(`Added "${newItem.trim()}"`);
      setNewItem("");
      setAddingTo(null);
    } catch (e) { console.error(e); }
  };

  const deleteItem = async (id) => {
    // Optimistic removal
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await deleteDoc(doc(db, "grocery_items", id));
    } catch (e) { console.error(e); }
  };

  const startShopping = async () => {
    try {
      const batch = writeBatch(db);
      // Uncheck any already-checked items before entering shop mode
      items.filter((i) => i.is_selected && i.is_checked).forEach((i) => {
        batch.update(doc(db, "grocery_items", i.id), { is_checked: false });
      });
      batch.set(doc(db, "app_state", "main"), { mode: "shop" }, { merge: true });
      await batch.commit();
      setMode("shop");
    } catch (e) { console.error(e); }
  };

  const backToPlan = async () => {
    try {
      await updateDoc(doc(db, "app_state", "main"), { mode: "plan" });
      setMode("plan");
    } catch (e) { console.error(e); }
  };

  const newWeek = async () => {
    setShowConfirm(false);
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const weekOf = new Date().toISOString().split("T")[0];

      // Save shopping history
      const sel = items.filter((i) => i.is_selected);
      sel.forEach((i) => {
        batch.set(doc(collection(db, "shopping_history")), {
          item_name: i.name, section: i.section,
          qty: i.qty || "", unit: i.unit || "",
          week_of: weekOf,
          was_purchased: !!i.is_checked,
        });
      });

      // Delete non-staples, reset staples
      items.forEach((i) => {
        if (!i.is_staple) {
          batch.delete(doc(db, "grocery_items", i.id));
        } else {
          batch.update(doc(db, "grocery_items", i.id), {
            is_selected: false, is_checked: false,
          });
        }
      });

      // Reset app state
      batch.set(doc(db, "app_state", "main"), { mode: "plan", week_of: weekOf }, { merge: true });

      await batch.commit();
      showToast("Fresh week started!");
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // ── Build sections ──────────────────────────────────────────
  const sectionMap = {};
  items.forEach((item) => {
    if (!sectionMap[item.section]) sectionMap[item.section] = [];
    sectionMap[item.section].push(item);
  });

  const allSections = SECTION_ORDER
    .filter((s) => sectionMap[s]?.length > 0)
    .map((s) => ({
      section: s,
      items: sectionMap[s].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    }));
  Object.keys(sectionMap).forEach((s) => {
    if (!SECTION_ORDER.includes(s)) allSections.push({ section: s, items: sectionMap[s] });
  });

  const selectedItems = items.filter((i) => i.is_selected);
  const checkedItems  = selectedItems.filter((i) => i.is_checked);
  const shopSections  = allSections
    .map((s) => ({ ...s, items: s.items.filter((i) => i.is_selected) }))
    .filter((s) => s.items.length > 0);

  const isPlan = mode === "plan";

  // ── LOADING ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div className="loading-icon" style={{ fontSize: 52, marginBottom: 18 }}>🛒</div>
        <div style={styles.loadingText}>Loading your list…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.loadingScreen}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <div style={{ color: "#c44", marginBottom: 16, fontSize: 14, textAlign: "center", maxWidth: 280 }}>{error}</div>
        <button onClick={() => window.location.reload()} style={styles.retryBtn}>Try again</button>
      </div>
    );
  }

  // ── MAIN ────────────────────────────────────────────────────
  return (
    <div style={styles.container}>

      {/* ── HEADER ── */}
      <div style={{
        ...styles.header,
        background: isPlan
          ? "linear-gradient(150deg, #1e3a0f 0%, #3a6b1a 100%)"
          : "linear-gradient(150deg, #112233 0%, #1e4d7a 100%)",
      }}>
        <div style={styles.headerNoise} />
        <div style={styles.headerTop}>
          <div>
            <div style={styles.headerEyebrow}>
              {isPlan ? "WEEKLY PLANNER" : "SHOPPING MODE"}
            </div>
            <h1 style={styles.title}>
              {isPlan ? "Your List" : "Let's Shop"}
            </h1>
            <div style={styles.subtitle}>
              {isPlan
                ? `${selectedItems.length} item${selectedItems.length !== 1 ? "s" : ""} selected`
                : `${checkedItems.length} of ${selectedItems.length} grabbed`}
            </div>
          </div>

          <div style={styles.modePills}>
            <button
              onClick={backToPlan}
              className="secondary-btn"
              style={{
                ...styles.modePill,
                background: isPlan ? "rgba(255,255,255,0.25)" : "transparent",
                fontWeight: isPlan ? 700 : 500,
              }}
            >Plan</button>
            <button
              onClick={() => { if (isPlan) startShopping(); }}
              className="secondary-btn"
              style={{
                ...styles.modePill,
                background: !isPlan ? "rgba(255,255,255,0.25)" : "transparent",
                fontWeight: !isPlan ? 700 : 500,
              }}
            >Shop</button>
          </div>
        </div>

        {!isPlan && selectedItems.length > 0 && (
          <div style={styles.progressBg}>
            <div style={{
              ...styles.progressFill,
              width: `${(checkedItems.length / selectedItems.length) * 100}%`,
            }} />
            <span style={styles.progressLabel}>
              {Math.round((checkedItems.length / selectedItems.length) * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* ── PLAN MODE ── */}
      {isPlan && (
        <div style={styles.content}>
          <p style={styles.hint}>
            Toggle what you need this week · tap qty to adjust · 📌 pins items as staples
          </p>

          {allSections.map(({ section, items: sectionItems }) => {
            const isCollapsed = collapsed[section];
            const selCount    = sectionItems.filter((i) => i.is_selected).length;
            return (
              <div key={section} style={{ marginBottom: 6 }}>
                <button
                  className="section-header-btn"
                  onClick={() => setCollapsed((p) => ({ ...p, [section]: !p[section] }))}
                  style={styles.sectionHeader}
                >
                  <span style={styles.sectionTitle}>
                    <span style={styles.sectionIcon}>{SECTION_ICONS[section] || "📦"}</span>
                    {section}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {selCount > 0 && <span style={styles.badge}>{selCount}</span>}
                    <span style={{
                      ...styles.chevron,
                      transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                    }}>▼</span>
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="section-card" style={styles.card}>
                    {sectionItems.map((item, idx) => {
                      const isOn = item.is_selected;
                      const fc   = FREQ_COLORS[item.freq];
                      return (
                        <div
                          key={item.id}
                          className="item-row"
                          style={{
                            ...styles.itemRow,
                            borderBottom: idx < sectionItems.length - 1 ? "1px solid #f0efe8" : "none",
                            background: isOn ? "#f2f9eb" : "white",
                          }}
                        >
                          <button
                            onClick={() => toggleSelect(item)}
                            style={{
                              ...styles.toggle,
                              background: isOn ? "#4A7C24" : "#e0dfd8",
                            }}
                          >
                            <div style={{
                              ...styles.toggleKnob,
                              left: isOn ? 19 : 3,
                              boxShadow: isOn
                                ? "0 1px 4px rgba(45,80,22,0.35)"
                                : "0 1px 3px rgba(0,0,0,0.18)",
                            }} />
                          </button>

                          <span style={{
                            flex: 1, fontSize: 14,
                            color: isOn ? "#222" : "#aaa",
                            fontWeight: isOn ? 600 : 400,
                            letterSpacing: isOn ? "-0.01em" : "0",
                          }}>{item.name}</span>

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
                                {item.qty && item.unit
                                  ? `${item.qty} ${item.unit}`
                                  : item.qty || item.unit || "qty"}
                              </button>
                            )
                          )}

                          {fc && !isOn && (
                            <span style={{
                              fontSize: 10, padding: "2px 7px", borderRadius: 10,
                              background: fc.bg, color: fc.text, fontWeight: 600,
                              marginLeft: 6, whiteSpace: "nowrap",
                            }}>{FREQ_LABEL[item.freq]}</span>
                          )}

                          <button
                            className="staple-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateItem(item.id, { is_staple: !item.is_staple });
                              showToast(item.is_staple ? "Removed from staples" : "Saved as staple");
                            }}
                            title={item.is_staple ? "Remove from staples" : "Make a staple"}
                            style={{ ...styles.stapleBtn, opacity: item.is_staple ? 1 : 0.25 }}
                          >📌</button>

                          <button
                            className="delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.is_staple) {
                                if (window.confirm(`Delete staple "${item.name}"? This can't be undone.`)) {
                                  deleteItem(item.id);
                                  showToast(`Deleted "${item.name}"`);
                                }
                              } else {
                                deleteItem(item.id);
                                showToast(`Deleted "${item.name}"`);
                              }
                            }}
                            style={styles.deleteBtn}
                          >🗑️</button>
                        </div>
                      );
                    })}

                    {addingTo === section ? (
                      <div style={styles.addRow}>
                        <input
                          autoFocus
                          value={newItem}
                          onChange={(e) => setNewItem(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addCustomItem(section)}
                          placeholder="Item name…"
                          style={styles.addInput}
                        />
                        <button onClick={() => addCustomItem(section)} style={styles.addBtn}>Add</button>
                        <button onClick={() => { setAddingTo(null); setNewItem(""); }} style={styles.cancelBtn}>✕</button>
                      </div>
                    ) : (
                      <button
                        className="add-trigger-btn"
                        onClick={() => setAddingTo(section)}
                        style={styles.addTrigger}
                      >+ Add item</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── SHOP MODE ── */}
      {!isPlan && (
        <div style={styles.content}>
          {selectedItems.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>Nothing selected</p>
              <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>Switch to <strong>Plan</strong> to build your list.</p>
            </div>
          ) : (
            shopSections.map(({ section, items: sectionItems }) => {
              const allDone = sectionItems.every((i) => i.is_checked);
              return (
                <div key={section} style={{ marginBottom: 8 }}>
                  <div style={styles.shopSectionLabel}>
                    <span style={{ color: allDone ? "#bbb" : "#1B3A5C" }}>
                      {SECTION_ICONS[section] || "📦"} {section}
                    </span>
                    {allDone && <span style={styles.donePill}>✓ done</span>}
                  </div>
                  <div style={{
                    ...styles.card,
                    opacity: allDone ? 0.45 : 1,
                    transition: "opacity 0.4s ease",
                  }}>
                    {sectionItems.map((item, idx) => {
                      const isDone = item.is_checked;
                      return (
                        <div
                          key={item.id}
                          className="item-row-shop"
                          onClick={() => toggleCheck(item)}
                          style={{
                            display: "flex", alignItems: "center",
                            padding: "15px 16px", cursor: "pointer",
                            borderBottom: idx < sectionItems.length - 1 ? "1px solid #f0efe8" : "none",
                            background: isDone ? "#f8f8f4" : "white",
                          }}
                        >
                          <div style={{
                            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                            border: isDone ? "2px solid #2E6EA6" : "2px solid #d8d7d0",
                            background: isDone ? "#2E6EA6" : "white",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            marginRight: 14,
                            transition: "background 0.18s ease, border-color 0.18s ease",
                          }}>
                            {isDone && (
                              <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                                <path d="M1 5L4.5 8.5L12 1" stroke="white" strokeWidth="2.2"
                                  strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span style={{
                            flex: 1, fontSize: 16,
                            color: isDone ? "#ccc" : "#1a1a1a",
                            textDecoration: isDone ? "line-through" : "none",
                            fontWeight: isDone ? 400 : 500,
                            transition: "color 0.18s ease",
                          }}>{item.name}</span>
                          {(item.qty || item.unit) && (
                            <span style={{
                              fontSize: 13, color: isDone ? "#ccc" : "#888",
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
            <div className="celebration-card" style={styles.celebration}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>🎉</div>
              <p style={{ fontSize: 19, fontWeight: 700, color: "#2D5016", margin: "0 0 4px", fontFamily: "'Fraunces', serif" }}>
                All done!
              </p>
              <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Great shopping trip.</p>
            </div>
          )}
        </div>
      )}

      {/* ── BOTTOM BAR ── */}
      <div style={styles.bottomBar}>
        {isPlan ? (
          <>
            <button className="secondary-btn" onClick={() => setShowConfirm(true)} style={styles.secondaryBtn}>
              New Week
            </button>
            <button
              className="primary-btn"
              onClick={startShopping}
              style={{
                ...styles.primaryBtn,
                background: selectedItems.length > 0
                  ? "linear-gradient(135deg, #1B3A5C 0%, #2E6EA6 100%)"
                  : "#d4d3cc",
                cursor: selectedItems.length > 0 ? "pointer" : "default",
              }}
            >Start Shopping →</button>
          </>
        ) : (
          <>
            <button className="secondary-btn" onClick={backToPlan} style={styles.secondaryBtn}>
              ← Edit List
            </button>
            <button
              className="primary-btn"
              onClick={() => {
                const txt = selectedItems
                  .filter((i) => !i.is_checked)
                  .map((i) => `${i.qty || ""} ${i.unit || ""} ${i.name}`.trim())
                  .join("\n");
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(txt);
                  showToast("Copied to clipboard!");
                }
              }}
              style={{ ...styles.primaryBtn, background: "#1B3A5C", flex: 1 }}
            >Copy Remaining</button>
          </>
        )}
      </div>

      {/* ── MODAL ── */}
      {showConfirm && (
        <div className="overlay-anim" style={styles.overlay} onClick={() => setShowConfirm(false)}>
          <div className="modal-anim" style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔄</div>
            <h3 style={styles.modalTitle}>Start a new week?</h3>
            <p style={styles.modalBody}>
              Your shopping data will be saved, then all selections cleared. Staple items stay.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="secondary-btn" onClick={() => setShowConfirm(false)} style={styles.modalCancel}>Cancel</button>
              <button className="primary-btn"   onClick={newWeek}                     style={styles.modalConfirm}>New Week</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && <div className="toast-popup" style={styles.toast}>{toast}</div>}
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "'DM Sans', sans-serif",
    maxWidth: 500, margin: "0 auto",
    background: "#F7F6F1", minHeight: "100vh", paddingBottom: 96,
  },
  loadingScreen: {
    display: "flex", flexDirection: "column",
    justifyContent: "center", alignItems: "center",
    height: "100vh", fontFamily: "'DM Sans', sans-serif", background: "#F7F6F1",
  },
  loadingText: { color: "#aaa", fontSize: 14, letterSpacing: "0.02em" },
  retryBtn: {
    padding: "11px 28px", borderRadius: 10, border: "none",
    background: "#2D5016", color: "white", fontSize: 14,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
  },
  header: {
    padding: "28px 20px 20px", color: "white",
    position: "sticky", top: 0, zIndex: 100, overflow: "hidden",
  },
  headerNoise: {
    position: "absolute", inset: 0, pointerEvents: "none",
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
    backgroundSize: "200px 200px", opacity: 0.6,
  },
  headerTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" },
  headerEyebrow: { fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", opacity: 0.6, marginBottom: 4 },
  title: {
    fontFamily: "'Fraunces', serif", fontSize: 28, margin: 0,
    fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.1, fontStyle: "italic",
  },
  subtitle: { fontSize: 13, opacity: 0.75, marginTop: 6, fontWeight: 500 },
  modePills: { display: "flex", background: "rgba(0,0,0,0.2)", borderRadius: 22, padding: 3, gap: 2 },
  modePill: {
    padding: "7px 16px", borderRadius: 19, border: "none",
    color: "white", fontSize: 12, cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.01em",
  },
  progressBg: {
    height: 7, background: "rgba(255,255,255,0.15)", borderRadius: 4,
    overflow: "hidden", marginTop: 18, position: "relative",
  },
  progressFill: {
    height: "100%", background: "rgba(255,255,255,0.8)", borderRadius: 4,
    transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  progressLabel: { position: "absolute", right: 0, top: -18, fontSize: 11, fontWeight: 700, opacity: 0.7 },
  content: { padding: "10px 16px" },
  hint: { fontSize: 12, color: "#a0998a", margin: "6px 0 14px", lineHeight: 1.6, letterSpacing: "0.01em" },
  sectionHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    width: "100%", padding: "12px 2px 8px", border: "none",
    background: "transparent", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  sectionTitle: {
    fontSize: 13, fontWeight: 700, color: "#3a5c1a",
    letterSpacing: "0.04em", textTransform: "uppercase",
    display: "flex", alignItems: "center", gap: 7,
  },
  sectionIcon: { fontSize: 16 },
  badge: {
    fontSize: 11, background: "#4A7C24", color: "white",
    borderRadius: 12, padding: "2px 9px", fontWeight: 700, letterSpacing: "0.02em",
  },
  chevron: { fontSize: 9, color: "#bbb", transition: "transform 0.22s ease", display: "inline-block" },
  card: {
    background: "white", borderRadius: 14, overflow: "hidden",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
  },
  itemRow: { display: "flex", alignItems: "center", padding: "12px 14px" },
  toggle: {
    width: 40, height: 24, borderRadius: 12, border: "none",
    position: "relative", cursor: "pointer", marginRight: 12, flexShrink: 0,
    transition: "background 0.22s ease",
  },
  toggleKnob: {
    width: 18, height: 18, borderRadius: 9, background: "white",
    position: "absolute", top: 3,
    transition: "left 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  qtyEditor: { display: "flex", alignItems: "center", gap: 4 },
  qtyInputSmall: {
    width: 34, border: "1px solid #ddd", borderRadius: 7,
    padding: "4px 6px", fontSize: 13, textAlign: "center",
    fontFamily: "'DM Sans', sans-serif", outline: "none",
  },
  unitInputSmall: {
    width: 52, border: "1px solid #ddd", borderRadius: 7,
    padding: "4px 6px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none",
  },
  qtyConfirm: {
    background: "#4A7C24", color: "white", border: "none",
    borderRadius: 7, padding: "5px 9px", fontSize: 12,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
  },
  qtyPill: {
    background: "#f0efe8", border: "1px solid #e4e2d8", borderRadius: 8,
    padding: "4px 10px", fontSize: 12, color: "#666", cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif", fontWeight: 600, whiteSpace: "nowrap",
  },
  stapleBtn: { background: "none", border: "none", fontSize: 14, cursor: "pointer", padding: "2px 4px", lineHeight: 1 },
  deleteBtn: { background: "none", border: "none", fontSize: 13, cursor: "pointer", padding: "4px 4px", lineHeight: 1, opacity: 0.4 },
  addRow: { display: "flex", padding: "8px 14px", gap: 6, borderTop: "1px solid #f0efe8" },
  addInput: {
    flex: 1, border: "1px solid #e4e2d8", borderRadius: 8,
    padding: "8px 10px", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
    outline: "none", background: "#fafaf7",
  },
  addBtn: {
    background: "#4A7C24", color: "white", border: "none",
    borderRadius: 8, padding: "8px 14px", fontSize: 12,
    fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  cancelBtn: {
    background: "#eeecea", color: "#888", border: "none",
    borderRadius: 8, padding: "8px 10px", fontSize: 12,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  addTrigger: {
    width: "100%", padding: "11px 14px", border: "none",
    borderTop: "1px solid #f0efe8", background: "transparent",
    color: "#4A7C24", fontSize: 12, fontWeight: 700,
    cursor: "pointer", textAlign: "left", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.02em",
  },
  shopSectionLabel: {
    padding: "14px 4px 6px", display: "flex", alignItems: "center", justifyContent: "space-between",
    fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#1B3A5C",
  },
  donePill: { fontSize: 11, background: "#e8f5e9", color: "#2E7D32", borderRadius: 10, padding: "2px 9px", fontWeight: 700 },
  emptyState: { textAlign: "center", padding: "70px 20px", color: "#aaa" },
  celebration: {
    textAlign: "center", padding: "36px 20px",
    background: "linear-gradient(135deg, #f0fae8 0%, #d4edbc 100%)",
    borderRadius: 18, margin: "20px 0",
    boxShadow: "0 4px 20px rgba(45,80,22,0.10)",
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
  secondaryBtn: {
    flex: 1, padding: "13px", borderRadius: 12,
    border: "1.5px solid #e0dfd8", background: "white",
    color: "#888", fontSize: 13, fontWeight: 600,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  primaryBtn: {
    flex: 2, padding: "13px", borderRadius: 12, border: "none",
    color: "white", fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.01em",
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20,
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
    color: "#888", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  modalConfirm: {
    flex: 1, padding: "12px", borderRadius: 10, border: "none",
    background: "linear-gradient(135deg, #2D5016, #4A7C24)",
    color: "white", fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  toast: {
    position: "fixed", bottom: 108, left: "50%", transform: "translateX(-50%)",
    background: "#1a1a1a", color: "white", padding: "11px 22px", borderRadius: 12,
    fontSize: 13, fontWeight: 500, zIndex: 300, fontFamily: "'DM Sans', sans-serif",
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)", whiteSpace: "nowrap",
  },
};
