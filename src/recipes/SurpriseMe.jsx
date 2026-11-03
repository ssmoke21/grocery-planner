import { useState, useEffect, useRef, useMemo } from "react";
import { eligibleDinners } from "./recommend.js";
import { currentSeason } from "./utils.js";
import RecipeTags, { RecipeThumb, UsageLine } from "./RecipeTags.jsx";
import { buzz, prefersLessMotion } from "../fun.js";
import { font, useBackToClose } from "./ui.js";

const TEAL = "var(--ac-2f6b63)";

// A slot-machine spin that lands on a random dinner to add or spin again.
export default function SurpriseMe({ recipes, usage, publicId, isPlanned, onAdd, weekLabel, onClose }) {
  useBackToClose(onClose);
  const [shown, setShown]       = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [adding, setAdding]     = useState(false);
  const timer = useRef(null);

  // Prefer dinners that fit the season and weren't made lately; fall back to
  // any dinner, then any recipe, so there's always something to spin.
  const pool = useMemo(() => {
    const open = (list) => list.filter((r) => !isPlanned(r.id));
    const ratingOf = (r) => r.ratings?.[publicId] || null;
    const best = open(eligibleDinners({ recipes, usage, season: currentSeason(), ratingOf }));
    if (best.length) return best;
    const dinners = open(recipes.filter((r) => r.meals?.includes("dinner")));
    return dinners.length ? dinners : open(recipes);
  }, [recipes, usage, publicId, isPlanned]);

  const spin = () => {
    if (!pool.length) return;
    clearTimeout(timer.current);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (prefersLessMotion() || pool.length === 1) { setShown(pick); return; }
    setSpinning(true);
    let delay = 45;
    const step = () => {
      if (delay > 260) {
        setShown(pick);
        setSpinning(false);
        buzz(20);
        return;
      }
      setShown(pool[Math.floor(Math.random() * pool.length)]);
      delay *= 1.14;
      timer.current = setTimeout(step, delay);
    };
    step();
  };

  useEffect(() => {
    spin();
    return () => clearTimeout(timer.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    setAdding(true);
    await onAdd(shown);
    setAdding(false);
  };

  const added = shown && isPlanned(shown.id);

  return (
    <div className="overlay-anim" style={styles.overlay} onClick={onClose}>
      <div className="modal-anim" style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.title}>🎰 Surprise me!</div>

        {!pool.length ? (
          <p style={styles.empty}>Every recipe is already on {weekLabel}'s plan. Impressive!</p>
        ) : (
          <div style={styles.reel}>
            {shown && (
              <div className={spinning ? "reel-spinning" : "celebration-card"} style={styles.reelInner}>
                <RecipeThumb recipe={shown} size={64} />
                <div style={styles.name}>{shown.name}</div>
                {!spinning && (
                  <>
                    <div style={{ display: "flex", justifyContent: "center" }}><RecipeTags recipe={shown} /></div>
                    <UsageLine usage={usage[shown.id]} style={{ marginTop: 8 }} />
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {pool.length > 0 && (
          <button
            className="primary-btn"
            onClick={add}
            disabled={spinning || adding || added}
            style={{
              ...styles.addBtn,
              background: added ? "var(--bg-eef6f4)" : spinning ? "var(--bg-d4d3cc)" : TEAL,
              color: added ? TEAL : "var(--ac-ffffff)",
            }}
          >{added ? `✓ Added to ${weekLabel}` : `＋ Add to ${weekLabel}`}</button>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="secondary-btn" onClick={onClose} style={styles.lightBtn}>Close</button>
          {pool.length > 0 && (
            <button className="secondary-btn" onClick={spin} disabled={spinning} style={{ ...styles.lightBtn, color: TEAL }}>
              🔄 Spin again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 260, padding: 20,
  },
  modal: {
    background: "var(--bg-ffffff)", borderRadius: 20, padding: "22px 20px 18px",
    maxWidth: 340, width: "100%", textAlign: "center", fontFamily: font,
    boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
  },
  title: { fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: 22, color: "var(--fg-1a1a1a)", marginBottom: 14 },
  reel: {
    minHeight: 170, borderRadius: 16, padding: "18px 12px", marginBottom: 14,
    background: "linear-gradient(180deg, var(--bg-f3f1e8) 0%, var(--bg-ffffff) 50%, var(--bg-f3f1e8) 100%)",
    border: "1.5px solid var(--ln-e4e2d8)", display: "flex", alignItems: "center", justifyContent: "center",
  },
  reelInner: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" },
  name: { fontSize: 18, fontWeight: 700, color: "var(--fg-222222)", lineHeight: 1.25 },
  empty: { fontSize: 14, color: "var(--fg-888888)", lineHeight: 1.5, margin: "10px 0 18px" },
  addBtn: {
    width: "100%", padding: "13px", borderRadius: 12, border: "none",
    fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
  lightBtn: {
    flex: 1, padding: "12px", borderRadius: 12, border: "1.5px solid var(--ln-e0dfd8)", background: "var(--bg-ffffff)",
    color: "var(--fg-888888)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
};
