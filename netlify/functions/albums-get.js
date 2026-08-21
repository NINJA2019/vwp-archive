const { readKey, sbHeaders } = require('./_shared/supabase');

exports.handler = async () => {
  const url = process.env.SUPABASE_URL;
  // 読み取り専用: anon key を使用（RLS で制御）
  // フォールバック: SUPABASE_ANON_KEY 未設定時は SECRET_KEY を使用（readKey）
  const key = readKey();
  try {
    const res = await fetch(`${url}/rest/v1/albums?select=*&order=created_at.asc`, {
      headers: sbHeaders(key)
    });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) throw new Error(`Supabase ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // ブラウザは1分キャッシュ
        'Cache-Control': 'public, max-age=60',
        // Netlify CDN: 2分キャッシュ、stale-while-revalidate=240
        'Netlify-CDN-Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
      },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
