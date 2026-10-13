import { PROTEINS, DIFFICULTIES, TIME_BUCKETS, byKey, courseOf } from "./constants.js";
import { timeBucket, usageStatus, usageLabel } from "./utils.js";

const P = byKey(PROTEINS);
const D = byKey(DIFFICULTIES);
const T = byKey(TIME_BUCKETS);

const DIFF_COLORS = {
  easy:   { bg: "#E8F5E9", text: "#2E7D32" },
  medium: { bg: "#FFF3E0", text: "#E65100" },
  hard:   { bg: "#FBE3E0", text: "#B3261E" },
};

export function Tag({ children, bg = "#f0efe8", color = "#666" }) {
  return (
    <span style={{
      fontSize: 11, padding: "3px 8px", borderRadius: 10,
      background: bg, color, fontWeight: 600, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

// Side · protein · time bucket · difficulty
export default function RecipeTags({ recipe }) {
  const p = P[recipe.protein];
  const t = T[timeBucket(recipe.total_minutes)];
  const d = D[recipe.difficulty];
  const dc = DIFF_COLORS[recipe.difficulty];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {courseOf(recipe) === "side" && <Tag bg="#E6F2EF" color="#2f6b63">🥗 Side</Tag>}
      {p && <Tag bg={p.tint} color="#5a4a3a">{p.icon} {p.label}</Tag>}
      {t && <Tag>⏱ {t.label}</Tag>}
      {d && <Tag bg={dc.bg} color={dc.text}>{d.label}</Tag>}
    </div>
  );
}

export function RecipeThumb({ recipe, size = 64 }) {
  const p = P[recipe.protein] || P.other;
  return (
    <div style={{
      width: size, height: size, borderRadius: 12, flexShrink: 0,
      background: p.tint, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.48,
    }}>{p.icon}</div>
  );
}

// "⭐ Made 4× · last Sep 14" — green normally, amber when it's been a while, grey if never.
export function UsageLine({ usage, style }) {
  const s = usageStatus(usage);
  const color = s.never ? "#b0aa9c" : s.stale ? "#b07a1e" : "#4A7C24";
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color, ...style }}>
      {s.favorite && "⭐ "}{usageLabel(usage)}
    </div>
  );
}
