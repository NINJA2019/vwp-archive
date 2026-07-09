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
  const { password } = body;
  if (password !== process.env.ADMIN_PASSWORD) {
    return json(401, { error: 'パスワードが違います' });
  }
  return json(200, { ok: true });
};
