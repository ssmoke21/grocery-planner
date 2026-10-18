import { useState, lazy, Suspense } from "react";
import { householdLink } from "./household.js";
import { ui, font, useBodyScrollLock, useBackToClose } from "./recipes/ui.js";

const GREEN = "#2D5016";

// Loaded only for the admin household.
const AdminSection = lazy(() => import("./admin/AdminSection.jsx"));

export const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older phones: copy through a temporary text box instead.
    try {
      const box = document.createElement("textarea");
      box.value = text;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      const ok = document.execCommand("copy");
      box.remove();
      return ok;
    } catch {
      return false;
    }
  }
};

export default function HouseholdSheet({ household, onClose, onLeave, showToast }) {
  useBodyScrollLock();
  useBackToClose(onClose);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const link = householdLink(household.code);

  const copy = async () => {
    showToast((await copyText(link)) ? "Link copied" : "Couldn't copy — press and hold the link to copy it");
  };

  return (
    <div className="sheet-anim" style={{ ...ui.sheet, zIndex: 260 }}>
      <div style={ui.topBar}>
        <button className="secondary-btn" onClick={onClose} style={ui.backBtn}>← Back</button>
        <h2 style={ui.topTitle}>Household</h2>
        <span style={{ width: 60 }} />
      </div>

      <div style={ui.body}>
        <div style={{ ...ui.card, padding: "20px 18px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>🏠</div>
          <div style={styles.name}>{household.name}</div>
          <div style={{ fontSize: 12, color: "#a0998a", marginTop: 4 }}>
            You're viewing this household's list on this device.
          </div>
        </div>

        <div style={ui.sectionLabel}>Your household link</div>
        <div style={{ ...ui.card, padding: 14 }}>
          <div style={styles.link}>{link}</div>
          <button className="primary-btn" onClick={copy} style={styles.copyBtn}>Copy link</button>
          <p style={{ ...ui.hint, marginTop: 10 }}>
            Anyone with this link can see and change this household's list. Only share it with people in your household.
          </p>
        </div>

        {household.is_admin === true && (
          <Suspense fallback={null}>
            <AdminSection household={household} showToast={showToast} />
          </Suspense>
        )}

        <button className="secondary-btn" onClick={() => setConfirmLeave(true)} style={styles.leaveBtn}>
          Leave this household on this device
        </button>
      </div>

      {confirmLeave && (
        <div className="overlay-anim" style={styles.overlay} onClick={() => setConfirmLeave(false)}>
          <div className="modal-anim" style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🚪</div>
            <h3 style={styles.modalTitle}>Leave {household.name}?</h3>
            <p style={styles.modalBody}>
              Nothing is deleted. This phone just forgets the household, and you'll need the link to get back in.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="secondary-btn" onClick={() => setConfirmLeave(false)} style={styles.modalCancel}>Cancel</button>
              <button className="primary-btn" onClick={onLeave} style={styles.modalConfirm}>Leave</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  name: {
    fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 500,
    fontSize: 24, color: "#1a1a1a",
  },
  link: {
    fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, color: "#444",
    background: "#f6f5f0", borderRadius: 10, padding: "11px 12px",
    wordBreak: "break-all", userSelect: "all",
  },
  copyBtn: {
    width: "100%", marginTop: 10, padding: "13px", borderRadius: 12, border: "none",
    background: `linear-gradient(135deg, ${GREEN} 0%, #4A7C24 100%)`,
    color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
  leaveBtn: {
    display: "block", width: "100%", marginTop: 28, padding: "14px", borderRadius: 12,
    border: "1.5px solid #e0dfd8", background: "transparent",
    color: "#888", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: font,
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
    background: "#555", color: "white", fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: font,
  },
};
