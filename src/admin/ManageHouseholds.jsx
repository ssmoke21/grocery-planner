import { useState, useEffect } from "react";
import { onSnapshot } from "firebase/firestore";
import { createHousehold, householdLink } from "../household.js";
import { copyText } from "../HouseholdSheet.jsx";
import { directoryCol, renameHousehold, deleteHousehold, recipesOwnedBy } from "./householdAdmin.js";
import { ui, font, useBodyScrollLock, useBackToClose } from "../recipes/ui.js";

const SLATE = "#3d4a5c";

const createdLabel = (ts) =>
  ts?.toDate
    ? ts.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "just now";

export default function ManageHouseholds({ household, showToast, onClose }) {
  useBodyScrollLock();
  useBackToClose(onClose);
  const adminCode = household.code;

  const [entries, setEntries]   = useState(null);
  const [newName, setNewName]   = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated]   = useState(null); // { name, code }
  const [renaming, setRenaming] = useState(null); // { code, value }
  const [deleting, setDeleting] = useState(null); // { entry, recipeCount, choice, busy }

  useEffect(() => onSnapshot(directoryCol(adminCode), (snap) => {
    const list = snap.docs.map((d) => ({ code: d.id, ...d.data() }));
    list.sort((a, b) => (a.createdAt?.toMillis?.() ?? Infinity) - (b.createdAt?.toMillis?.() ?? Infinity));
    setEntries(list);
  }, (e) => { console.error(e); setEntries([]); }), [adminCode]);

  const copyLink = async (code) =>
    showToast((await copyText(householdLink(code))) ? "Link copied" : "Couldn't copy — press and hold the link instead");

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { code } = await createHousehold(name, { adminCode });
      setCreated({ name, code });
      setNewName("");
      showToast(`Created "${name}"`);
    } catch (e) {
      console.error(e);
      showToast("Couldn't create — check your connection");
    }
    setCreating(false);
  };

  const saveRename = async (entry) => {
    const name = renaming.value.trim();
    if (!name || name === entry.name) { setRenaming(null); return; }
    try {
      await renameHousehold(adminCode, entry, name);
      showToast(`Renamed to "${name}"`);
      setRenaming(null);
    } catch (e) {
      console.error(e);
      showToast("Couldn't rename — try again");
    }
  };

  const startDelete = async (entry) => {
    setDeleting({ entry, recipeCount: null, choice: "keep", busy: false });
    try {
      const docs = await recipesOwnedBy(entry.public_id);
      setDeleting((d) => d && { ...d, recipeCount: docs.length });
    } catch (e) {
      console.error(e);
      setDeleting((d) => d && { ...d, recipeCount: 0 });
    }
  };

  const confirmDelete = async () => {
    const { entry, choice } = deleting;
    setDeleting((d) => ({ ...d, busy: true }));
    try {
      await deleteHousehold(adminCode, household.public_id, entry, { recipes: choice });
      showToast(`Deleted "${entry.name}"`);
      setDeleting(null);
    } catch (e) {
      console.error(e);
      showToast("Delete didn't finish — try again");
      setDeleting((d) => ({ ...d, busy: false }));
    }
  };

  return (
    <div className="sheet-anim" style={{ ...ui.sheet, zIndex: 270 }}>
      <div style={ui.topBar}>
        <button className="secondary-btn" onClick={onClose} style={ui.backBtn}>← Back</button>
        <h2 style={ui.topTitle}>Households</h2>
        <span style={{ width: 60 }} />
      </div>

      <div style={ui.body}>
        {/* ── Create ── */}
        <div style={ui.sectionLabel}>Create a household</div>
        <div style={{ ...ui.card, padding: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Display name, e.g. The Lees"
              style={{ ...ui.input, flex: 1 }}
            />
            <button
              className="primary-btn"
              onClick={create}
              disabled={creating || !newName.trim()}
              style={{ ...styles.darkBtn, opacity: newName.trim() ? 1 : 0.4 }}
            >{creating ? "…" : "Create"}</button>
          </div>
          {created && (
            <div style={styles.createdBox}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>✅ {created.name} is ready. Send them this link:</div>
              <div style={styles.link}>{householdLink(created.code)}</div>
              <button className="primary-btn" onClick={() => copyLink(created.code)} style={{ ...styles.darkBtn, width: "100%", marginTop: 8 }}>
                Copy link
              </button>
            </div>
          )}
        </div>

        {/* ── List ── */}
        <div style={ui.sectionLabel}>All households{entries ? ` (${entries.length})` : ""}</div>
        {entries === null ? (
          <p style={{ color: "#aaa", fontSize: 14 }}>Loading…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {entries.map((e) => {
              const isSelf = e.code === adminCode;
              const isRenaming = renaming?.code === e.code;
              return (
                <div key={e.code} style={{ ...ui.card, padding: 14 }}>
                  {isRenaming ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        autoFocus
                        value={renaming.value}
                        onChange={(ev) => setRenaming({ code: e.code, value: ev.target.value })}
                        onKeyDown={(ev) => ev.key === "Enter" && saveRename(e)}
                        style={{ ...ui.input, flex: 1, padding: "10px 12px" }}
                      />
                      <button onClick={() => saveRename(e)} style={styles.darkBtn}>Save</button>
                      <button onClick={() => setRenaming(null)} style={styles.lightBtn}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={styles.name}>{e.name}</span>
                      {e.is_admin && <span style={styles.badge}>Admin</span>}
                      {isSelf && <span style={{ ...styles.badge, background: "#E8F5E9", color: "#2E7D32" }}>You</span>}
                    </div>
                  )}
                  <div style={styles.meta}>Created {createdLabel(e.createdAt)}</div>
                  <div style={styles.link}>{householdLink(e.code)}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={() => copyLink(e.code)} style={{ ...styles.darkBtn, flex: 1 }}>Copy link</button>
                    {!isRenaming && (
                      <button onClick={() => setRenaming({ code: e.code, value: e.name })} style={styles.lightBtn}>Rename</button>
                    )}
                    {!isSelf && !e.is_admin && (
                      <button onClick={() => startDelete(e)} style={{ ...styles.lightBtn, color: "#b3261e" }}>Delete</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deleting && (
        <div className="overlay-anim" style={styles.overlay} onClick={() => !deleting.busy && setDeleting(null)}>
          <div className="modal-anim" style={styles.modal} onClick={(ev) => ev.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🗑️</div>
            <h3 style={styles.modalTitle}>Delete {deleting.entry.name}?</h3>
            <p style={styles.modalBody}>
              Their grocery list, staples, shopping history and meal plans are permanently deleted, and their link stops working.
            </p>
            {deleting.recipeCount === null ? (
              <p style={styles.modalBody}>Checking their recipes…</p>
            ) : deleting.recipeCount > 0 && (
              <div style={{ textAlign: "left", marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#444", marginBottom: 6 }}>
                  They shared {deleting.recipeCount} recipe{deleting.recipeCount !== 1 ? "s" : ""}:
                </div>
                {[["keep", `Keep them (they become ${household.name}'s)`], ["delete", "Delete them too"]].map(([val, label]) => (
                  <label key={val} style={styles.radio}>
                    <input
                      type="radio"
                      checked={deleting.choice === val}
                      onChange={() => setDeleting((d) => ({ ...d, choice: val }))}
                    /> {label}
                  </label>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleting(null)} disabled={deleting.busy} style={styles.modalCancel}>Cancel</button>
              <button
                onClick={confirmDelete}
                disabled={deleting.busy || deleting.recipeCount === null}
                style={{ ...styles.modalConfirm, opacity: deleting.recipeCount === null ? 0.5 : 1 }}
              >{deleting.busy ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  name: { fontSize: 16, fontWeight: 700, color: "#222" },
  badge: {
    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
    background: "#E3E8F0", color: SLATE, textTransform: "uppercase", letterSpacing: "0.04em",
  },
  meta: { fontSize: 12, color: "#a0998a", marginTop: 3 },
  link: {
    marginTop: 8, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: "#555",
    background: "#f6f5f0", borderRadius: 8, padding: "8px 10px", wordBreak: "break-all", userSelect: "all",
  },
  darkBtn: {
    padding: "10px 16px", borderRadius: 10, border: "none", background: SLATE,
    color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font, whiteSpace: "nowrap",
  },
  lightBtn: {
    padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e0dfd8", background: "white",
    color: "#666", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font, whiteSpace: "nowrap",
  },
  createdBox: {
    marginTop: 12, padding: 12, borderRadius: 12, background: "#EEF3EA",
    fontSize: 13, color: "#2D5016", lineHeight: 1.45,
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20,
  },
  modal: {
    background: "white", borderRadius: 20, padding: "28px 22px",
    maxWidth: 340, width: "100%", boxSizing: "border-box", textAlign: "center",
    boxShadow: "0 24px 60px rgba(0,0,0,0.18)", fontFamily: font,
  },
  modalTitle: {
    margin: "0 0 10px", fontSize: 18,
    fontFamily: "'Fraunces', serif", fontWeight: 500, fontStyle: "italic", color: "#1a1a1a",
  },
  modalBody: { fontSize: 13, color: "#888", margin: "0 0 16px", lineHeight: 1.6 },
  radio: { display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#333", padding: "7px 0" },
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
