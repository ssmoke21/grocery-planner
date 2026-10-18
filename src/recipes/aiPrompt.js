// The prompt people paste into an AI tool (Claude, ChatGPT, …) along with a
// recipe photo, link, or text. Built from the app's own option lists so it
// never drifts out of date.
import { PROTEINS, DIFFICULTIES, COOK_METHODS, SEASONS, COURSES } from "./constants.js";
import { SECTION_ORDER, FALLBACK_SECTION } from "../sections.js";

const keys = (list) => list.map((o) => o.key).join(", ");
const sections = SECTION_ORDER.filter((s) => s !== FALLBACK_SECTION).join(", ");

export const AI_PROMPT = `Convert the recipe(s) I'm sharing (photo, link, or text) into JSON for my grocery app. Reply with ONLY a JSON array — no explanation, no markdown.

Each recipe is an object with these fields (only "name" is required):
- name: text
- course: one of ${keys(COURSES)} (use "side" for side dishes and side salads)
- protein: one of ${keys(PROTEINS)}
- difficulty: one of ${keys(DIFFICULTIES)}
- total_minutes: number (prep + cook)
- cook_methods: list, any of ${keys(COOK_METHODS)} (slow_cooker includes Instant Pot)
- seasons: list, any of ${keys(SEASONS)}; use [] for year-round
- servings: number
- source_url: the link, if there is one
- instructions: numbered steps separated by \\n
- notes: anything useful (tips, substitutions, cookbook page)
- ingredients: list of { "name", "qty", "unit", "section" }
  - name: plain shopping name ("yellow onion", not "1 yellow onion, finely diced")
  - qty: a number or null
  - unit: text like "lb", "cup", "can", or ""
  - section: one of ${sections}
  - leave out water, salt, and pepper

Example:
[{"name":"Sheet Pan Chicken Fajitas","course":"main","protein":"chicken","difficulty":"easy","total_minutes":35,"cook_methods":["oven"],"seasons":[],"servings":4,"source_url":"","instructions":"1. Heat oven to 425°F.\\n2. Toss sliced chicken, peppers, and onion with oil and seasoning.\\n3. Roast 20–25 min.","notes":"","ingredients":[{"name":"chicken breasts","qty":1.5,"unit":"lb","section":"Meat & Seafood"},{"name":"bell peppers","qty":3,"unit":"","section":"Produce"},{"name":"flour tortillas","qty":8,"unit":"","section":"Bakery"}]}]`;
