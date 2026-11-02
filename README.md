# 🛒 Grocery Planner

A mobile-friendly grocery and meal planner shared among a few friends' households. Each household has its own private list and meal plan, opened with its own link, and everyone shares one recipe library. There are no logins.

## Features

### 🛒 List (private to each household)
- **Plan mode**: toggle staples on/off, set quantities, add items by store section
- **Shop mode**: check items off in the store, with a progress bar
- **New Week**: saves shopping history, clears non-staples, resets staples
- **Undo** after deleting an item

### 📖 Recipes (shared)
- Search, sort, and combine filters: recipes from (mine / others / a household), usage, your rating, meal (breakfast, lunch, dinner, side dish, dessert), protein, difficulty, time, cook method, season, and "needs details"
- Card and compact views
- Add, edit and delete your own recipes; **Save a copy** of anyone else's
- **Rate 1–5 stars** per household, and see what other households make ("Popular with others")
- **Adjust servings** and use **Cook mode** (large text, tap off steps, screen stays on where the phone allows it)
- **Bulk import** from JSON, with a one-tap prompt for AI tools. Format: [docs/recipe-import-format.md](docs/recipe-import-format.md)

### 📅 Meal Plan (private to each household)
- Opens on next week, and **Past weeks** looks back at earlier meals and can plan them again
- Plan this week or next, by hand and/or with **Suggest dinners**: a seasonal mix of old favorites, regulars and new recipes that varies protein and cooking style
- **Build grocery list** → "What do we have?" review. Ingredients are merged and grouped by section, and only what you need goes on the list.
- Rebuilding only adds what's new, and removing a meal offers to take its items back off

### 🏠 Households and 🔐 Admin
- A household's link (`/?h=CODE`) opens it, and the device remembers it
- The admin household can create, rename, copy links for, and delete households

## Tech stack
- React + Vite (no router; tabs and full-screen sheets), installable to the home screen
- Firebase Firestore (database + real-time sync), free Spark plan
- Hosted on Vercel; every push to `main` deploys automatically

## Data
The secret household code is the only key to a household, so it must never appear in shared data. Shared data uses a separate `public_id`. Rules are in [firestore.rules](firestore.rules), pasted into the Firebase console by hand; `scripts/check-rules.mjs` tests them from the outside. Without logins, anyone with a household's link can change that household, and a determined person could change shared recipes.

| Location | Holds |
|---|---|
| `households/{code}` | Name, `public_id`, `is_admin`. Can be opened by code, never listed. |
| `households/{code}/grocery_items` | The list |
| `households/{code}/app_state/main` | Plan vs Shop mode |
| `households/{code}/app_state/list_ledger` | What each planned meal added to the list. Cleared by New Week. |
| `households/{code}/shopping_history` | Saved by New Week |
| `households/{code}/meal_plan` | One entry per recipe per week (`week_start` = Monday, optional `scale`). Doubles as "made it" history. |
| `households/{adminCode}/directory` | The admin's list of all households and their codes |
| `household_profiles/{public_id}` | Public household names |
| `recipes` | Shared recipes: `owner_id`, `meals`, ingredients, `planned_by` and `ratings` per household |

## Code layout
- `src/HouseholdGate.jsx`, `src/household.js`: which household this device is on
- `src/App.jsx`: header, tabs, and the grocery list
- `src/admin/`: admin tools, loaded only for the admin household. Add a tool in `tools.js`.
- `src/recipes/`: library, form, import, weekly plan, review, cook mode
  - `constants.js`: option lists and thresholds (favorites, "not in a while")
  - `combine.js`: merges ingredients and plans grocery-list changes using the ledger
  - `recommend.js`: dinner suggestions
  - `normalize.js`: cleans up form and import input
- `scripts/`: backup, one-time migrations, rules check, icon generator. Private output goes in `backups/`, which is not committed.

## Running locally
```bash
npm install
npm run dev
```
The app talks to the live database even when run locally, so test with a throwaway household.
