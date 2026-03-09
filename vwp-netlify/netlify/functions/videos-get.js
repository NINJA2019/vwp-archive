exports.handler = async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  try {
    const res = await fetch(`${url}/rest/v1/videos?select=*&order=date.desc`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    const data = await res.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
