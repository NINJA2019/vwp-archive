exports.handler = async () => {
  const url = process.env.SUPABASE_URL;
  // 読み取り専用: anon key を使用（RLS で制御）
  // フォールバック: SUPABASE_ANON_KEY 未設定時は SECRET_KEY を使用
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  // 1ページ取得。migration未適用で status 列が存在しない場合（PostgREST 42703）は
  // status=eq.published フィルタなしで1回だけ再試行する。
  // migration適用前は status 列が存在しない = pending 行も存在し得ないため、
  // フィルタなしは従来挙動そのもので安全。
  async function fetchPage(pageUrl) {
    let res = await fetch(pageUrl, { headers });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (errText.includes('42703') && pageUrl.includes('&status=eq.published')) {
        res = await fetch(pageUrl.replace('&status=eq.published', ''), { headers });
      }
      if (!res.ok) {
        const text = await res.text().catch(() => errText);
        throw new Error(`Supabase ${res.status}: ${(text || errText).slice(0, 200)}`);
      }
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('Supabase returned non-array response');
    }
    return data;
  }

  try {
    let all = [];
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const data = await fetchPage(
        `${url}/rest/v1/videos?select=*&status=eq.published&order=date.desc&limit=${pageSize}&offset=${offset}`
      );
      if (data.length === 0) break;
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
    // エラー・非配列レスポンスをキャッシュ可能な200空配列で返さない（CDN焼き付き防止）
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
