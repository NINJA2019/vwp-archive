// POST /.netlify/functions/admin-query
// Headers: Authorization: Bearer <session_token>
// Body: { table, select, filter, order, limit }
// Response: JSON array from Supabase (proxied server-side with secret key)

const crypto = require('crypto');

exports.handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Verify session token (SHA-256 hash of ADMIN_PASSWORD)
  const auth = (event.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const expected = crypto.createHash('sha256')
    .update(process.env.ADMIN_PASSWORD || '')
    .digest('hex');

  if (!auth || auth !== expected) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized — invalid session' }) };
  }

  try {
    const { table, select, filter, order, limit } = JSON.parse(event.body);

    if (!table) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'table is required' }) };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_SECRET_KEY not configured' }) };
    }

    let url = SUPABASE_URL + '/rest/v1/' + table + '?select=' + encodeURIComponent(select || '*');
    if (filter) url += '&' + filter;
    if (order) url += '&order=' + order;
    if (limit) url += '&limit=' + limit;

    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY
      }
    });

    const data = await res.json();

    return {
      statusCode: res.status,
      headers: CORS,
      body: JSON.stringify(data)
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: e.message })
    };
  }
};
