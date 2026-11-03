import { useState, useEffect, useMemo, useRef } from "react";
import { milestones, planStreak } from "../fun.js";
import { font } from "./ui.js";

// Streak and milestone badges at the bottom of the Meal Plan tab.
export default function Milestones({ recipes, mealPlan, publicId, showToast }) {
  const [open, setOpen] = useState(false);
  const badges = useMemo(() => milestones({ mealPlan, recipes, publicId }), [mealPlan, recipes, publicId]);
  const streak = planStreak(mealPlan);
  const earned = badges.filter((b) => b.earned);

  // Cheer when a badge is earned while the app is open.
  const seen = useRef(null);
  useEffect(() => {
    const keys = earned.map((b) => b.key);
    if (seen.current) {
      const fresh = earned.find((b) => !seen.current.includes(b.key));
      if (fresh) showToast(`🏅 New badge: ${fresh.icon} ${fresh.name}!`);
    }
    seen.current = keys;
  }, [earned.map((b) => b.key).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={styles.card}>
      <button onClick={() => setOpen((o) => !o)} style={styles.head}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={styles.title}>
            {streak >= 2 ? `🔥 ${streak}-week streak` : "🏅 Milestones"}
          </span>
          <span style={styles.sub}>
            {earned.length} of {badges.length} badges
            {earned.length > 0 && " · "}{earned.slice(-6).map((b) => b.icon).join(" ")}
          </span>
        </span>
        <span style={{ ...styles.chevron, transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>▼</span>
      </button>

      {open && (
        <div className="section-card" style={styles.grid}>
          {badges.map((b) => (
            <div key={b.key} style={{ ...styles.badge, opacity: b.earned ? 1 : 0.55 }}>
              <div style={{ fontSize: 26, filter: b.earned ? "none" : "grayscale(1)" }}>{b.icon}</div>
              <div style={styles.badgeName}>{b.name}</div>
              <div style={styles.badgeHint}>
                {b.earned ? "✓ Earned" : `${b.hint} · ${Math.min(b.value, b.goal)}/${b.goal}`}
              </div>
              {!b.earned && (
                <div style={styles.barBg}>
                  <div style={{ ...styles.barFill, width: `${(Math.min(b.value, b.goal) / b.goal) * 100}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    marginTop: 14, background: "var(--bg-ffffff)", borderRadius: 14, overflow: "hidden",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
  },
  head: {
    display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "13px 14px",
    border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontFamily: font,
  },
  title: { display: "block", fontSize: 15, fontWeight: 700, color: "var(--fg-222222)" },
  sub: { display: "block", fontSize: 12, color: "var(--fg-8a8478)", fontWeight: 600, marginTop: 2 },
  chevron: { fontSize: 9, color: "var(--fg-bbbbbb)", transition: "transform 0.22s ease", display: "inline-block" },
  grid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "0 12px 12px",
  },
  badge: {
    padding: "10px 8px", borderRadius: 12, background: "var(--bg-f6f5f0)", textAlign: "center",
  },
  badgeName: { fontSize: 13, fontWeight: 700, color: "var(--fg-333333)", marginTop: 4 },
  badgeHint: { fontSize: 11, color: "var(--fg-8a8478)", marginTop: 2, lineHeight: 1.35 },
  barBg: { height: 4, borderRadius: 2, background: "var(--bg-e4e2d8)", marginTop: 6, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2, background: "var(--bg-c98f00)" },
};
