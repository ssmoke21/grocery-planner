// ── Easy-to-change thresholds ────────────────────────────────
export const FAVORITE_MIN_TIMES   = 3;   // "Favorites" = made at least this many times
export const NOT_IN_A_WHILE_DAYS  = 60;  // "Not in a while" = not made in this many days

// ── Recipe options ───────────────────────────────────────────
export const PROTEINS = [
  { key: "chicken",    label: "Chicken",        icon: "🍗", tint: "var(--bg-fff1dc)" },
  { key: "fish",       label: "Fish / Seafood", icon: "🐟", tint: "var(--bg-e1f0fa)" },
  { key: "beef",       label: "Beef",           icon: "🥩", tint: "var(--bg-fbe3e0)" },
  { key: "turkey",     label: "Turkey",         icon: "🦃", tint: "var(--bg-f4e9dc)" },
  { key: "pork",       label: "Pork",           icon: "🥓", tint: "var(--bg-fce6ec)" },
  { key: "vegetarian", label: "Vegetarian",     icon: "🥦", tint: "var(--bg-e6f4dc)" },
  { key: "other",      label: "Other",          icon: "🍽️", tint: "var(--bg-eeede6)" },
];

// A recipe can have several of these. Dinner suggestions only use "dinner" recipes.
export const MEALS = [
  { key: "breakfast", label: "Breakfast", icon: "🍳" },
  { key: "lunch",     label: "Lunch",     icon: "🥪" },
  { key: "dinner",    label: "Dinner",    icon: "🌙" },
  { key: "side",      label: "Side dish", icon: "🥗" },
  { key: "dessert",   label: "Dessert",   icon: "🍪" },
];

// Recipes saved before Dish and Meal were combined have a separate "course"
// field. Side dishes and desserts become meal tags and stop counting as dinner.
export const withCombinedMeals = ({ course, ...recipe }) => {
  if (course !== "side" && course !== "dessert") return recipe;
  const meals = (recipe.meals || []).filter((m) => m !== "dinner" && m !== course);
  return { ...recipe, meals: [...meals, course] };
};

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
  { key: "popular", label: "Popular with others" },
  { key: "rated", label: "Top rated" },
];

// Lookup helpers: byKey(PROTEINS).chicken → { key, label, ... }
export const byKey = (list) => Object.fromEntries(list.map((o) => [o.key, o]));
