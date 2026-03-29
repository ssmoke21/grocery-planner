const SUPABASE_URL = "https://wsbbyegvzoflphzylzpn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzYmJ5ZWd2em9mbHBoenlsenBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NDU0MjMsImV4cCI6MjA5MDMyMTQyM30.MTVBGIZZdxotiqRtBRMTNgzFaAqGUeOENfDOIuphBkY";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

export async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers,
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
