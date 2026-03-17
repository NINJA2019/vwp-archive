exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch(e) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }
  const { password, id, name, purchase_url, is_sold_out, status_updated_at } = body;
  if (password !== process.env.ADMIN_PASSWORD) return { statusCode: 401, body: JSON.stringify({ error: 'パスワードが違います' }) };
  if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'idが必要です' }) };
  // ホワイトリスト: 更新を許可するフィールドのみ抽出
  const fields = {};
  if (name !== undefined) fields.name = name;
  if (purchase_url !== undefined) fields.purchase_url = purchase_url;
  if (is_sold_out !== undefined) fields.is_sold_out = is_sold_out;
  if (status_updated_at !== undefined) fields.status_updated_at = status_updated_at;
  if (Object.keys(fields).length === 0) return { statusCode: 400, body: JSON.stringify({ error: '更新するフィールドがありません' }) };
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SECRET_KEY;
  if (!supaUrl || !supaKey) return { statusCode: 500, body: JSON.stringify({ error: 'Supabase env vars missing' }) };
  try {
    const res = await fetch(`${supaUrl}/rest/v1/albums?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        apikey: supaKey,
        Authorization: `Bearer ${supaKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(fields),
    });
    const text = await res.text();
    if (!text) return { statusCode: 500, body: JSON.stringify({ error: 'Empty response' }) };
    let data;
    try { data = JSON.parse(text); } catch(e) { return { statusCode: 500, body: JSON.stringify({ error: 'Parse error', raw: text.slice(0,200) }) }; }
    if (!res.ok) return { statusCode: res.status, body: JSON.stringify({ error: data.message || text }) };
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Array.isArray(data) ? data[0] : data) };
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
