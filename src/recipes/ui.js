import { useEffect } from "react";

// Shared styles for the recipe sheets (detail, form, import).
export const font = "'DM Sans', sans-serif";
export const BROWN = "#8a4a22";

export const ui = {
  sheet: {
    position: "fixed", inset: 0, zIndex: 250, overflowY: "auto",
    background: "#F7F6F1", fontFamily: font,
    maxWidth: 500, margin: "0 auto",
  },
  topBar: {
    position: "sticky", top: 0, zIndex: 2, padding: "14px 16px 10px",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    background: "rgba(247,246,241,0.92)",
    backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
  },
  topTitle: {
    fontFamily: "'Fraunces', serif", fontSize: 20, fontStyle: "italic",
    fontWeight: 500, color: "#1a1a1a", margin: 0,
  },
  backBtn: {
    padding: "10px 16px", borderRadius: 10, border: "1.5px solid #e0dfd8",
    background: "white", color: "#555", fontSize: 14, fontWeight: 600,
    cursor: "pointer", fontFamily: font, whiteSpace: "nowrap",
  },
  topActionBtn: {
    padding: "10px 18px", borderRadius: 10, border: "none",
    background: BROWN, color: "white", fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: font, whiteSpace: "nowrap",
  },
  body: { padding: "4px 16px 40px" },
  sectionLabel: {
    fontSize: 13, fontWeight: 700, color: BROWN,
    letterSpacing: "0.04em", textTransform: "uppercase",
    padding: "20px 2px 8px",
  },
  card: {
    background: "white", borderRadius: 14, overflow: "hidden",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
  },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#777", margin: "0 2px 6px" },
  input: {
    width: "100%", boxSizing: "border-box",
    padding: "12px 13px", borderRadius: 10,
    border: "1.5px solid #e4e2d8", background: "white",
    fontSize: 16, fontFamily: font, outline: "none", color: "#222",
  },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: {
    padding: "9px 12px", borderRadius: 18, border: "1.5px solid",
    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font,
    transition: "background 0.15s ease, color 0.15s ease",
  },
  hint: { fontSize: 12, color: "#a0998a", margin: "6px 2px 0", lineHeight: 1.5 },
};

export const chipStyle = (on) => ({
  ...ui.chip,
  background: on ? BROWN : "#f4f3ee",
  color: on ? "white" : "#555",
  borderColor: on ? BROWN : "#e8e6dc",
});

// Stop the page behind a sheet from scrolling while the sheet is open.
export function useBodyScrollLock() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
}
