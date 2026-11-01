import { useState, useEffect } from "react";
import { formatQty } from "./utils.js";
import { font, useBodyScrollLock, useBackToClose } from "./ui.js";

const splitSteps = (text) =>
  String(text || "").split(/\n+/).map((s) => s.trim()).filter(Boolean);

// Keeps the screen on while cooking, where the phone allows it. The phone
// releases this whenever the app is hidden, so ask again on return.
function useKeepScreenOn() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let lock = null;
    let done = false;
    const request = async () => {
      try {
        const next = await navigator.wakeLock?.request("screen");
        if (done) { next?.release(); return; }
        lock = next || null;
        setOn(!!next);
      } catch { setOn(false); }
    };
    const onVisible = () => { if (document.visibilityState === "visible") request(); };
    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      done = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);
  return on;
}

export default function CookMode({ recipe, scale = 1, onClose }) {
  useBodyScrollLock();
  useBackToClose(onClose);
  const screenOn = useKeepScreenOn();
  const [done, setDone] = useState(() => new Set());

  const toggle = (key) => setDone((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const ingredients = recipe.ingredients || [];
  const steps = splitSteps(recipe.instructions);

  const Row = ({ id, label, amount }) => {
    const isDone = done.has(id);
    return (
      <button onClick={() => toggle(id)} style={{ ...styles.row, opacity: isDone ? 0.4 : 1 }}>
        <span style={{ ...styles.check, background: isDone ? "#7fc08a" : "transparent", borderColor: isDone ? "#7fc08a" : "#6f7d76" }}>
          {isDone ? "✓" : ""}
        </span>
        <span style={{ flex: 1, textDecoration: isDone ? "line-through" : "none" }}>{label}</span>
        {amount && <span style={styles.amount}>{amount}</span>}
      </button>
    );
  };

  return (
    <div className="sheet-anim" style={styles.sheet}>
      <div style={styles.top}>
        <button onClick={onClose} style={styles.exit}>✕ Exit</button>
        <span style={styles.awake}>{screenOn ? "☀️ Screen stays on" : ""}</span>
      </div>
      <h2 style={styles.name}>{recipe.name}</h2>
      {scale !== 1 && <p style={styles.scaled}>Amounts adjusted ×{Math.round(scale * 100) / 100}</p>}

      {ingredients.length > 0 && <div style={styles.label}>Ingredients</div>}
      {ingredients.map((ing, i) => (
        <Row
          key={`i${i}`}
          id={`i${i}`}
          label={ing.name}
          amount={formatQty(typeof ing.qty === "number" ? ing.qty * scale : ing.qty, ing.unit)}
        />
      ))}

      {steps.length > 0 && <div style={styles.label}>Steps</div>}
      {steps.map((s, i) => <Row key={`s${i}`} id={`s${i}`} label={s} />)}

      {!ingredients.length && !steps.length && (
        <p style={styles.scaled}>This recipe doesn't have ingredients or steps saved yet.</p>
      )}
    </div>
  );
}

const styles = {
  sheet: {
    position: "fixed", inset: 0, zIndex: 290, overflowY: "auto", boxSizing: "border-box",
    maxWidth: 500, margin: "0 auto", padding: "14px 18px 48px",
    background: "#16211d", color: "#f3f1e8", fontFamily: font,
  },
  top: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  exit: {
    padding: "11px 16px", borderRadius: 10, border: "1.5px solid #4a5a53", background: "transparent",
    color: "#f3f1e8", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: font,
  },
  awake: { fontSize: 12, color: "#a9b8b0" },
  name: { fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 500, fontSize: 28, lineHeight: 1.15, margin: "0 0 4px" },
  scaled: { fontSize: 14, color: "#a9b8b0", margin: "4px 0" },
  label: {
    fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
    color: "#8fd0a0", margin: "26px 0 6px",
  },
  row: {
    display: "flex", alignItems: "flex-start", gap: 14, width: "100%", padding: "14px 2px",
    border: "none", borderBottom: "1px solid #2c3a35", background: "transparent",
    color: "#f3f1e8", fontSize: 20, lineHeight: 1.4, textAlign: "left", cursor: "pointer", fontFamily: font,
  },
  check: {
    flexShrink: 0, width: 28, height: 28, marginTop: 1, borderRadius: 8, border: "2px solid",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#16211d", fontWeight: 700,
  },
  amount: { flexShrink: 0, color: "#c9d6cf", fontWeight: 600, fontSize: 18, marginTop: 1 },
};
