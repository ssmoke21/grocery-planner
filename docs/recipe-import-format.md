# Recipe import format

The **Recipes → Import** screen accepts JSON in this format. Paste it, tap **Check** to preview, then tap **Import**. Nothing is saved until you tap Import.

## Quick start: have Claude make the JSON

Paste this into Claude chat, followed by the recipe text, a website link, or a photo of a recipe card:

> Convert the recipe(s) below into JSON for my grocery app, following this exact format. Output only the JSON array, no commentary.
>
> - `name` (required), `course`, `protein`, `difficulty`, `total_minutes`, `cook_methods`, `seasons`, `servings`, `source_url`, `instructions`, `notes`, `photo_url`, `ingredients`
> - `course`: `main` or `side` (use `side` for side dishes and side salads)
> - `protein`: one of `chicken`, `fish`, `beef`, `turkey`, `pork`, `vegetarian`, `other`
> - `difficulty`: one of `easy`, `medium`, `hard`
> - `cook_methods`: any of `oven`, `stovetop`, `grill`, `slow_cooker` (includes Instant Pot), `air_fryer`, `no_cook`
> - `seasons`: any of `spring`, `summer`, `fall`, `winter`. Use `[]` for year-round.
> - `ingredients`: list of `{ "name", "qty", "unit", "section" }`. `qty` is a number or null. `section` is one of: Produce, Meat & Seafood, Dairy & Eggs, Bakery, Pantry, Frozen, Snacks, Toddler, Deli, Household.
> - Use plain shopping names for ingredients ("yellow onion", not "1 yellow onion, finely diced"). Leave out water, salt, and pepper.
> - `instructions`: numbered steps separated by `\n`.

## Full example

```json
[
  {
    "name": "Sheet Pan Chicken Fajitas",
    "course": "main",
    "protein": "chicken",
    "difficulty": "easy",
    "total_minutes": 35,
    "cook_methods": ["oven"],
    "seasons": [],
    "servings": 4,
    "source_url": "https://example.com/sheet-pan-fajitas",
    "photo_url": "",
    "instructions": "1. Heat oven to 425°F.\n2. Slice chicken, peppers, and onion; toss with oil and fajita seasoning.\n3. Spread on a sheet pan and roast 20–25 min.\n4. Serve in warm tortillas with toppings.",
    "notes": "Toddler likes it without the seasoning — set a few strips aside.",
    "ingredients": [
      { "name": "chicken breasts",   "qty": 1.5,  "unit": "lb",     "section": "Meat & Seafood" },
      { "name": "bell peppers",      "qty": 3,    "unit": "",       "section": "Produce" },
      { "name": "yellow onion",      "qty": 1,    "unit": "",       "section": "Produce" },
      { "name": "fajita seasoning",  "qty": 1,    "unit": "packet", "section": "Pantry" },
      { "name": "flour tortillas",   "qty": 8,    "unit": "",       "section": "Bakery" },
      { "name": "sour cream",        "qty": 1,    "unit": "tub",    "section": "Dairy & Eggs" },
      { "name": "olive oil",         "qty": null, "unit": "",       "section": "Pantry" }
    ]
  }
]
```

## Field reference

| Field | Required? | Type | Notes |
|---|---|---|---|
| `name` | **yes** | text | Recipes with the same name as one already in the library are skipped (capital letters and extra spaces are ignored). |
| `course` | no | text | `main` or `side`. Leave it out for mains. "Side dish", "entree" and similar words are understood. |
| `protein` | no | text | `chicken`, `fish`, `beef`, `turkey`, `pork`, `vegetarian`, `other`. Common words like "seafood", "salmon", "veggie", or "bacon" are understood too. |
| `difficulty` | no | text | `easy`, `medium`, `hard` |
| `total_minutes` | no | number | Prep + cook time. Shown as **Quick** (≤30), **Medium** (31–60), or **Long** (60+). |
| `cook_methods` | no | list | `oven`, `stovetop`, `grill`, `slow_cooker`, `air_fryer`, `no_cook`. "Instant Pot", "crockpot", "skillet", etc. are understood. |
| `seasons` | no | list | `spring`, `summer`, `fall`, `winter`. Empty list (or `"year-round"`) means year-round. "Autumn" works too. |
| `servings` | no | number | |
| `source_url` | no | text | Link to the original recipe. |
| `photo_url` | no | text | Optional image link. Saved for later; photos aren't shown in the app yet. |
| `instructions` | no | text | Use `\n` for line breaks. |
| `notes` | no | text | |
| `ingredients` | no | list | A recipe with no ingredients is fine. |

### Ingredient fields

| Field | Required? | Notes |
|---|---|---|
| `name` | **yes** | Ingredients without a name are dropped. |
| `qty` | no | A number (`2`, `0.5`) or a fraction as text (`"1/2"`, `"1 1/2"`). Use `null` if there's no amount. |
| `unit` | no | Free text: `lb`, `cup`, `can`, `bunch`… |
| `section` | no | One of the grocery list sections (above). Shorthand like "Dairy", "Meat", or "Spices" is understood. If it's missing, the app tries the section that item already uses on your grocery list. If there's still no match, it goes to **Recipe Items**. |

## Other accepted shapes

- A single recipe object (no `[ ]`) works.
- `{ "recipes": [ ... ] }` works.
- An ingredient can be a plain string such as `"2 limes"`. The whole string becomes the name, so the structured form is better.

## What the preview tells you

- ✅ The recipe is ready to import as-is.
- ⚠️ It will import, but something was adjusted, such as an unknown section moved to Recipe Items or an unrecognized cook method dropped.
- ⏭ It will be skipped: a duplicate name, or no name at all.
