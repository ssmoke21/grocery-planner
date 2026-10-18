import { useState } from "react";
import { normalizeRecipe } from "./normalize.js";
import { importRecipes } from "./recipeApi.js";
import { ui, font, BROWN, useBodyScrollLock, useBackToClose } from "./ui.js";
import { AI_PROMPT } from "./aiPrompt.js";
import { copyText } from "../HouseholdSheet.jsx";

const sameName = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

// Accepts [ ... ], { "recipes": [ ... ] }, or a single recipe object.
const extractList = (data) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.recipes)) return data.recipes;
  if (data && typeof data === "object") return [data];
  return null;
};

// AI tools often wrap JSON in ```json fences or add a sentence around it.
// Keep just the part from the first [ or { to the matching last ] or }.
export const extractJson = (text) => {
  const s = String(text).replace(/```(?:json)?/gi, "").trim();
  const start = s.search(/[[{]/);
  if (start === -1) return s;
  const end = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
  return end > start ? s.slice(start, end + 1) : s.slice(start);
};

const buildPreview = (text, existing, groceryItems) => {
  let data;
  try {
    data = JSON.parse(extractJson(text));
  } catch (e) {
    return { error: `That isn't valid JSON (${e.message}). Make sure you copied all of it, including the first [ and last ].` };
  }
  const list = extractList(data);
  if (!list?.length) return { error: "No recipes found in that JSON." };

  const inLibrary = new Set(existing.map((r) => sameName(r.name)));
  const inPaste = new Set();
  const rows = list.map((raw, i) => {
    if (!raw || typeof raw !== "object") {
      return { label: `Recipe #${i + 1}`, skip: "Not a recipe object", warnings: [] };
    }
    const { recipe, warnings } = normalizeRecipe(raw, groceryItems);
    if (!recipe.name) return { label: `Recipe #${i + 1}`, skip: "Missing a name", warnings: [] };
    const key = sameName(recipe.name);
    if (inLibrary.has(key)) return { label: recipe.name, skip: "You already have a recipe with this name", warnings: [] };
    if (inPaste.has(key)) return { label: recipe.name, skip: "Listed twice in this paste", warnings: [] };
    inPaste.add(key);
    return { label: recipe.name, recipe, warnings };
  });
  return { rows };
};

