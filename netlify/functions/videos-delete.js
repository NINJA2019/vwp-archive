exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { password, id } = body;

  // パスワード認証
  if (password !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'パスワードが違います' }) };
  }

  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'idが必要です' }) };
  }

  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SECRET_KEY;

  try {
    const res = await fetch(`${supaUrl}/rest/v1/videos?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        apikey: supaKey,
        Authorization: `Bearer ${supaKey}`,
        Prefer: 'return=minimal',
      },
    });
    if (!res.ok) {
      const t = await res.text();
      return { statusCode: res.status, body: JSON.stringify({ error: t }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
