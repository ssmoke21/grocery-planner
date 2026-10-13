# 🛒 Grocery Planner

A mobile-friendly grocery and meal planner for our family. Pick meals for the week, check what we already have, and shop from one shared list, with changes syncing live across both phones.

## Features

### 🛒 List
- **Plan mode**: toggle staples on/off, set quantities, add custom items, organized by store section
- **Shop mode**: check items off in the store, with a progress bar
- **New Week**: saves shopping history, clears non-staples, resets staples

### 📖 Recipes
- Library with search, combinable filters (usage, protein, difficulty, time, cook method, season), an **In season** toggle, and sorting (A–Z, most made, least recently made)
- Usage filters: **Favorites** (made 3+ times), **Never made**, **Not in a while** (60+ days). The thresholds are at the top of `src/recipes/constants.js`.
- Add / edit / delete recipes, with optional ingredients (each with qty, unit, and store section)
- **Bulk import** from JSON. The format, plus a ready-made prompt for Claude chat, is in [docs/recipe-import-format.md](docs/recipe-import-format.md).

### 📅 This Week
- Pick recipes for this week or next. Planning a recipe counts as "made it" in the usage history.
- **Build grocery list** → "What do we have?" review: ingredients from all the week's recipes are merged and grouped by section, you mark what you already have, and the rest goes onto the list. Items already on the list are switched on or have their amount increased, never duplicated.

## Tech stack
- React + Vite (no router; tabs and full-screen sheets)
- Firebase Firestore (database + real-time sync), free Spark plan
- Hosted on Vercel; every push to `main` deploys automatically

## Data (Firestore collections)
| Collection | Holds |
|---|---|
| `grocery_items` | The grocery list (name, section, qty, unit, selected/checked/staple flags) |
| `app_state/main` | Plan vs Shop mode |
| `shopping_history` | Items saved each time "New Week" is tapped |
| `recipes` | Recipes, with ingredients stored as a list inside each recipe |
| `meal_plan` | One entry per recipe per week (`week_start` = Monday). Doubles as the "made it" history. |

## Code layout
- `src/App.jsx`: header, tabs, and the grocery list (Plan / Shop)
- `src/sections.js`: store sections shared by the list and recipe ingredients
- `src/recipes/`: the recipe library, form, import, weekly plan, and grocery review
  - `normalize.js`: cleans up form/import input (aliases, fractions, sections)
  - `combine.js`: merges the week's ingredients and plans the grocery-list writes

## Running locally
```bash
npm install
npm run dev
```
