const { getSupabaseUrl, secretKey, sbHeaders } = require('./_shared/supabase');
const { methodNotAllowed, invalidJson, json, parseJsonBody } = require('./_shared/responses');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return methodNotAllowed();
  const parsed = parseJsonBody(event);
  if (!parsed.ok) return invalidJson();
  const body = parsed.body;
  const { password, id, name, purchase_url, is_sold_out, status_updated_at } = body;
  if (password !== process.env.ADMIN_PASSWORD) return json(401, { error: 'パスワードが違います' });
  if (!id) return json(400, { error: 'idが必要です' });
  // ホワイトリスト: 更新を許可するフィールドのみ抽出
  const fields = {};
  if (name !== undefined) fields.name = name;
  if (purchase_url !== undefined) fields.purchase_url = purchase_url;
  if (is_sold_out !== undefined) fields.is_sold_out = is_sold_out;
  if (status_updated_at !== undefined) fields.status_updated_at = status_updated_at;
  if (Object.keys(fields).length === 0) return json(400, { error: '更新するフィールドがありません' });
  const supaUrl = getSupabaseUrl();
  const supaKey = secretKey();
  if (!supaUrl || !supaKey) return json(500, { error: 'Supabase env vars missing' });
  try {
    const res = await fetch(`${supaUrl}/rest/v1/albums?id=eq.${id}`, {
      method: 'PATCH',
      headers: sbHeaders(supaKey, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify(fields),
    });
    const text = await res.text();
    if (!text) return json(500, { error: 'Empty response' });
    let data;
    try { data = JSON.parse(text); } catch(e) { return json(500, { error: 'Parse error', raw: text.slice(0,200) }); }
    if (!res.ok) return json(res.status, { error: data.message || text });
    return json(200, Array.isArray(data) ? data[0] : data, { 'Content-Type': 'application/json' });
  } catch(e) {
    return json(500, { error: e.message });
  }
};
