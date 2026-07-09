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

  const { password, id } = body;

  // パスワード認証
  if (password !== process.env.ADMIN_PASSWORD) {
    return json(401, { error: 'パスワードが違います' });
  }

  if (!id) {
    return json(400, { error: 'idが必要です' });
  }

  const supaUrl = getSupabaseUrl();
  const supaKey = secretKey();

  try {
    const res = await fetch(`${supaUrl}/rest/v1/videos?id=eq.${id}`, {
      method: 'DELETE',
      headers: sbHeaders(supaKey, { Prefer: 'return=minimal' }),
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
