// Merges ingredients across the week's recipes and works out how each
// one lands on the grocery list.
import { SECTION_ORDER, FALLBACK_SECTION } from "../sections.js";
import { nameKey, unitKey, prettyNumber, findGroceryMatch } from "./utils.js";
import { parseQty, isPlainQty } from "./normalize.js";

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Returns {
 *   sections: [{ section, items: [{ key, name, section, amounts, recipes, existing }] }],
 *   noIngredients: [recipe names],
 * }
 * `amounts` is a list of { unit, qty } — one entry per distinct unit.
 */
export function combineIngredients(recipes, groceryItems) {
  const byKey = new Map();
  const noIngredients = [];

  recipes.forEach((r) => {
    if (!r.ingredients?.length) { noIngredients.push(r.name); return; }
    r.ingredients.forEach((ing) => {
      const key = nameKey(ing.name);
      if (!key) return;
      let item = byKey.get(key);
      if (!item) {
        item = {
          key, name: capitalize(ing.name.trim()),
          section: ing.section || FALLBACK_SECTION,
          amounts: [], recipes: [],
          existing: findGroceryMatch(ing.name, groceryItems) || null,
        };
        byKey.set(key, item);
      }
      if (!item.recipes.includes(r.name)) item.recipes.push(r.name);
      if (typeof ing.qty === "number") {
        const uk = unitKey(ing.unit);
        const amt = item.amounts.find((a) => unitKey(a.unit) === uk);
        if (amt) amt.qty += ing.qty;
        else item.amounts.push({ unit: (ing.unit || "").trim(), qty: ing.qty });
      }
    });
  });

  const groups = {};
  byKey.forEach((item) => { (groups[item.section] ||= []).push(item); });
  const order = [...SECTION_ORDER, ...Object.keys(groups).filter((s) => !SECTION_ORDER.includes(s))];
  const sections = order
    .filter((s) => groups[s])
    .map((s) => ({ section: s, items: groups[s].sort((a, b) => a.name.localeCompare(b.name)) }));

  return { sections, noIngredients };
}

// [{qty: 2, unit: "cup"}, {qty: 1, unit: "can"}] → "2 cup + 1 can"
export const formatAmounts = (amounts) =>
  amounts.map((a) => [prettyNumber(a.qty), a.unit].filter(Boolean).join(" ")).join(" + ");

// What to store in grocery_items' free-text qty/unit fields.
const toQtyUnit = (amounts) => {
  if (amounts.length === 1) return { qty: String(prettyNumber(amounts[0].qty)), unit: amounts[0].unit };
  return { qty: formatAmounts(amounts), unit: "" };
};

/**
 * Plans the grocery_items writes for the "Need" items.
 * Returns { creates: [doc], updates: [{ id, changes }] }.
 * - Not on the list → create it in the ingredient's section.
 * - On the list but switched off → switch it on (and set the recipe amount).
 * - Already switched on → add to the amount when units match; otherwise note both.
 */
export function planGroceryWrites(needItems) {
  const creates = [];
  const pending = new Map(); // existing id → { item state, changes }

  needItems.forEach((item) => {
    const ours = item.amounts.length ? toQtyUnit(item.amounts) : null;
    if (!item.existing) {
      creates.push({
        name: item.name, section: item.section,
        is_selected: true, is_checked: false, is_staple: false,
        source: "recipe", sort_order: 999,
        qty: ours?.qty || "", unit: ours?.unit || "",
      });
      return;
    }

    // Several ingredients can match the same grocery item — apply them in turn.
    const entry = pending.get(item.existing.id) || { state: { ...item.existing }, changes: {} };
    const s = entry.state;
    const apply = (c) => { Object.assign(s, c); Object.assign(entry.changes, c); };

    if (!s.is_selected) {
      apply({ is_selected: true, is_checked: false, ...(ours || {}) });
    } else if (ours) {
      const theirQty = parseQty(s.qty);
      const single = item.amounts.length === 1 ? item.amounts[0] : null;
      if (!String(s.qty || "").trim() && !String(s.unit || "").trim()) {
        apply(ours);
      } else if (single && theirQty !== null && isPlainQty(s.qty)
                 && unitKey(s.unit) === unitKey(single.unit)) {
        apply({ qty: String(prettyNumber(theirQty + single.qty)) });
      } else {
        const theirs = [s.qty, s.unit].filter((v) => String(v || "").trim()).join(" ");
        apply({ qty: `${theirs} + ${formatAmounts(item.amounts)}`, unit: "" });
      }
    }
    pending.set(item.existing.id, entry);
  });

  const updates = [...pending.entries()]
    .filter(([, e]) => Object.keys(e.changes).length)
    .map(([id, e]) => ({ id, changes: e.changes }));
  return { creates, updates };
}
