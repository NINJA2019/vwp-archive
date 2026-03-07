exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { password, id } = JSON.parse(event.body || '{}');

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
    await fetch(`${supaUrl}/rest/v1/videos?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        apikey: supaKey,
        Authorization: `Bearer ${supaKey}`,
      },
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
