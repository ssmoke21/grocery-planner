import { PROTEINS, DIFFICULTIES, TIME_BUCKETS, byKey } from "./constants.js";
import { timeBucket, usageStatus, usageLabel, formatMinutes } from "./utils.js";

const P = byKey(PROTEINS);
const D = byKey(DIFFICULTIES);
const T = byKey(TIME_BUCKETS);

const DIFF_COLORS = {
  easy:   { bg: "var(--bg-e8f5e9)", text: "var(--fg-2e7d32)" },
  medium: { bg: "var(--bg-fff3e0)", text: "var(--fg-e65100)" },
  hard:   { bg: "var(--bg-fbe3e0)", text: "var(--fg-b3261e)" },
};

export function Tag({ children, bg = "var(--bg-f0efe8)", color = "var(--fg-666666)" }) {
  return (
    <span style={{
      fontSize: 11, padding: "3px 8px", borderRadius: 10,
      background: bg, color, fontWeight: 600, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

// Side or dessert · protein · time bucket · difficulty
// `text` shows one quiet line (for cards) instead of colored tags.
export default function RecipeTags({ recipe, text = false, stars = 0 }) {
  const p = P[recipe.protein];
  const t = T[timeBucket(recipe.total_minutes)];
  const d = D[recipe.difficulty];
  const dc = DIFF_COLORS[recipe.difficulty];
  if (text) {
    const bits = [
      recipe.meals?.includes("side") && "🥗 Side",
      recipe.meals?.includes("dessert") && "🍪 Dessert",
      p && `${p.icon} ${p.label}`,
      recipe.total_minutes && formatMinutes(recipe.total_minutes),
      d?.label,
    ].filter(Boolean);
    return (
      <div style={{ fontSize: 12, color: "var(--fg-777777)", fontWeight: 500, lineHeight: 1.45 }}>
        {stars > 0 && <span style={{ color: "var(--fg-c98f00)", fontWeight: 700 }}>★{stars} · </span>}
        {bits.join(" · ")}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {recipe.meals?.includes("side") && <Tag bg="var(--bg-e6f2ef)" color="var(--fg-2f6b63)">🥗 Side</Tag>}
      {recipe.meals?.includes("dessert") && <Tag bg="var(--bg-fbebdd)" color="var(--fg-9a5a1f)">🍪 Dessert</Tag>}
      {p && <Tag bg={p.tint} color="var(--fg-5a4a3a)">{p.icon} {p.label}</Tag>}
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
  const color = s.never ? "var(--fg-b0aa9c)" : s.stale ? "var(--fg-b07a1e)" : "var(--fg-4a7c24)";
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color, ...style }}>
      {s.favorite && "⭐ "}{usageLabel(usage)}
    </div>
  );
}
