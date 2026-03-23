exports.handler = async () => {
  const url = process.env.SUPABASE_URL;
  // 読み取り専用: anon key を使用（RLS で制御）
  // フォールバック: SUPABASE_ANON_KEY 未設定時は SECRET_KEY を使用
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  try {
    let all = [];
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const res = await fetch(
        `${url}/rest/v1/videos?select=*&order=date.desc&limit=${pageSize}&offset=${offset}`,
        { headers }
      );
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;
      all = all.concat(data);
      if (data.length < pageSize) break;
      offset += pageSize;
    }
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // CDNで1時間キャッシュ、ブラウザは5分キャッシュ
        'Cache-Control': 'public, s-maxage=3600, max-age=300, stale-while-revalidate=86400',
      },
      body: JSON.stringify(all),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
