exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { password, member, title, tags, date, url, note, spotify_url } = body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'パスワードが違います' }) };
  }

  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SECRET_KEY;

  if (!supaUrl || !supaKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase env vars missing' }) };
  }

  try {
    const res = await fetch(`${supaUrl}/rest/v1/videos`, {
      method: 'POST',
      headers: {
        apikey: supaKey,
        Authorization: `Bearer ${supaKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ member, title, tags: tags || '', date, url, note, spotify_url: spotify_url || null }),
    });

    const text = await res.text();
    if (!text) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Supabase returned empty response', status: res.status }) };
    }

    let data;
    try { data = JSON.parse(text); } catch(e) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Supabase parse error', raw: text.slice(0, 200) }) };
    }

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: data.message || data.error || text }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Array.isArray(data) ? data[0] : data),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
