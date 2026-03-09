exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }
  const { password } = body;
  if (password !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'パスワードが違います' }) };
  }
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
