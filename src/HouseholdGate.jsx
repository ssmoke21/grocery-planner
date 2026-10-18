import { useState, useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
import {
  takeCodeFromUrl, savedCode, saveCode, forgetCode, parseCode, fetchHousehold,
} from "./household.js";
import App from "./App.jsx";

const font = "'DM Sans', sans-serif";

// Works out which household this device is on, then renders the app for it.
export default function HouseholdGate() {
  // "loading" | "enter" | "ready"
  const [status, setStatus]       = useState("loading");
  const [household, setHousehold] = useState(null);
  const [error, setError]         = useState(null);
  const attempt = useRef(0); // only the latest lookup is allowed to win

  const tryCode = async (code, { fromSaved = false } = {}) => {
    const mine = ++attempt.current;
    setStatus("loading");
    setError(null);
    try {
      const hh = await fetchHousehold(code);
      if (mine !== attempt.current) return;
      if (!hh) {
        if (fromSaved) forgetCode();
        setError("That link doesn't match a household. Check it and try again.");
        setStatus("enter");
        return;
      }
      saveCode(code);
      setHousehold(hh);
      setStatus("ready");
    } catch (e) {
      console.error(e);
      if (mine !== attempt.current) return;
      setError("Couldn't connect. Check your connection and try again.");
      setStatus("enter");
    }
  };

  useEffect(() => {
    const fromUrl = takeCodeFromUrl();
    const code = fromUrl || savedCode();
    if (code) tryCode(code, { fromSaved: !fromUrl });
    else setStatus("enter");
  }, []);

  // Keep name / admin flag live (e.g. after a rename in Admin).
  const code = household?.code;
  useEffect(() => {
    if (!code) return;
    return onSnapshot(doc(db, "households", code), (snap) => {
      if (snap.exists()) setHousehold({ code, ...snap.data() });
      else leave(); // household was deleted
    }, (e) => console.error(e));
  }, [code]);

  const leave = () => {
    forgetCode();
    setHousehold(null);
    setError(null);
    setStatus("enter");
  };

  if (status === "loading") {
    return (
      <div style={styles.screen}>
        <div className="loading-icon" style={{ fontSize: 52, marginBottom: 18 }}>🛒</div>
        <div style={{ color: "#aaa", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }
  if (status === "enter") return <EnterLink error={error} onSubmit={(c) => tryCode(c)} />;
  return <App key={household.code} household={household} onLeaveHousehold={leave} />;
}

function EnterLink({ error, onSubmit }) {
  const [text, setText]   = useState("");
  const [local, setLocal] = useState(null);

  const submit = () => {
    const code = parseCode(text);
    if (!code) { setLocal("Paste the whole link you were sent."); return; }
    setLocal(null);
    onSubmit(code);
  };

  const message = local || error;
  return (
    <div style={styles.screen}>
      <div style={styles.card}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>🏠</div>
        <h1 style={styles.title}>Grocery Planner</h1>
        <p style={styles.body}>Paste your household link to open your list.</p>
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); setLocal(null); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="https://…/?h=…"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          style={styles.input}
        />
        {message && <p style={styles.error}>{message}</p>}
        <button className="primary-btn" onClick={submit} style={styles.button}>Open my list</button>
        <p style={styles.footnote}>Don't have a link? Ask whoever invited you to send it again.</p>
      </div>
    </div>
  );
}

const styles = {
  screen: {
    display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
    minHeight: "100vh", padding: "0 16px", boxSizing: "border-box",
    fontFamily: font, background: "#F7F6F1",
  },
  card: {
    width: "100%", maxWidth: 380, boxSizing: "border-box", textAlign: "center", background: "white",
    borderRadius: 20, padding: "32px 22px 24px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
  },
  title: {
    fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 500,
    fontSize: 26, margin: "0 0 6px", color: "#1e3a0f",
  },
  body: { fontSize: 14, color: "#777", margin: "0 0 18px", lineHeight: 1.5 },
  input: {
    width: "100%", boxSizing: "border-box", padding: "13px 14px", borderRadius: 12,
    border: "1.5px solid #e4e2d8", fontSize: 16, fontFamily: font, outline: "none",
  },
  error: { fontSize: 13, color: "#b3261e", margin: "10px 0 0", lineHeight: 1.45 },
  button: {
    width: "100%", marginTop: 14, padding: "14px", borderRadius: 12, border: "none",
    background: "linear-gradient(135deg, #1e3a0f 0%, #3a6b1a 100%)",
    color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: font,
  },
  footnote: { fontSize: 12, color: "#aaa", margin: "16px 0 0", lineHeight: 1.5 },
};
