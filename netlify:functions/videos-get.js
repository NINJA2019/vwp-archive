exports.handler = async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  try {
    // Supabaseのmax-rows上限(1000件)を回避するためページネーションで全件取得
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
      if (data.length < pageSize) break; // 最終ページ
      offset += pageSize;
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(all),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
