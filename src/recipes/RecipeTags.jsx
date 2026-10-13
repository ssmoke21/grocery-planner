import { PROTEINS, DIFFICULTIES, TIME_BUCKETS, byKey } from "./constants.js";
import { timeBucket } from "./utils.js";

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

// Protein · time bucket · difficulty
export default function RecipeTags({ recipe }) {
  const p = P[recipe.protein];
  const t = T[timeBucket(recipe.total_minutes)];
  const d = D[recipe.difficulty];
  const dc = DIFF_COLORS[recipe.difficulty];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
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
