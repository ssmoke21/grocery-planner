// ── Easy-to-change thresholds ────────────────────────────────
export const FAVORITE_MIN_TIMES   = 3;   // "Favorites" = made at least this many times
export const NOT_IN_A_WHILE_DAYS  = 60;  // "Not in a while" = not made in this many days

// ── Recipe options ───────────────────────────────────────────
export const PROTEINS = [
  { key: "chicken",    label: "Chicken",        icon: "🍗", tint: "#FFF1DC" },
  { key: "fish",       label: "Fish / Seafood", icon: "🐟", tint: "#E1F0FA" },
  { key: "beef",       label: "Beef",           icon: "🥩", tint: "#FBE3E0" },
  { key: "turkey",     label: "Turkey",         icon: "🦃", tint: "#F4E9DC" },
  { key: "pork",       label: "Pork",           icon: "🥓", tint: "#FCE6EC" },
  { key: "vegetarian", label: "Vegetarian",     icon: "🥦", tint: "#E6F4DC" },
  { key: "other",      label: "Other",          icon: "🍽️", tint: "#EEEDE6" },
];

// Recipes without a course count as mains.
export const COURSES = [
  { key: "main", label: "Main",      icon: "🍽️" },
  { key: "side", label: "Side dish", icon: "🥗" },
];
export const courseOf = (recipe) => (recipe.course === "side" ? "side" : "main");

export const DIFFICULTIES = [
  { key: "easy",   label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard",   label: "Hard" },
];

export const TIME_BUCKETS = [
  { key: "quick",  label: "Quick",  hint: "≤30 min" },
  { key: "medium", label: "Medium", hint: "31–60 min" },
  { key: "long",   label: "Long",   hint: "60+ min" },
];

export const COOK_METHODS = [
  { key: "oven",        label: "Oven" },
  { key: "stovetop",    label: "Stovetop" },
  { key: "grill",       label: "Grill" },
  { key: "slow_cooker", label: "Slow cooker / Instant Pot" },
  { key: "air_fryer",   label: "Air fryer" },
  { key: "no_cook",     label: "No-cook" },
];

export const SEASONS = [
  { key: "spring", label: "Spring", icon: "🌷" },
  { key: "summer", label: "Summer", icon: "☀️" },
  { key: "fall",   label: "Fall",   icon: "🍂" },
  { key: "winter", label: "Winter", icon: "❄️" },
];

export const SORTS = [
  { key: "az",     label: "A–Z" },
  { key: "most",   label: "Most made" },
  { key: "oldest", label: "Least recently made" },
];

// Lookup helpers: byKey(PROTEINS).chicken → { key, label, ... }
export const byKey = (list) => Object.fromEntries(list.map((o) => [o.key, o]));
