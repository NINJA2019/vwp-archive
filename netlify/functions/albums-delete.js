const { getSupabaseUrl, secretKey, sbHeaders } = require('./_shared/supabase');
const { methodNotAllowed, invalidJson, json, parseJsonBody } = require('./_shared/responses');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return methodNotAllowed();
  const parsed = parseJsonBody(event);
  if (!parsed.ok) return invalidJson();
  const body = parsed.body;
  const { password, id } = body;
  if (password !== process.env.ADMIN_PASSWORD)
    return json(401, { error: 'Unauthorized' });
  if (!id)
    return json(400, { error: 'id required' });

  const url = getSupabaseUrl();
  const key = secretKey();
  try {
    // アルバム曲のalbum_idをnullに戻す
    const patchRes = await fetch(`${url}/rest/v1/videos?album_id=eq.${id}`, {
      method: 'PATCH',
      headers: sbHeaders(key, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({ album_id: null })
    });
    if (!patchRes.ok) {
      const t = await patchRes.text();
      return json(patchRes.status, { error: 'album_id解除に失敗: ' + t });
    }
    // アルバム削除
    const res = await fetch(`${url}/rest/v1/albums?id=eq.${id}`, {
      method: 'DELETE',
      headers: sbHeaders(key, { Prefer: 'return=minimal' })
    });
    if (!res.ok) {
      const t = await res.text();
      return json(res.status, { error: t });
    }
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
