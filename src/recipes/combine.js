// Merges ingredients across the week's recipes and works out how each one lands
// on the grocery list. A per-household ledger remembers what each planned meal
// has already added, so rebuilding only adds the difference and removing a meal
// can take its items back off.
//
// Ledger entry: { week, recipe_id, key, status: "added" | "have",
//                 item_id, created, prev: { qty, unit, is_selected }, qty, unit }
import { SECTION_ORDER, FALLBACK_SECTION } from "../sections.js";
import { nameKey, unitKey, prettyNumber, findGroceryMatch } from "./utils.js";
import { parseQty, isPlainQty } from "./normalize.js";

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const text = (v) => String(v ?? "").trim();

const sameMeal = (e, week, recipeId, key) =>
  e.week === week && e.recipe_id === recipeId && (key === undefined || e.key === key);

// Combine amounts that share a unit: [{qty, unit}] → one per distinct unit.
const sumAmounts = (list) => {
  const out = [];
  list.forEach(({ qty, unit }) => {
    if (typeof qty !== "number") return;
    const hit = out.find((a) => unitKey(a.unit) === unitKey(unit));
    if (hit) hit.qty += qty;
    else out.push({ qty, unit: text(unit) });
  });
  return out;
};

// [{qty: 2, unit: "cup"}, {qty: 1, unit: "can"}] → "2 cup + 1 can"
export const formatAmounts = (amounts) =>
  amounts.map((a) => [prettyNumber(a.qty), a.unit].filter(Boolean).join(" ")).join(" + ");

// A starting qty/unit plus recipe amounts → the free-text qty/unit to show.
export const mergedQty = (base, amounts) => {
  const b = { qty: text(base?.qty), unit: text(base?.unit) };
  const sum = sumAmounts(amounts);
  if (!sum.length) return b;
  if (!b.qty && !b.unit) {
    return sum.length === 1
      ? { qty: String(prettyNumber(sum[0].qty)), unit: sum[0].unit }
      : { qty: formatAmounts(sum), unit: "" };
  }
  if (sum.length === 1 && isPlainQty(b.qty) && unitKey(b.unit) === unitKey(sum[0].unit)) {
    return { qty: String(prettyNumber(parseQty(b.qty) + sum[0].qty)), unit: b.unit || sum[0].unit };
  }
  return { qty: `${[b.qty, b.unit].filter(Boolean).join(" ")} + ${formatAmounts(sum)}`, unit: "" };
};

// An item that was switched off doesn't add its old amount to the recipe's.
const startingPoint = (prev) => (prev?.is_selected ? prev : { qty: "", unit: "" });

const sameQty = (a, b) => text(a.qty) === text(b.qty) && unitKey(a.unit) === unitKey(b.unit);

/**
 * Returns {
 *   sections: [{ section, items: [{ key, name, section, amounts, parts, recipes, existing, startsHave }] }],
 *   noIngredients: [recipe names],
 *   alreadyAdded: number of ingredients from this plan already on the list,
 * }
 * Recipes may carry a `scale` (servings adjustment).
 */
export function combineIngredients(recipes, groceryItems, { ledger = [], week } = {}) {
  const byKey = new Map();
  const noIngredients = [];
  const alreadyAdded = new Set();
  const liveIds = new Set(groceryItems.map((i) => i.id));

  recipes.forEach((r) => {
    if (!r.ingredients?.length) { noIngredients.push(r.name); return; }
    const scale = r.scale || 1;
    r.ingredients.forEach((ing) => {
      const key = nameKey(ing.name);
      if (!key) return;
      let qty = typeof ing.qty === "number" ? ing.qty * scale : null;

      const entries = ledger.filter((e) => sameMeal(e, week, r.id, key));
      const added = entries.filter((e) => e.status === "added" && liveIds.has(e.item_id));
      if (added.length) {
        // Only what's beyond the earlier amount is still needed (e.g. after doubling).
        if (qty === null) { alreadyAdded.add(key); return; }
        const before = added
          .filter((e) => unitKey(e.unit) === unitKey(ing.unit))
          .reduce((n, e) => n + (e.qty || 0), 0);
        qty -= before;
        if (qty < 0.001) { alreadyAdded.add(key); return; }
      }

      let item = byKey.get(key);
      if (!item) {
        item = {
          key, name: capitalize(ing.name.trim()),
          section: ing.section || FALLBACK_SECTION,
          parts: [], recipes: [],
          existing: findGroceryMatch(ing.name, groceryItems) || null,
        };
        byKey.set(key, item);
      }
      if (!item.recipes.includes(r.name)) item.recipes.push(r.name);
      item.parts.push({
        recipe_id: r.id, qty, unit: text(ing.unit),
        have: entries.some((e) => e.status === "have"),
      });
    });
  });

  const groups = {};
  byKey.forEach((item) => {
    item.amounts = sumAmounts(item.parts);
    item.startsHave = item.parts.every((p) => p.have);
    alreadyAdded.delete(item.key);
    (groups[item.section] ||= []).push(item);
  });
  const order = [...SECTION_ORDER, ...Object.keys(groups).filter((s) => !SECTION_ORDER.includes(s))];
  const sections = order
    .filter((s) => groups[s])
    .map((s) => ({ section: s, items: groups[s].sort((a, b) => a.name.localeCompare(b.name)) }));

  return { sections, noIngredients, alreadyAdded: alreadyAdded.size };
}