// `recipes` = this household's own recipes (duplicates are checked against these).
export default function ImportRecipes({ recipes, ownerId, groceryItems, onClose, showToast }) {
  useBodyScrollLock();
  useBackToClose(onClose);
  const [text, setText]       = useState("");
  const [preview, setPreview] = useState(null);
  const [saving, setSaving]   = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const copyPrompt = async () => {
    if (await copyText(AI_PROMPT)) showToast("Prompt copied");
    else { setShowPrompt(true); showToast("Couldn't copy — press and hold the prompt below"); }
  };

  const ready   = preview?.rows?.filter((r) => r.recipe) || [];
  const skipped = preview?.rows?.filter((r) => r.skip) || [];
  const warnCount = ready.reduce((n, r) => n + r.warnings.length, 0);

  const doImport = async () => {
    setSaving(true);
    try {
      await importRecipes(ready.map((r) => ({ ...r.recipe, owner_id: ownerId })));
      showToast(`Imported ${ready.length} recipe${ready.length !== 1 ? "s" : ""}`);
      onClose();
    } catch (e) {
      console.error(e);
      showToast("Import failed — check your connection");
      setSaving(false);
    }
  };

  return (
    <div className="sheet-anim" style={{ ...ui.sheet, zIndex: 260 }}>
      <div style={ui.topBar}>
        <button className="secondary-btn" onClick={onClose} style={ui.backBtn}>← Recipes</button>
        <h2 style={ui.topTitle}>Import recipes</h2>
        <span style={{ width: 60 }} />
      </div>

      <div style={ui.body}>
        {!preview?.rows ? (
          <>
            <div style={{ ...ui.card, padding: "14px 16px", marginTop: 4 }}>
              <div style={styles.howTitle}>✨ How to import with AI</div>
              <ol style={styles.steps}>
                <li><strong>Copy the prompt</strong> with the button below.</li>
                <li>Open an AI tool (like Claude or ChatGPT), paste the prompt, and add a <strong>photo, link, or the text</strong> of a recipe. You can do several at once.</li>
                <li>Copy the JSON it gives back, <strong>paste it in the box below</strong>, and tap <strong>Check</strong>.</li>
              </ol>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="primary-btn" onClick={copyPrompt} style={styles.copyBtn}>📋 Copy AI prompt</button>
                <button className="secondary-btn" onClick={() => setShowPrompt((v) => !v)} style={styles.peekBtn}>
                  {showPrompt ? "Hide" : "View"}
                </button>
              </div>
              {showPrompt && <pre style={styles.prompt}>{AI_PROMPT}</pre>}
            </div>
            <p style={{ fontSize: 13, color: "#888", lineHeight: 1.5, margin: "14px 2px 8px" }}>
              Paste the JSON here. Nothing is saved until you check and confirm.
            </p>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setPreview(null); }}
              rows={14}
              placeholder='[ { "name": "Chicken Tacos", ... } ]'
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              style={{ ...ui.input, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, lineHeight: 1.45, resize: "vertical" }}
            />
            {preview?.error && <div style={styles.errorBox}>{preview.error}</div>}
            <button
              className="primary-btn"
              onClick={() => setPreview(buildPreview(text, recipes, groceryItems))}
              disabled={!text.trim()}
              style={{ ...styles.bigBtn, opacity: text.trim() ? 1 : 0.4 }}
            >Check</button>
          </>
        ) : (
          <>
            <div style={{ ...ui.card, padding: "16px", marginTop: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#222", fontFamily: "'Fraunces', serif", fontStyle: "italic" }}>
                {ready.length} recipe{ready.length !== 1 ? "s" : ""} ready
              </div>
              <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
                {[
                  skipped.length && `${skipped.length} skipped`,
                  warnCount && `${warnCount} thing${warnCount !== 1 ? "s" : ""} adjusted`,
                ].filter(Boolean).join(" · ") || "No problems found"}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {preview.rows.map((r, i) => (
                <div key={i} style={{ ...ui.card, padding: "12px 14px", opacity: r.skip ? 0.6 : 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 14 }}>{r.skip ? "⏭" : r.warnings.length ? "⚠️" : "✅"}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#222" }}>{r.label}</span>
                    {r.recipe && (
                      <span style={{ fontSize: 12, color: "#999", whiteSpace: "nowrap" }}>
                        {r.recipe.ingredients.length} ingr.
                      </span>
                    )}
                  </div>
                  {r.skip && <div style={styles.note}>Skipped: {r.skip}</div>}
                  {r.warnings.map((w, j) => <div key={j} style={styles.note}>• {w}</div>)}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="secondary-btn" onClick={() => setPreview(null)} style={styles.backBtn}>← Edit JSON</button>
              <button
                className="primary-btn"
                onClick={doImport}
                disabled={saving || ready.length === 0}
                style={{ ...styles.bigBtn, marginTop: 0, flex: 2, opacity: ready.length ? 1 : 0.4 }}
              >{saving ? "Importing…" : `Import ${ready.length}`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  bigBtn: {
    width: "100%", marginTop: 14, padding: "15px", borderRadius: 12, border: "none",
    background: "linear-gradient(135deg, #5a2c14 0%, #8a4a22 100%)",
    color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
  backBtn: {
    flex: 1, padding: "15px", borderRadius: 12, border: "1.5px solid #e0dfd8",
    background: "white", color: "#777", fontSize: 14, fontWeight: 600,
    cursor: "pointer", fontFamily: font,
  },
  howTitle: { fontSize: 15, fontWeight: 700, color: "#222", marginBottom: 6 },
  steps: { margin: "0 0 12px", paddingLeft: 20, fontSize: 13, color: "#555", lineHeight: 1.6 },
  copyBtn: {
    flex: 1, padding: "12px", borderRadius: 10, border: "none",
    background: "linear-gradient(135deg, #5a2c14 0%, #8a4a22 100%)",
    color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
  peekBtn: {
    padding: "12px 16px", borderRadius: 10, border: "1.5px solid #e0dfd8", background: "white",
    color: "#777", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font,
  },
  prompt: {
    marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "#f6f5f0",
    fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, lineHeight: 1.5, color: "#444",
    whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 260, overflowY: "auto", userSelect: "all",
  },
  errorBox: {
    marginTop: 10, padding: "12px 14px", borderRadius: 10,
    background: "#FBE3E0", color: "#8c1d18", fontSize: 13, lineHeight: 1.5,
  },
  note: { fontSize: 12, color: BROWN, marginTop: 5, lineHeight: 1.45, paddingLeft: 22 },
};
