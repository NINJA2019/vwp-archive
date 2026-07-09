const { getSupabaseUrl, secretKey, sbHeaders } = require('./_shared/supabase');
const { methodNotAllowed, invalidJson, json, parseJsonBody } = require('./_shared/responses');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return methodNotAllowed();
  const parsed = parseJsonBody(event);
  if (!parsed.ok) return invalidJson();
  const body = parsed.body;
  const { password, member, name, purchase_url } = body;
  if (password !== process.env.ADMIN_PASSWORD)
    return json(401, { error: 'Unauthorized' });
  if (!member || !name)
    return json(400, { error: 'member and name required' });

  const url = getSupabaseUrl();
  const key = secretKey();
  try {
    const res = await fetch(`${url}/rest/v1/albums`, {
      method: 'POST',
      headers: sbHeaders(key, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify({ member, name, purchase_url: purchase_url || null })
    });
    const data = await res.json();
    if (!res.ok) return json(res.status, { error: data.message || data });
    return json(200, Array.isArray(data) ? data[0] : data, { 'Content-Type': 'application/json' });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
