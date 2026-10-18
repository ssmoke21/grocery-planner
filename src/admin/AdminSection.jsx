import { useState, Suspense } from "react";
import { ADMIN_TOOLS } from "./tools.js";
import { ui, font } from "../recipes/ui.js";

// Shown inside the Household panel, only for the admin household.
// This file (and every tool) is loaded on demand, so other households'
// phones never download it.
export default function AdminSection({ household, showToast }) {
  const [openKey, setOpenKey] = useState(null);
  const tool = ADMIN_TOOLS.find((t) => t.key === openKey);

  return (
    <>
      <div style={ui.sectionLabel}>🔐 Admin</div>
      <div style={ui.card}>
        {ADMIN_TOOLS.map((t, idx) => (
          <button
            key={t.key}
            className="item-row-shop"
            onClick={() => setOpenKey(t.key)}
            style={{
              ...styles.row,
              borderBottom: idx < ADMIN_TOOLS.length - 1 ? "1px solid #f0efe8" : "none",
            }}
          >
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#222" }}>{t.title}</span>
              <span style={{ display: "block", fontSize: 12, color: "#a0998a", marginTop: 2 }}>{t.description}</span>
            </span>
            <span style={{ color: "#c8c5ba", fontSize: 18 }}>›</span>
          </button>
        ))}
      </div>

      {tool && (
        <Suspense fallback={null}>
          <tool.Component household={household} showToast={showToast} onClose={() => setOpenKey(null)} />
        </Suspense>
      )}
    </>
  );
}

const styles = {
  row: {
    display: "flex", alignItems: "center", gap: 12, width: "100%",
    padding: "14px 14px", border: "none", background: "white",
    textAlign: "left", cursor: "pointer", fontFamily: font,
  },
};
