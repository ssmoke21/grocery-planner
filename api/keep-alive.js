const SUPABASE_URL = "https://wsbbyegvzoflphzylzpn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzYmJ5ZWd2em9mbHBoenlsenBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NDU0MjMsImV4cCI6MjA5MDMyMTQyM30.MTVBGIZZdxotiqRtBRMTNgzFaAqGUeOENfDOIuphBkY";

export default async function handler(req, res) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/app_state?id=eq.1`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!response.ok) throw new Error(`Supabase responded with ${response.status}`);

    res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
