exports.handler = async () => {
  const url = process.env.SUPABASE_URL;
  // 読み取り専用: anon key を使用（RLS で制御）
  // フォールバック: SUPABASE_ANON_KEY 未設定時は SECRET_KEY を使用
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY;
  try {
    const res = await fetch(`${url}/rest/v1/albums?select=*&order=created_at.asc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const data = await res.json();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // CDNで10分キャッシュ（在庫状況は変わる可能性があるので短め）
        'Cache-Control': 'public, s-maxage=600, max-age=60, stale-while-revalidate=3600',
      },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
