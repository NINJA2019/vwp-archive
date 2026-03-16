exports.handler = async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
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
