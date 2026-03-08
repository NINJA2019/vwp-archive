const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Bad JSON' }; }

  const { playlistId, member, password } = body;

  // 認証チェック
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (!playlistId || !member) {
    return { statusCode: 400, body: JSON.stringify({ error: 'playlistId and member required' }) };
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  let allItems = [];
  let pageToken = '';

  // 全ページ取得（最大200件）
  while (true) {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${apiKey}${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) return { statusCode: 400, body: JSON.stringify({ error: data.error.message }) };

    const items = (data.items || []).filter(i => i.snippet.resourceId.kind === 'youtube#video');
    allItems = allItems.concat(items);

    if (data.nextPageToken && allItems.length < 200) {
      pageToken = data.nextPageToken;
    } else {
      break;
    }
  }

  // 既存URLを取得して重複スキップ
  const { data: existing } = await supabase.from('videos').select('url');
  const existingUrls = new Set((existing || []).map(v => v.url));

  const toInsert = [];
  for (const item of allItems) {
    const videoId = item.snippet.resourceId.videoId;
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    if (existingUrls.has(url)) continue;

    const title = item.snippet.title;
    const date = item.snippet.publishedAt ? item.snippet.publishedAt.slice(0, 10) : '';

    toInsert.push({ member, title, url, date, tag: '', tags: '', note: '' });
  }

  if (toInsert.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ inserted: 0, skipped: allItems.length, message: '全て登録済みでした' }) };
  }

  const { error } = await supabase.from('videos').insert(toInsert);
  if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };

  return {
    statusCode: 200,
    body: JSON.stringify({
      inserted: toInsert.length,
      skipped: allItems.length - toInsert.length,
      message: `${toInsert.length}件追加、${allItems.length - toInsert.length}件スキップ（重複）`
    })
  };
};
