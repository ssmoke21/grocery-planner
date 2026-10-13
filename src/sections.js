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

// Ingredients with a missing or unknown section land here.
export const FALLBACK_SECTION = "Recipe Items";
