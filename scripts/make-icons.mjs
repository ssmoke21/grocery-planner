// Draws the home-screen icon (a white cart on the app's green) with no extra
// tools, and writes the PNGs to public/. Usage: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from "fs";
import { deflateSync, crc32 } from "zlib";

const inPoly = (x, y, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const distToSeg = (x, y, [ax, ay], [bx, by]) => {
  const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay));
};

// All in 0–1 coordinates.
const isCart = (x, y) =>
  inPoly(x, y, [[0.32, 0.34], [0.8, 0.34], [0.73, 0.58], [0.38, 0.58]]) ||  // basket
  distToSeg(x, y, [0.19, 0.27], [0.28, 0.27]) < 0.028 ||                    // handle
  distToSeg(x, y, [0.28, 0.27], [0.38, 0.66]) < 0.028 ||                    // frame
  distToSeg(x, y, [0.38, 0.66], [0.74, 0.66]) < 0.028 ||                    // base
  Math.hypot(x - 0.43, y - 0.77) < 0.052 ||                                 // wheels
  Math.hypot(x - 0.69, y - 0.77) < 0.052;

const png = (size) => {
  const SS = 4; // smooth the edges
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let py = 0; py < size; py++) {
    const row = py * (size * 3 + 1);
    raw[row] = 0;
    for (let px = 0; px < size; px++) {
      let white = 0;
      for (let a = 0; a < SS; a++) for (let b = 0; b < SS; b++) {
        if (isCart((px + (a + 0.5) / SS) / size, (py + (b + 0.5) / SS) / size)) white++;
      }
      const w = white / (SS * SS);
      const g = (px + py) / (2 * size); // diagonal green, like the header
      const bg = [0x1e + g * (0x3a - 0x1e), 0x3a + g * (0x6b - 0x3a), 0x0f + g * (0x1a - 0x0f)];
      bg.forEach((c, i) => { raw[row + 1 + px * 3 + i] = Math.round(c + (255 - c) * w); });
    }
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
};

mkdirSync("public", { recursive: true });
writeFileSync("public/apple-touch-icon.png", png(180));
writeFileSync("public/icon-192.png", png(192));
writeFileSync("public/icon-512.png", png(512));
writeFileSync("public/manifest.webmanifest", JSON.stringify({
  name: "Grocery Planner",
  short_name: "Groceries",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#F7F6F1",
  theme_color: "#2D5016",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ],
}, null, 2));
console.log("Icons and manifest written to public/");
