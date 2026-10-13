import { useState, useRef } from "react";
import { PROTEINS, DIFFICULTIES, TIME_BUCKETS, COOK_METHODS, SEASONS, COURSES, byKey, courseOf } from "./constants.js";
import { timeBucket } from "./utils.js";
import { normalizeRecipe, guessSection } from "./normalize.js";
import { createRecipe, updateRecipe } from "./recipeApi.js";
import { SECTION_ORDER, SECTION_ICONS } from "../sections.js";
import { ui, chipStyle, font, BROWN, useBodyScrollLock, useBackToClose } from "./ui.js";

const T = byKey(TIME_BUCKETS);
let keySeq = 0;
const newKey = () => `k${++keySeq}`;

const toForm = (r = {}) => ({
  name:          r.name || "",
  course:        courseOf(r),
  protein:       r.protein || null,
  difficulty:    r.difficulty || null,
  total_minutes: r.total_minutes ? String(r.total_minutes) : "",
  servings:      r.servings ? String(r.servings) : "",
  cook_methods:  r.cook_methods || [],
  seasons:       r.seasons || [],
  source_url:    r.source_url || "",
  instructions:  r.instructions || "",
  notes:         r.notes || "",
  ingredients:   (r.ingredients || []).map((i) => ({
    _key: newKey(), name: i.name || "",
    qty: i.qty || i.qty === 0 ? String(i.qty) : "",
    unit: i.unit || "", section: i.section || SECTION_ORDER[0], sectionTouched: true,
  })),
});

