// "YYYY-MM-DD" → local Date (avoids the UTC off-by-one-day problem).
export const parseDay = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const formatShortDate = (s) =>
  parseDay(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export const timeBucket = (minutes) => {
  if (!minutes && minutes !== 0) return null;
  if (minutes <= 30) return "quick";
  if (minutes <= 60) return "medium";
  return "long";
};

export const currentSeason = (date = new Date()) => {
  const m = date.getMonth(); // 0 = Jan
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
};

// No seasons selected = year-round.
export const isInSeason = (recipe, season) =>
  !recipe.seasons?.length || recipe.seasons.includes(season);

// Build { [recipeId]: { count, last } } from meal_plan entries.
// `last` is the most recent week_start ("YYYY-MM-DD") or null.
export const buildUsage = (mealPlan) => {
  const usage = {};
  mealPlan.forEach(({ recipe_id, week_start }) => {
    if (!recipe_id || !week_start) return;
    const u = usage[recipe_id] || (usage[recipe_id] = { count: 0, last: null });
    u.count += 1;
    if (!u.last || week_start > u.last) u.last = week_start;
  });
  return usage;
};

export const usageLabel = (u) =>
  u?.count ? `Made ${u.count}× · last ${formatShortDate(u.last)}` : "Never made";

// 0.5 → "½", 1.5 → "1½", 0.333 → "⅓"; other decimals stay as-is.
const FRACTIONS = [[0.25, "¼"], [0.333, "⅓"], [0.5, "½"], [0.667, "⅔"], [0.75, "¾"]];
export const prettyNumber = (n) => {
  if (typeof n !== "number") return n;
  const whole = Math.floor(n);
  const frac = FRACTIONS.find(([v]) => Math.abs(n - whole - v) < 0.01);
  if (frac) return `${whole || ""}${frac[1]}`;
  return String(Math.round(n * 100) / 100);
};

export const formatQty = (qty, unit) =>
  [qty || qty === 0 ? prettyNumber(qty) : null, unit].filter(Boolean).join(" ");

// 45 → "45 min", 60 → "1 hr", 75 → "1 hr 15 min"
export const formatMinutes = (m) => {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), rest = m % 60;
  return rest ? `${h} hr ${rest} min` : `${h} hr`;
};

// Matching key for ingredient / grocery names: case-insensitive, trims
// simple plurals ("onions" → "onion", "tomatoes" → "tomato", "berries" → "berry").
export const nameKey = (name) => {
  let s = String(name || "").toLowerCase().trim().replace(/\s+/g, " ");
  if (s.length > 4 && s.endsWith("ies")) s = s.slice(0, -3) + "y";
  else if (s.length > 4 && s.endsWith("oes")) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith("s") && !/(ss|us|is)$/.test(s)) s = s.slice(0, -1);
  return s;
};

// Grocery names often carry a note: "Onions (yellow)", "Yogurt — Siggi's".
// The loose key drops that note so "onions" still finds "Onions (yellow)".
export const looseKey = (name) =>
  nameKey(String(name || "").replace(/\(.*?\)/g, "").split(/\s[—–-]\s|,/)[0]);

// Best grocery-list match for an ingredient name, or undefined.
export const findGroceryMatch = (name, groceryItems = []) => {
  const exact = nameKey(name);
  const loose = looseKey(name);
  return groceryItems.find((i) => nameKey(i.name) === exact)
      || groceryItems.find((i) => looseKey(i.name) === loose);
};

// ── Weeks (Monday start, local time) ──
export const toDayString = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// weekStart(0) = this Monday, weekStart(1) = next Monday.
export const weekStart = (offsetWeeks = 0, from = new Date()) => {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offsetWeeks * 7);
  return toDayString(d);
};

// "2026-10-12" → "Oct 12 – 18"
export const formatWeekRange = (start) => {
  const a = parseDay(start);
  const b = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 6);
  const mon = (d) => d.toLocaleDateString(undefined, { month: "short" });
  return a.getMonth() === b.getMonth()
    ? `${mon(a)} ${a.getDate()} – ${b.getDate()}`
    : `${mon(a)} ${a.getDate()} – ${mon(b)} ${b.getDate()}`;
};

// ── Units ── "Cups" → "cup", "lbs" → "lb", "pounds" → "lb"
const UNIT_ALIASES = {
  pound: "lb", lb: "lb", ounce: "oz", oz: "oz",
  tablespoon: "tbsp", tbsp: "tbsp", tbs: "tbsp", teaspoon: "tsp", tsp: "tsp",
  gallon: "gal", gal: "gal", package: "pkg", pkg: "pkg",
};
export const unitKey = (unit) => {
  let u = String(unit || "").toLowerCase().trim().replace(/\.$/, "");
  if (u.length > 2 && u.endsWith("es") && /(ch|sh|x)es$/.test(u)) u = u.slice(0, -2);
  else if (u.length > 2 && u.endsWith("s")) u = u.slice(0, -1);
  return UNIT_ALIASES[u] || u;
};
