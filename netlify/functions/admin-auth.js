// POST /.netlify/functions/admin-auth
// Body: { password: string }
// Response: { ok: true, token: string, supabase_url: string } | { ok: false, msg: string }

exports.handler = async (event) => {
  const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, msg: 'Method not allowed' })
    };
  }

  try {
    const { password } = JSON.parse(event.body);

    if (password !== process.env.ADMIN_PASSWORD) {
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ ok: false, msg: 'ACCESS DENIED — INVALID CLEARANCE CODE' })
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: true,
        token: process.env.SUPABASE_SECRET_KEY,
        supabase_url: process.env.SUPABASE_URL
      })
    };
  } catch (e) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, msg: 'PARSE ERROR — MALFORMED REQUEST' })
    };
  }
};
