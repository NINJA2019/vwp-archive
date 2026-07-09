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

  const { password, member, title, tags, date, url, note, spotify_url, album_id } = body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return json(401, { error: 'パスワードが違います' });
  }

  const supaUrl = getSupabaseUrl();
  const supaKey = secretKey();

  if (!supaUrl || !supaKey) {
    return json(500, { error: 'Supabase env vars missing' });
  }

  try {
    const res = await fetch(`${supaUrl}/rest/v1/videos`, {
      method: 'POST',
      headers: sbHeaders(supaKey, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify({ member, title, tags: tags || '', date, url, note, spotify_url: spotify_url || null, album_id: album_id || null }),
    });

    const text = await res.text();
    if (!text) {
      return json(500, { error: 'Supabase returned empty response', status: res.status });
    }

    let data;
    try { data = JSON.parse(text); } catch(e) {
      return json(500, { error: 'Supabase parse error', raw: text.slice(0, 200) });
    }

    if (!res.ok) {
      return json(res.status, { error: data.message || data.error || text });
    }

    return json(200, Array.isArray(data) ? data[0] : data, { 'Content-Type': 'application/json' });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
