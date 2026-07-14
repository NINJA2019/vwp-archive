const { getSupabaseUrl, secretKey, sbHeaders, fetchAllVideoRows } = require('./_shared/supabase');
const { methodNotAllowed, invalidJson, json, parseJsonBody } = require('./_shared/responses');
// URLからYouTube videoId（11文字）を抽出 / プレイリスト全件取得（ingest-youtube.js / admin-query.jsと共通）
const { ytId, fetchAllPlaylistItems } = require('./_shared/yt');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return methodNotAllowed();
  const parsed = parseJsonBody(event);
  if (!parsed.ok) return invalidJson();
  const body = parsed.body;
  const { playlistId, member, tags, password, album_id } = body;
  if (!password || password !== process.env.ADMIN_PASSWORD) return json(401, { error: 'Unauthorized' });
  if (!playlistId || !member) return json(400, { error: 'playlistId and member required' });
  // YouTube playlist ID: "PL" + 英数字・ハイフン・アンダースコア（16〜64文字）
  if (!/^PL[a-zA-Z0-9_-]{16,64}$/.test(playlistId)) {
    return json(400, { error: 'Invalid playlist ID format' });
  }
  const apiKey = process.env.YOUTUBE_API_KEY;
  const supaUrl = getSupabaseUrl();
  const supaKey = secretKey();

  // YouTubeプレイリスト全件取得（最大200件）
  const pl = await fetchAllPlaylistItems(playlistId, apiKey);
  if (pl.error) return json(400, { error: pl.error.message });
  const allItems = pl.items;

  // 既存動画を全件取得（url と id を取得）
  // 憲法5: fetchAllVideoRows でページング（limit=1000&offset=N&order=id.asc。単発limit=10000はMax Rowsで1,000にsilent drop）
  const { rows: existData, overflow } = await fetchAllVideoRows(supaUrl, supaKey, 'id,url');
  // 上限到達時は突合不完全＝重複公開の恐れがあるため中止
  if (overflow) {
    return json(500, { error: 'videos件数が安全上限(50,000)に到達。dedup不完全のため安全のため中止。', count: existData.length });
  }
  const existingMap = new Map();
  (existData || []).forEach(v => { const vid = ytId(v.url); if (vid) existingMap.set(vid, v.id); });

  const toInsert = [];
  const toLink = []; // 既存曲でアルバムに紐付けるもの
  const seen = new Set(); // 同一プレイリスト内の重複videoIdによる二重INSERT防止

  for (const item of allItems) {
    const videoId = item.snippet.resourceId.videoId;
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    // 突合はvideoIdベース（既存データのURL形式混在に対応）
    if (existingMap.has(videoId)) {
      // 既存曲：album_idが指定されていれば紐付け対象に
      if (album_id) toLink.push(existingMap.get(videoId));
      continue;
    }
    if (seen.has(videoId)) continue; // バッチ内重複を弾く（公開重複カード防止）
    seen.add(videoId);
    toInsert.push({
      member, title: item.snippet.title, url,
      date: item.snippet.publishedAt ? item.snippet.publishedAt.slice(0, 10) : '',
      tags: tags || '', note: '', album_id: album_id || null
    });
  }

  // 既存曲をアルバムに紐付け（PATCH）
  let linked = 0;
  if (album_id && toLink.length > 0) {
    for (const id of toLink) {
      await fetch(`${supaUrl}/rest/v1/videos?id=eq.${id}`, {
        method: 'PATCH',
        headers: sbHeaders(supaKey, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({ album_id })
      });
      linked++;
    }
  }

  if (toInsert.length === 0) {
    return json(200, { inserted: 0, skipped: allItems.length - linked, linked, message: `新規追加なし（既存${linked}件をアルバムに紐付け）` });
  }

  const insertRes = await fetch(`${supaUrl}/rest/v1/videos`, {
    method: 'POST',
    headers: sbHeaders(supaKey, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify(toInsert)
  });
  if (!insertRes.ok) { const errText = await insertRes.text(); return json(500, { error: errText }); }
  return json(200, {
    inserted: toInsert.length,
    skipped: allItems.length - toInsert.length - linked,
    linked,
    message: `${toInsert.length}件追加、${linked}件を既存曲としてアルバムに紐付け、${allItems.length - toInsert.length - linked}件スキップ`
  });
};
