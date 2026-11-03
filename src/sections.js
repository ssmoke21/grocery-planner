// Store sections shared by the grocery list and recipe ingredients.
export const SECTION_ORDER = [
  "Produce", "Meat & Seafood", "Dairy & Eggs", "Bakery", "Pantry",
  "Frozen", "Snacks", "Toddler", "Deli", "Household", "Recipe Items",
];

export const SECTION_ICONS = {
  Produce: "🥬", "Meat & Seafood": "🥩", "Dairy & Eggs": "🥛",
  Bakery: "🍞", Pantry: "🥫", Frozen: "🧊", Snacks: "🍿",
  Toddler: "👶", Deli: "🧀", Household: "🏠", "Recipe Items": "🍳",
};

// Each section's color on the list: its heading text and a light tint.
export const SECTION_COLORS = {
  Produce:          { color: "var(--fg-3f7d2a)", bg: "var(--bg-e4f2da)" },
  "Meat & Seafood": { color: "var(--fg-b03a2e)", bg: "var(--bg-fbe3e0)" },
  "Dairy & Eggs":   { color: "var(--fg-2c6aa0)", bg: "var(--bg-dfedf8)" },
  Bakery:           { color: "var(--fg-a8661a)", bg: "var(--bg-f8ebd6)" },
  Pantry:           { color: "var(--fg-8a5a2b)", bg: "var(--bg-f1e6d8)" },
  Frozen:           { color: "var(--fg-1f7f99)", bg: "var(--bg-ddf1f6)" },
  Snacks:           { color: "var(--fg-c2571a)", bg: "var(--bg-fce5d6)" },
  Toddler:          { color: "var(--fg-b4447a)", bg: "var(--bg-f9e0ec)" },
  Deli:             { color: "var(--fg-96780f)", bg: "var(--bg-f6efcf)" },
  Household:        { color: "var(--fg-6a4fa0)", bg: "var(--bg-e9e3f5)" },
  "Recipe Items":   { color: "var(--fg-2f6b63)", bg: "var(--bg-e0efec)" },
};
const OTHER_COLORS = { color: "var(--fg-6b6658)", bg: "var(--bg-eeede6)" };
export const sectionColors = (section) => SECTION_COLORS[section] || OTHER_COLORS;

// Ingredients with a missing or unknown section land here.
export const FALLBACK_SECTION = "Recipe Items";
