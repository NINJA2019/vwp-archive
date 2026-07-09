const { getSupabaseUrl, secretKey, sbHeaders } = require('./_shared/supabase');
const { methodNotAllowed, invalidJson, json, parseJsonBody } = require('./_shared/responses');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed();
  }
  const parsed = parseJsonBody(event);
  if (!parsed.ok) {
    return invalidJson();
  }
  const body = parsed.body;
  const { password, id, member, title, tags, date, url, note, spotify_url, album_id } = body;
  if (password !== process.env.ADMIN_PASSWORD) {
    return json(401, { error: 'パスワードが違います' });
  }
  if (!id) {
    return json(400, { error: 'idが必要です' });
  }
  const supaUrl = getSupabaseUrl();
  const supaKey = secretKey();
  if (!supaUrl || !supaKey) {
    return json(500, { error: 'Supabase env vars missing' });
  }
  try {
    const res = await fetch(`${supaUrl}/rest/v1/videos?id=eq.${id}`, {
      method: 'PATCH',
      headers: sbHeaders(supaKey, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify({ member, title, tags: tags || '', date, url, note, spotify_url: spotify_url || null, album_id: album_id !== undefined ? album_id : undefined }),
    });
    const text = await res.text();
    if (!text) return json(500, { error: 'Empty response' });
    let data;
    try { data = JSON.parse(text); } catch(e) {
      return json(500, { error: 'Parse error', raw: text.slice(0,200) });
    }
    if (!res.ok) return json(res.status, { error: data.message || text });
    return json(200, Array.isArray(data) ? data[0] : data, { 'Content-Type': 'application/json' });
  } catch(e) {
    return json(500, { error: e.message });
  }
};
