// Turns form input or imported JSON into a clean recipe document,
// collecting human-readable warnings for anything it had to fix.
import { PROTEINS, DIFFICULTIES, COOK_METHODS, SEASONS, COURSES } from "./constants.js";
import { SECTION_ORDER, FALLBACK_SECTION } from "../sections.js";
import { findGroceryMatch } from "./utils.js";

const squash = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

// Build lookup: squashed alias → key. Each option matches its key and label.
const lookup = (options, aliases = {}) => {
  const map = {};
  options.forEach((o) => { map[squash(o.key)] = o.key; map[squash(o.label)] = o.key; });
  Object.entries(aliases).forEach(([alias, key]) => { map[squash(alias)] = key; });
  return map;
};

const PROTEIN_MAP = lookup(PROTEINS, {
  fish: "fish", seafood: "fish", "fish/seafood": "fish", shrimp: "fish", salmon: "fish",
  veg: "vegetarian", veggie: "vegetarian", vegan: "vegetarian", meatless: "vegetarian",
  ham: "pork", sausage: "pork", bacon: "pork", steak: "beef", lamb: "other",
});
const DIFFICULTY_MAP = lookup(DIFFICULTIES, { simple: "easy", moderate: "medium", intermediate: "medium", advanced: "hard" });
const METHOD_MAP = lookup(COOK_METHODS, {
  "slow cooker": "slow_cooker", crockpot: "slow_cooker", "crock pot": "slow_cooker",
  "instant pot": "slow_cooker", "pressure cooker": "slow_cooker",
  stove: "stovetop", "stove top": "stovetop", skillet: "stovetop",
  bake: "oven", baked: "oven", roast: "oven", broil: "oven",
  grilled: "grill", bbq: "grill", "no cook": "no_cook", raw: "no_cook",
});
const SEASON_MAP = lookup(SEASONS, { autumn: "fall" });
const COURSE_MAP = lookup(COURSES, {
  sides: "side", "side dish": "side", "side salad": "side",
  entree: "main", "main dish": "main", "main course": "main", dinner: "main",
});
const YEAR_ROUND = new Set(["yearround", "all", "any", "allyear"]);

const SECTION_MAP = Object.fromEntries(SECTION_ORDER.map((s) => [squash(s), s]));
Object.assign(SECTION_MAP, {
  meat: "Meat & Seafood", seafood: "Meat & Seafood", fish: "Meat & Seafood",
  dairy: "Dairy & Eggs", eggs: "Dairy & Eggs", cheese: "Dairy & Eggs",
  bread: "Bakery", vegetables: "Produce", fruit: "Produce", veggies: "Produce",
  canned: "Pantry", spices: "Pantry", baking: "Pantry", "drygoods": "Pantry",
  freezer: "Frozen", other: FALLBACK_SECTION,
});

const UNICODE_FRACTIONS = { "¼": "1/4", "½": "1/2", "¾": "3/4", "⅓": "1/3", "⅔": "2/3" };

// Is this text just a number? ("2", "1.5", "1/2", "1 1/2", "1½")
export const isPlainQty = (v) =>
  /^\s*(\d+(\.\d+)?|\d+\/\d+|\d+\s+\d+\/\d+|\d*\s*[¼½¾⅓⅔])\s*$/.test(String(v ?? ""));

// "2" → 2, "1.5" → 1.5, "1/2" → 0.5, "1 1/2" → 1.5, "" → null
export const parseQty = (v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  // Unicode fractions ("1½", "¾") → "1 1/2", "3/4"
  const s = String(v).trim()
    .replace(/(\d)?\s*([¼½¾⅓⅔])/, (_, w, f) => `${w ? w + " " : ""}${UNICODE_FRACTIONS[f]}`);
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return +mixed[1] + mixed[2] / mixed[3];
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return frac[2] > 0 ? frac[1] / frac[2] : null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

const toPositiveInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const asList = (v) =>
  Array.isArray(v) ? v : typeof v === "string" && v.trim() ? v.split(/[,;]/) : [];

// Find a section for an ingredient name using what's already on the grocery list.
export const guessSection = (name, groceryItems = []) =>
  findGroceryMatch(name, groceryItems)?.section || null;

/**
 * Returns { recipe, warnings }. `recipe` is ready to save to Firestore
 * (no undefined values). Warnings are short strings for the import preview.
 */
export function normalizeRecipe(raw, groceryItems = []) {
  const warnings = [];
  const str = (v) => (v === null || v === undefined ? "" : String(v).trim());

  const pickOne = (value, map, label) => {
    if (!str(value)) return null;
    const key = map[squash(value)];
    if (!key) warnings.push(`Unknown ${label} "${value}" — left blank`);
    return key || null;
  };

  const pickMany = (value, map, label, allowYearRound = false) => {
    const out = [];
    asList(value).forEach((v) => {
      if (!str(v)) return;
      if (allowYearRound && YEAR_ROUND.has(squash(v))) return;
      const key = map[squash(v)];
      if (key) { if (!out.includes(key)) out.push(key); }
      else warnings.push(`Unknown ${label} "${v}" — skipped`);
    });
    return out;
  };

  const ingredients = [];
  (Array.isArray(raw.ingredients) ? raw.ingredients : []).forEach((ing) => {
    // Allow plain strings: "2 lb chicken thighs" is kept as the name.
    const item = typeof ing === "string" ? { name: ing } : ing || {};
    const name = str(item.name);
    if (!name) return;
    let section = item.section ? SECTION_MAP[squash(item.section)] : null;
    if (!section) {
      section = guessSection(name, groceryItems);
      if (!section) {
        section = FALLBACK_SECTION;
        warnings.push(item.section
          ? `"${name}": unknown section "${item.section}" → ${FALLBACK_SECTION}`
          : `"${name}": no section → ${FALLBACK_SECTION}`);
      }
    }
    ingredients.push({ name, qty: parseQty(item.qty ?? item.quantity), unit: str(item.unit), section });
  });

  const recipe = {
    name:          str(raw.name),
    course:        pickOne(raw.course, COURSE_MAP, "dish type") || "main",
    protein:       pickOne(raw.protein, PROTEIN_MAP, "protein"),
    difficulty:    pickOne(raw.difficulty, DIFFICULTY_MAP, "difficulty"),
    total_minutes: toPositiveInt(raw.total_minutes),
    cook_methods:  pickMany(raw.cook_methods, METHOD_MAP, "cook method"),
    seasons:       pickMany(raw.seasons, SEASON_MAP, "season", true),
    servings:      toPositiveInt(raw.servings),
    source_url:    str(raw.source_url),
    photo_url:     str(raw.photo_url),
    instructions:  str(raw.instructions),
    notes:         str(raw.notes),
    ingredients,
  };
  if (recipe.source_url && !/^https?:\/\//i.test(recipe.source_url)) {
    recipe.source_url = `https://${recipe.source_url}`;
  }
  return { recipe, warnings };
}
