import { useEffect, useRef } from "react";
import { seasonalDecor, householdLook, prefersLessMotion } from "./fun.js";

// Confetti colors are drawn on a canvas, so they stay the same in dark mode.
const CONFETTI = ["#f4c542", "#e8574a", "#4aa3df", "#6cc070", "#b77ee0", "#ff9f43"];

// A one-time burst of confetti over the whole screen. Calls onDone when finished.
export function Confetti({ onDone }) {
  const ref = useRef(null);
  useEffect(() => {
    if (prefersLessMotion()) { onDone?.(); return; }
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    const pieces = Array.from({ length: 140 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: h * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 13 - 4,
      size: Math.random() * 6 + 5,
      spin: Math.random() * Math.PI,
      vspin: (Math.random() - 0.5) * 0.3,
      color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
    }));
    const start = performance.now();
    let frame;
    const tick = (t) => {
      const elapsed = t - start;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, elapsed - 2200) / 800);
      pieces.forEach((p) => {
        p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.spin += p.vspin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });
      if (elapsed < 3000) frame = requestAnimationFrame(tick);
      else onDone?.();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 400 }}
    />
  );
}

// Seasonal emoji drifting gently in the header.
const SPOTS = [
  { right: "6%",  top: "18%", size: 22, delay: 0 },
  { right: "22%", top: "52%", size: 16, delay: 1.2 },
  { right: "38%", top: "14%", size: 14, delay: 2.4 },
  { right: "14%", top: "70%", size: 18, delay: 0.6 },
  { right: "30%", top: "80%", size: 13, delay: 1.8 },
];

export function SeasonalDecor() {
  const emojis = seasonalDecor();
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {SPOTS.map((s, i) => (
        <span
          key={i}
          className="decor-float"
          style={{
            position: "absolute", right: s.right, top: s.top, fontSize: s.size,
            opacity: 0.32, animationDelay: `${s.delay}s`,
          }}
        >{emojis[i]}</span>
      ))}
    </div>
  );
}

// A household's emoji in its chosen color.
export function HouseholdAvatar({ profile, size = 28 }) {
  const look = householdLook(profile);
  return (
    <span style={{
      width: size, height: size, borderRadius: size / 2, flexShrink: 0,
      background: look.bg, display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.58, lineHeight: 1,
    }}>{look.emoji}</span>
  );
}
