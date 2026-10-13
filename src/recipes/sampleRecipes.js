// Four starter recipes so the library has something to browse.
// Loaded once from the empty-library screen; safe to delete later.
export const SAMPLE_RECIPES = [
  {
    name: "Sheet Pan Lemon Chicken & Potatoes",
    protein: "chicken", difficulty: "easy", total_minutes: 45,
    cook_methods: ["oven"], seasons: [], servings: 4,
    source_url: "",
    instructions:
      "1. Heat oven to 425°F.\n2. Toss potatoes with olive oil, salt and pepper; roast 15 min.\n3. Add chicken thighs, lemon slices and garlic; roast 25 min more until chicken reaches 165°F.\n4. Finish with chopped parsley.",
    notes: "Toddler loves the potatoes. Double for leftovers.",
    ingredients: [
      { name: "chicken thighs", qty: 2, unit: "lb", section: "Meat & Seafood" },
      { name: "baby potatoes", qty: 1.5, unit: "lb", section: "Produce" },
      { name: "lemon", qty: 2, unit: "", section: "Produce" },
      { name: "garlic", qty: 4, unit: "cloves", section: "Produce" },
      { name: "parsley", qty: 1, unit: "bunch", section: "Produce" },
      { name: "olive oil", qty: null, unit: "", section: "Pantry" },
    ],
  },
  {
    name: "Grilled Salmon Tacos",
    protein: "fish", difficulty: "medium", total_minutes: 30,
    cook_methods: ["grill"], seasons: ["spring", "summer"], servings: 4,
    source_url: "",
    instructions:
      "1. Season salmon with chili powder, cumin, salt.\n2. Grill 4–5 min per side.\n3. Mix slaw: cabbage, lime juice, a little mayo.\n4. Flake salmon into warm tortillas and top with slaw and avocado.",
    notes: "",
    ingredients: [
      { name: "salmon fillets", qty: 1.5, unit: "lb", section: "Meat & Seafood" },
      { name: "corn tortillas", qty: 12, unit: "", section: "Bakery" },
      { name: "shredded cabbage", qty: 1, unit: "bag", section: "Produce" },
      { name: "limes", qty: 2, unit: "", section: "Produce" },
      { name: "avocado", qty: 2, unit: "", section: "Produce" },
      { name: "mayonnaise", qty: null, unit: "", section: "Pantry" },
    ],
  },
  {
    name: "Slow Cooker Beef Chili",
    protein: "beef", difficulty: "easy", total_minutes: 480,
    cook_methods: ["slow_cooker", "stovetop"], seasons: ["fall", "winter"], servings: 6,
    source_url: "",
    instructions:
      "1. Brown beef with onion; drain.\n2. Add everything to the slow cooker.\n3. Cook on low 8 hours.\n4. Serve with shredded cheese and sour cream.",
    notes: "Freezes well.",
    ingredients: [
      { name: "ground beef", qty: 2, unit: "lb", section: "Meat & Seafood" },
      { name: "onion", qty: 1, unit: "", section: "Produce" },
      { name: "kidney beans", qty: 2, unit: "can", section: "Pantry" },
      { name: "diced tomatoes", qty: 2, unit: "can", section: "Pantry" },
      { name: "chili seasoning", qty: 1, unit: "packet", section: "Pantry" },
      { name: "shredded cheddar", qty: 1, unit: "bag", section: "Dairy & Eggs" },
      { name: "sour cream", qty: 1, unit: "tub", section: "Dairy & Eggs" },
    ],
  },
  {
    name: "Caprese Pasta Salad",
    protein: "vegetarian", difficulty: "easy", total_minutes: 20,
    cook_methods: ["stovetop"], seasons: ["summer"], servings: 4,
    source_url: "",
    instructions: "",
    notes: "No ingredients saved yet — good for testing.",
    ingredients: [],
  },
];