/**
 * Plans the writes for one "Add to list".
 * - Not on the list → create it.
 * - On the list but switched off → switch it on with the recipe amount.
 * - Already on → add to the amount when units match; otherwise note both.
 * Returns { creates: [{ id, data }], updates: [{ id, changes }], ledger }.
 * `makeId` supplies an id for each new grocery item.
 */
export function planListWrites({ needItems, haveItems = [], week, ledger = [], groceryItems, makeId }) {
  const liveIds = new Set(groceryItems.map((i) => i.id));
  const decided = [...needItems, ...haveItems];
  const isDecided = (e) => e.week === week && decided.some(
    (it) => it.key === e.key && it.parts.some((p) => p.recipe_id === e.recipe_id)
  );
  // Forget deleted items, and earlier "have" answers that are being answered again.
  const kept = ledger.filter((e) =>
    e.status === "added" ? liveIds.has(e.item_id) : !isDecided(e)
  );

  const creates = [];
  const updates = [];
  const newEntries = [];
  const entriesFor = (item, itemId, created, prev) => item.parts.forEach((p) => {
    newEntries.push({
      week, recipe_id: p.recipe_id, key: item.key, status: "added",
      item_id: itemId, created, prev, qty: p.qty, unit: p.unit,
    });
  });

  // Several ingredients can land on one grocery item, so group them first.
  const onExisting = new Map();
  needItems.forEach((item) => {
    if (!item.existing) {
      const id = makeId();
      const { qty, unit } = mergedQty(null, item.parts);
      creates.push({
        id,
        data: {
          name: item.name, section: item.section,
          is_selected: true, is_checked: false, is_staple: false,
          source: "recipe", sort_order: 999, qty, unit,
        },
      });
      entriesFor(item, id, true, { qty: "", unit: "", is_selected: false });
    } else {
      const list = onExisting.get(item.existing.id) || [];
      list.push(item);
      onExisting.set(item.existing.id, list);
    }
  });

  onExisting.forEach((items, id) => {
    const current = groceryItems.find((g) => g.id === id);
    const earlier = kept.filter((e) => e.status === "added" && e.item_id === id);
    const now = { qty: text(current.qty), unit: text(current.unit), is_selected: !!current.is_selected };
    const prev = earlier[0]?.prev || now;
    const parts = items.flatMap((it) => it.parts);

    const expected = earlier.length ? mergedQty(startingPoint(prev), earlier) : null;
    let next;
    if (expected && sameQty(expected, now) && current.is_selected) {
      next = mergedQty(startingPoint(prev), [...earlier, ...parts]);
    } else {
      // Someone changed the amount by hand: respect it and add on top.
      next = mergedQty(startingPoint(now), parts);
      if (!sumAmounts(parts).length) next = { qty: now.qty, unit: now.unit };
    }

    const changes = {};
    if (!current.is_selected) { changes.is_selected = true; changes.is_checked = false; }
    if (!sameQty(next, now)) { changes.qty = next.qty; changes.unit = next.unit; }
    if (Object.keys(changes).length) updates.push({ id, changes });
    items.forEach((it) => entriesFor(it, id, false, prev));
  });

  haveItems.forEach((item) => item.parts.forEach((p) => {
    newEntries.push({ week, recipe_id: p.recipe_id, key: item.key, status: "have", qty: p.qty, unit: p.unit });
  }));

  return { creates, updates, ledger: [...kept, ...newEntries] };
}

/**
 * Plans what taking one meal off the plan does to the list.
 * Returns {
 *   items: [{ id, name, remove: true } | { id, name, changes }],
 *   bought: [names already checked off, left alone],
 *   ledger: the ledger without this meal,
 * }
 */
export function planMealRemoval({ ledger = [], week, recipeId, groceryItems }) {
  const liveById = Object.fromEntries(groceryItems.map((i) => [i.id, i]));
  const isMine = (e) => sameMeal(e, week, recipeId);
  const mine = ledger.filter((e) => isMine(e) && e.status === "added" && liveById[e.item_id]);
  const items = [];
  const bought = [];

  [...new Set(mine.map((e) => e.item_id))].forEach((id) => {
    const item = liveById[id];
    if (item.is_checked) { bought.push(item.name); return; }
    if (!item.is_selected) return; // already switched off by hand

    const all = ledger.filter((e) => e.status === "added" && e.item_id === id);
    const others = all.filter((e) => !isMine(e));
    const prev = all[0].prev;
    const untouched = sameQty(mergedQty(startingPoint(prev), all), { qty: text(item.qty), unit: text(item.unit) });

    if (others.length) {
      if (!untouched) return; // amount was edited by hand and another meal still needs it
      const next = mergedQty(startingPoint(prev), others);
      items.push({ id, name: item.name, changes: { qty: next.qty, unit: next.unit } });
    } else if (all[0].created && !item.is_staple) {
      items.push({ id, name: item.name, remove: true });
    } else {
      items.push({
        id, name: item.name,
        changes: {
          is_selected: !!prev.is_selected,
          ...(untouched ? { qty: prev.qty, unit: prev.unit } : {}),
        },
      });
    }
  });

  return { items, bought, ledger: ledger.filter((e) => !isMine(e)) };
}
