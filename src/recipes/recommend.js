// Dinner suggestions: a varied mix of old favorites, regulars and new things
// to try, for the season. Pure logic (no database), so it can be tested alone.
import { FAVORITE_MIN_TIMES } from "./constants.js";
import { daysSince, isInSeason, formatShortDate, usageLabel } from "./utils.js";

const RECENT_DAYS = 14;        // don't suggest anything made this recently
const OLD_FAVORITE_DAYS = 30;  // a favorite counts as "old" after this long

export const KINDS = {
  favorite: { icon: "⭐", label: "Old favorite" },
  regular:  { icon: "🔁", label: "Regular" },
  fresh:    { icon: "✨", label: "New to try" },
};
// Slots are filled in this order; a missing kind falls back to any other.
const ROTATION = ["favorite", "fresh", "regular"];

export const kindOf = (u) => {
  if (!u?.count) return "fresh";
  return u.count >= FAVORITE_MIN_TIMES && daysSince(u.last) >= OLD_FAVORITE_DAYS ? "favorite" : "regular";
};

const isSlowCooker = (r) => !!r.cook_methods?.includes("slow_cooker");
const styleOf = (r) => (isSlowCooker(r) ? "slow_cooker" : r.cook_methods?.[0] || null);
const isQuick = (r) => r.total_minutes > 0 && r.total_minutes <= 30;

// Recipes that may be suggested at all.
export const eligibleDinners = ({ recipes, usage, season, ratingOf = () => null }) =>
  recipes.filter((r) =>
    r.meals?.includes("dinner") &&
    isInSeason(r, season) &&
    !(ratingOf(r) && ratingOf(r) <= 2) && // you rated it 1–2 stars
    !(usage[r.id]?.last && daysSince(usage[r.id].last) < RECENT_DAYS)
  );

// Higher = better fit alongside what's already chosen. Chance keeps it fresh.
const score = (r, chosen, popularity, rng) => {
  let s = rng();
  chosen.forEach((c) => {
    if (c.protein && c.protein === r.protein) s -= 0.6;
    if (styleOf(c) && styleOf(c) === styleOf(r)) s -= 0.4;
  });
  if (isSlowCooker(r) && !chosen.some(isSlowCooker)) s += 0.8;
  if (isQuick(r) && !chosen.some(isQuick)) s += 0.4;
  s += Math.min(popularity(r), 3) * 0.1;
  return s;
};

/**
 * Picks one dinner: of the given kind if possible, otherwise any kind.
 * `chosen` = recipes already in the mix, `skip` = ids not to use.
 */
export const pickDinner = ({ pool, usage, kind, chosen, skip, popularity = () => 0, rng = Math.random }) => {
  const open = pool.filter((r) => !skip.has(r.id));
  const sameKind = open.filter((r) => kindOf(usage[r.id]) === kind);
  let best = null, bestScore = -Infinity;
  (sameKind.length ? sameKind : open).forEach((r) => {
    const s = score(r, chosen, popularity, rng);
    if (s > bestScore) { best = r; bestScore = s; }
  });
  return best;
};

export const rotationKind = (i) => ROTATION[i % ROTATION.length];

// Builds `count` suggestions that work alongside `keep` (recipes already picked).
export const suggestDinners = ({ pool, usage, count, keep = [], skip = new Set(), popularity, rng }) => {
  const chosen = [...keep];
  const used = new Set([...skip, ...keep.map((r) => r.id)]);
  const out = [];
  for (let i = 0; i < count; i++) {
    const r = pickDinner({ pool, usage, kind: rotationKind(i + keep.length), chosen, skip: used, popularity, rng });
    if (!r) break;
    out.push(r);
    chosen.push(r);
    used.add(r.id);
  }
  return out;
};

export const reasonFor = (u, madeBy) => {
  const kind = kindOf(u);
  const k = KINDS[kind];
  const detail = kind === "fresh"
    ? (madeBy ? `Made by ${madeBy}` : "Never made")
    : kind === "favorite" ? `Made ${u.count}× · last ${formatShortDate(u.last)}`
    : usageLabel(u);
  return `${k.icon} ${k.label} · ${detail}`;
};
