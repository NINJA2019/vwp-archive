exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { playlistId, member, tags, password, album_id } = body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  if (!playlistId || !member) {
    return { statusCode: 400, body: JSON.stringify({ error: 'playlistId and member required' }) };
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SECRET_KEY;

  // YouTubeプレイリスト全件取得（最大200件）
  let allItems = [];
  let pageToken = '';
  while (true) {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(playlistId)}&key=${apiKey}${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) return { statusCode: 400, body: JSON.stringify({ error: data.error.message }) };
    const items = (data.items || []).filter(i => i.snippet.resourceId.kind === 'youtube#video');
    allItems = allItems.concat(items);
    if (data.nextPageToken && allItems.length < 200) {
      pageToken = data.nextPageToken;
    } else break;
  }

  // 既存URL取得して重複スキップ
  const existRes = await fetch(`${supaUrl}/rest/v1/videos?select=url`, {
    headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` }
  });
  const existData = await existRes.json();
  const existingUrls = new Set((existData || []).map(v => v.url));

  const toInsert = [];
  for (const item of allItems) {
    const videoId = item.snippet.resourceId.videoId;
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    if (existingUrls.has(url)) continue;
    toInsert.push({
      member,
      title: item.snippet.title,
      url,
      date: item.snippet.publishedAt ? item.snippet.publishedAt.slice(0, 10) : '',
      tags: tags || '',
      note: '',
      album_id: album_id || null
    });
  }

  if (toInsert.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ inserted: 0, skipped: allItems.length, message: '全て登録済みでした' }) };
  }

  const insertRes = await fetch(`${supaUrl}/rest/v1/videos`, {
    method: 'POST',
    headers: {
      apikey: supaKey,
      Authorization: `Bearer ${supaKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(toInsert)
  });

  if (!insertRes.ok) {
    const errText = await insertRes.text();
    return { statusCode: 500, body: JSON.stringify({ error: errText }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      inserted: toInsert.length,
      skipped: allItems.length - toInsert.length,
      message: `${toInsert.length}件追加、${allItems.length - toInsert.length}件スキップ（重複）`
    })
  };
};
