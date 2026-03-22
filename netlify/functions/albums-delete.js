exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }
  const { password, id } = body;
  if (password !== process.env.ADMIN_PASSWORD)
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  if (!id)
    return { statusCode: 400, body: JSON.stringify({ error: 'id required' }) };

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  try {
    // アルバム曲のalbum_idをnullに戻す
    const patchRes = await fetch(`${url}/rest/v1/videos?album_id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        apikey: key, Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal'
      },
      body: JSON.stringify({ album_id: null })
    });
    if (!patchRes.ok) {
      const t = await patchRes.text();
      return { statusCode: patchRes.status, body: JSON.stringify({ error: 'album_id解除に失敗: ' + t }) };
    }
    // アルバム削除
    const res = await fetch(`${url}/rest/v1/albums?id=eq.${id}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' }
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