export default function RecipeForm({ initial, groceryItems, onCancel, onSaved, showToast }) {
  useBodyScrollLock();
  useBackToClose(() => cancel());
  const isEdit = !!initial?.id;
  const [form, setForm]     = useState(() => toForm(initial));
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState(false);
  const startJson = useRef(JSON.stringify(toForm(initial)));
  const nameRef = useRef(null);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const toggleIn = (field, key) =>
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(key) ? f[field].filter((k) => k !== key) : [...f[field], key],
    }));

  // ── Ingredients ──
  const setIng = (key, updates) =>
    setForm((f) => ({
      ...f, ingredients: f.ingredients.map((i) => (i._key === key ? { ...i, ...updates } : i)),
    }));
  const addIng = () =>
    setForm((f) => ({
      ...f,
      ingredients: [...f.ingredients, {
        _key: newKey(), name: "", qty: "", unit: "",
        // New rows start in the previous row's section — handy when typing in store order.
        section: f.ingredients.at(-1)?.section || SECTION_ORDER[0],
        sectionTouched: false,
      }],
    }));
  const removeIng = (key) =>
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((i) => i._key !== key) }));
  const moveIng = (idx, dir) =>
    setForm((f) => {
      const list = [...f.ingredients];
      const to = idx + dir;
      if (to < 0 || to >= list.length) return f;
      [list[idx], list[to]] = [list[to], list[idx]];
      return { ...f, ingredients: list };
    });
  // After typing a name, pick the section that item already uses on the grocery list.
  const autoSection = (ing) => {
    if (ing.sectionTouched || !ing.name.trim()) return;
    const s = guessSection(ing.name, groceryItems);
    if (s) setIng(ing._key, { section: s });
  };

  const cancel = () => {
    if (JSON.stringify(form) !== startJson.current && !window.confirm("Discard your changes?")) return false;
    onCancel();
  };

  const save = async () => {
    if (!form.name.trim()) {
      setNameError(true);
      nameRef.current?.focus();
      nameRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    const { recipe } = normalizeRecipe({ ...form, photo_url: initial?.photo_url }, groceryItems);
    setSaving(true);
    try {
      if (isEdit) {
        await updateRecipe(initial.id, recipe);
        showToast("Recipe saved");
        onSaved(initial.id);
      } else {
        const id = await createRecipe(recipe);
        showToast(`Added "${recipe.name}"`);
        onSaved(id);
      }
    } catch (e) {
      console.error(e);
      showToast("Couldn't save — check your connection");
      setSaving(false);
    }
  };

  const bucket = T[timeBucket(parseInt(form.total_minutes, 10) || null)];

  return (
    <div className="sheet-anim" style={{ ...ui.sheet, zIndex: 260 }}>
      <div style={ui.topBar}>
        <button className="secondary-btn" onClick={cancel} style={ui.backBtn}>Cancel</button>
        <h2 style={ui.topTitle}>{isEdit ? "Edit recipe" : "New recipe"}</h2>
        <button className="primary-btn" onClick={save} disabled={saving} style={ui.topActionBtn}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div style={ui.body}>
        {/* ── Name ── */}
        <label style={ui.label}>Name *</label>
        <input
          ref={nameRef}
          value={form.name}
          onChange={(e) => { set("name", e.target.value); setNameError(false); }}
          placeholder="e.g. Sheet Pan Lemon Chicken"
          style={{ ...ui.input, borderColor: nameError ? "#c44" : "#e4e2d8" }}
        />
        {nameError && <p style={{ ...ui.hint, color: "#c44" }}>Give the recipe a name.</p>}

        {/* ── Dish ── */}
        <div style={ui.sectionLabel}>Dish</div>
        <div style={ui.chipRow}>
          {COURSES.map((c) => (
            <button key={c.key} onClick={() => set("course", c.key)}
              style={chipStyle(form.course === c.key)}>{c.icon} {c.label}</button>
          ))}
        </div>

        {/* ── Protein ── */}
        <div style={ui.sectionLabel}>Protein</div>
        <div style={ui.chipRow}>
          {PROTEINS.map((p) => (
            <button key={p.key} onClick={() => set("protein", form.protein === p.key ? null : p.key)}
              style={chipStyle(form.protein === p.key)}>{p.icon} {p.label}</button>
          ))}
        </div>

        {/* ── Difficulty ── */}
        <div style={ui.sectionLabel}>Difficulty</div>
        <div style={ui.chipRow}>
          {DIFFICULTIES.map((d) => (
            <button key={d.key} onClick={() => set("difficulty", form.difficulty === d.key ? null : d.key)}
              style={chipStyle(form.difficulty === d.key)}>{d.label}</button>
          ))}
        </div>

        {/* ── Time + servings ── */}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <div style={{ flex: 1 }}>
            <label style={ui.label}>Total minutes</label>
            <input
              inputMode="numeric"
              value={form.total_minutes}
              onChange={(e) => set("total_minutes", e.target.value.replace(/\D/g, ""))}
              placeholder="45"
              style={ui.input}
            />
            <p style={ui.hint}>{bucket ? `${bucket.label} (${bucket.hint})` : " "}</p>
          </div>
          <div style={{ flex: 1 }}>
            <label style={ui.label}>Servings</label>
            <input
              inputMode="numeric"
              value={form.servings}
              onChange={(e) => set("servings", e.target.value.replace(/\D/g, ""))}
              placeholder="4"
              style={ui.input}
            />
          </div>
        </div>

        {/* ── Cook methods ── */}
        <div style={ui.sectionLabel}>Cook method</div>
        <div style={ui.chipRow}>
          {COOK_METHODS.map((m) => (
            <button key={m.key} onClick={() => toggleIn("cook_methods", m.key)}
              style={chipStyle(form.cook_methods.includes(m.key))}>{m.label}</button>
          ))}
        </div>

        {/* ── Seasons ── */}
        <div style={ui.sectionLabel}>Season</div>
        <div style={ui.chipRow}>
          {SEASONS.map((s) => (
            <button key={s.key} onClick={() => toggleIn("seasons", s.key)}
              style={chipStyle(form.seasons.includes(s.key))}>{s.icon} {s.label}</button>
          ))}
        </div>
        <p style={ui.hint}>Leave all off for year-round.</p>

        {/* ── Ingredients ── */}
        <div style={ui.sectionLabel}>Ingredients</div>
        {form.ingredients.length === 0 && (
          <p style={{ ...ui.hint, margin: "0 2px 10px" }}>Optional — add them now or later.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {form.ingredients.map((ing, idx) => (
            <div key={ing._key} style={{ ...ui.card, padding: 10 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input
                  autoFocus={!ing.name && idx === form.ingredients.length - 1}
                  value={ing.name}
                  onChange={(e) => setIng(ing._key, { name: e.target.value })}
                  onBlur={() => autoSection(ing)}
                  placeholder="Ingredient"
                  style={{ ...ui.input, flex: 1, padding: "10px 11px" }}
                />
                <button onClick={() => moveIng(idx, -1)} disabled={idx === 0}
                  style={{ ...styles.iconBtn, opacity: idx === 0 ? 0.3 : 1 }} aria-label="Move up">↑</button>
                <button onClick={() => moveIng(idx, 1)} disabled={idx === form.ingredients.length - 1}
                  style={{ ...styles.iconBtn, opacity: idx === form.ingredients.length - 1 ? 0.3 : 1 }}
                  aria-label="Move down">↓</button>
                <button onClick={() => removeIng(ing._key)} style={styles.iconBtn} aria-label="Remove">✕</button>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  inputMode="decimal"
                  value={ing.qty}
                  onChange={(e) => setIng(ing._key, { qty: e.target.value })}
                  placeholder="Qty"
                  style={{ ...ui.input, width: 58, flexShrink: 0, padding: "10px 8px", textAlign: "center" }}
                />
                <input
                  value={ing.unit}
                  onChange={(e) => setIng(ing._key, { unit: e.target.value })}
                  placeholder="Unit"
                  style={{ ...ui.input, width: 70, flexShrink: 0, padding: "10px 8px" }}
                />
                <select
                  value={ing.section}
                  onChange={(e) => setIng(ing._key, { section: e.target.value, sectionTouched: true })}
                  style={{ ...ui.input, flex: 1, minWidth: 0, padding: "10px 6px", fontSize: 14 }}
                >
                  {SECTION_ORDER.map((s) => <option key={s} value={s}>{SECTION_ICONS[s]} {s}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
        <button className="add-trigger-btn" onClick={addIng} style={styles.addIngBtn}>+ Add ingredient</button>

        {/* ── Text fields ── */}
        <div style={ui.sectionLabel}>Instructions</div>
        <textarea
          value={form.instructions}
          onChange={(e) => set("instructions", e.target.value)}
          rows={6}
          placeholder="Steps…"
          style={{ ...ui.input, resize: "vertical", lineHeight: 1.5 }}
        />

        <div style={ui.sectionLabel}>Notes</div>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          placeholder="e.g. Toddler loves this · double for leftovers"
          style={{ ...ui.input, resize: "vertical", lineHeight: 1.5 }}
        />

        <div style={ui.sectionLabel}>Source link</div>
        <input
          type="url"
          inputMode="url"
          value={form.source_url}
          onChange={(e) => set("source_url", e.target.value)}
          placeholder="https://…"
          style={ui.input}
        />

        <button
          className="primary-btn"
          onClick={save}
          disabled={saving}
          style={styles.bigSave}
        >{saving ? "Saving…" : isEdit ? "Save changes" : "Save recipe"}</button>
      </div>
    </div>
  );
}

const styles = {
  iconBtn: {
    width: 38, height: 42, flexShrink: 0, borderRadius: 10,
    border: "1.5px solid #e4e2d8", background: "#fafaf7",
    color: "#777", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
  addIngBtn: {
    width: "100%", marginTop: 8, padding: "13px", borderRadius: 12,
    border: `1.5px dashed ${BROWN}55`, background: "transparent",
    color: BROWN, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
  bigSave: {
    width: "100%", marginTop: 28, padding: "15px", borderRadius: 12, border: "none",
    background: "linear-gradient(135deg, #5a2c14 0%, #8a4a22 100%)",
    color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
};
