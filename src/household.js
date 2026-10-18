// Households: each one is a private folder at households/{code}, where the
// code is a random, hard-to-guess key shared as a link (?h=CODE).
// Shared things (recipes, household names) use a separate public_id so the
// secret code never appears outside the household's own folder.
import { db } from "./firebase.js";
import {
  collection, doc, getDoc, writeBatch, serverTimestamp,
} from "firebase/firestore";

// No 0/O, 1/I/L, or U — easy to read aloud and type.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_LENGTH = 12;

export const randomId = (length) => {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
};

// ── Paths inside a household's folder ──
export const hCol = (code, name) => collection(db, "households", code, name);
export const hDoc = (code, name, id) => doc(db, "households", code, name, id);

export const householdLink = (code) => `${window.location.origin}/?h=${code}`;

// Accepts a full link, a link fragment, or just the code.
export const parseCode = (text) => {
  const s = String(text || "").trim();
  const fromLink = s.match(/[?&]h=([A-Za-z0-9]+)/);
  const code = (fromLink ? fromLink[1] : s).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length >= 8 ? code : null;
};

// ── Remembering the household on this device ──
const STORAGE_KEY = "household_code";
export const savedCode = () => {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
};
export const saveCode = (code) => {
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* private mode */ }
};
export const forgetCode = () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
};

// Reads ?h= from the address bar, then removes it so the link isn't left
// sitting in screenshots or browser history. Remembers the answer so a
// second call (React dev-mode double effects) gets the same code.
let urlCode;
export const takeCodeFromUrl = () => {
  if (urlCode !== undefined) return urlCode;
  const params = new URLSearchParams(window.location.search);
  const code = parseCode(params.get("h"));
  urlCode = code;
  if (params.has("h")) {
    params.delete("h");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash);
  }
  return code;
};

export const fetchHousehold = async (code) => {
  const snap = await getDoc(doc(db, "households", code));
  return snap.exists() ? { code, ...snap.data() } : null;
};

/**
 * Creates a household: its private doc plus a public profile (name only).
 * When `adminCode` is given, also lists it in the admin's directory.
 * Returns { code, public_id }.
 */
export const createHousehold = async (name, { isAdmin = false, adminCode = null } = {}) => {
  const code = randomId(CODE_LENGTH);
  const publicId = randomId(16);
  const batch = writeBatch(db);
  batch.set(doc(db, "households", code), {
    name, public_id: publicId, is_admin: isAdmin, createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "household_profiles", publicId), { name, createdAt: serverTimestamp() });
  if (adminCode) {
    batch.set(hDoc(adminCode, "directory", code), {
      name, public_id: publicId, is_admin: isAdmin, createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return { code, public_id: publicId };
};
