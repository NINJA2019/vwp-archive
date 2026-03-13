const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const { password, id, ...fields } = JSON.parse(event.body || '{}');
    if (password !== ADMIN_PASSWORD) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'id required' }) };
    const { data, error } = await supabase.from('albums').update(fields).eq('id', id).select().single();
    if (error) throw error;
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
