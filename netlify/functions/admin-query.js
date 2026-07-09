// POST /.netlify/functions/admin-query
// Headers: Authorization: Bearer <session_token>
//
// Actions:
//   { table, select, filter, order, limit, offset }        — SELECT (default)
//   { action:"insert", table, data:{...} }                 — INSERT
//   { action:"update", table, id, data:{...} }             — UPDATE (PATCH)
//   { action:"delete", table, id }                         — DELETE
//   { action:"youtube", videoId }                          — YouTube metadata
//   { action:"playlist-import", playlistId, member, tags, album_id } — Bulk import

// URLからYouTube videoId（11文字）を抽出（playlist-import.js / ingest-youtube.jsと同一）
function ytId(url){ if(!url) return null; const m=String(url).match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/); return m?m[1]:null; }

const crypto = require('crypto');

exports.handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  const resp = (status, body) => ({ statusCode: status, headers: CORS, body: JSON.stringify(body) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return resp(405, { error: 'Method not allowed' });

  const auth = (event.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const expected = crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD || '').digest('hex');
  if (!auth || auth !== expected) return resp(401, { error: 'Unauthorized' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return resp(500, { error: 'Supabase env vars missing' });

  const sbHeaders = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };

  try {
    const body = JSON.parse(event.body);
    const action = body.action || 'query';

    // ── SELECT ──
    if (action === 'query') {
      if (!body.table) return resp(400, { error: 'table required' });
      let url = SUPABASE_URL + '/rest/v1/' + body.table + '?select=' + encodeURIComponent(body.select || '*');
      if (body.filter) url += '&' + body.filter;
      if (body.order) url += '&order=' + body.order;
      // 憲法5: limit未指定時はPostgRESTデフォルトLIMIT 1000でsilent dropするため、サーバ側で明示（playlist-importと同型）
      if (!body.limit) { body.limit = '10000'; if (!body.offset) body.offset = '0'; }
      if (body.limit) url += '&limit=' + body.limit;
      if (body.offset) url += '&offset=' + body.offset;
      const res = await fetch(url, { headers: sbHeaders });
      return resp(res.status, await res.json());
    }

    // ── INSERT ──
    if (action === 'insert') {
      if (!body.table || !body.data) return resp(400, { error: 'table and data required' });
      const res = await fetch(SUPABASE_URL + '/rest/v1/' + body.table, {
        method: 'POST',
        headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(body.data)
      });
      const result = await res.json();
      return resp(res.status, Array.isArray(result) ? result[0] || null : result);
    }

    // ── UPDATE ──
    if (action === 'update') {
      if (!body.table || !body.id || !body.data) return resp(400, { error: 'table, id, and data required' });
      const res = await fetch(SUPABASE_URL + '/rest/v1/' + body.table + '?id=eq.' + body.id, {
        method: 'PATCH',
        headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(body.data)
      });
      const result = await res.json();
      return resp(res.status, Array.isArray(result) ? result[0] || null : result);
    }

    // ── DELETE ──
    if (action === 'delete') {
      if (!body.table || !body.id) return resp(400, { error: 'table and id required' });
      const res = await fetch(SUPABASE_URL + '/rest/v1/' + body.table + '?id=eq.' + body.id, {
        method: 'DELETE', headers: sbHeaders
      });
      return resp(res.ok ? 200 : res.status, { ok: res.ok });
    }

    // ── YouTube metadata ──
    if (action === 'youtube') {
      const vid = body.videoId;
      if (!vid || !/^[a-zA-Z0-9_-]{11}$/.test(vid)) return resp(400, { error: 'Invalid video ID' });
      const YT_KEY = process.env.YOUTUBE_API_KEY;
      if (!YT_KEY) return resp(500, { error: 'YOUTUBE_API_KEY not configured' });
      const ytRes = await fetch(
        'https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' + vid + '&key=' + YT_KEY
      );
      const yt = await ytRes.json();
      if (!yt.items || !yt.items.length) return resp(404, { error: 'Video not found' });
      const s = yt.items[0].snippet;
      return resp(200, {
        title: s.title,
        date: (s.publishedAt || '').slice(0, 10),
        thumb: (s.thumbnails.maxres || s.thumbnails.high || s.thumbnails.default || {}).url || ''
      });
    }

    // ── Playlist import ──
    if (action === 'playlist-import') {
      const { playlistId, member, tags, album_id } = body;
      if (!playlistId || !member) return resp(400, { error: 'playlistId and member required' });
      if (!/^PL[a-zA-Z0-9_-]{16,64}$/.test(playlistId)) return resp(400, { error: 'Invalid playlist ID' });
      const YT_KEY = process.env.YOUTUBE_API_KEY;
      if (!YT_KEY) return resp(500, { error: 'YOUTUBE_API_KEY not configured' });

      // YouTubeプレイリスト全件取得（最大200件）
      let allItems = [], pageToken = '';
      while (true) {
        const pUrl = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId='
          + encodeURIComponent(playlistId) + '&key=' + YT_KEY + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
        const pRes = await fetch(pUrl);
        const pData = await pRes.json();
        if (pData.error) return resp(400, { error: 'YouTube API: ' + (pData.error.message || 'Unknown') });
        const pageItems = (pData.items || []).filter(i => i.snippet.resourceId.kind === 'youtube#video');
        allItems = allItems.concat(pageItems);
        if (pData.nextPageToken && allItems.length < 200) { pageToken = pData.nextPageToken; } else break;
      }

      // 既存動画を全件取得（url と id を取得）
      // 憲法5: PostgRESTデフォルトLIMIT1000のsilent dropを防ぐためlimit/offset明示
      const exRes = await fetch(SUPABASE_URL + '/rest/v1/videos?select=id,url&limit=10000&offset=0', { headers: sbHeaders });
      const existData = await exRes.json();
      // 上限到達時は突合不完全＝重複公開の恐れがあるため中止
      if (Array.isArray(existData) && existData.length >= 10000) {
        return resp(500, { error: 'videos件数が全件fetch上限(10000)に到達。ページング未実装のため安全のため中止。', count: existData.length });
      }
      const existingMap = new Map();
      (Array.isArray(existData) ? existData : []).forEach(v => { const vid = ytId(v.url); if (vid) existingMap.set(vid, v.id); });

      const toInsert = [];
      const toLink = []; // 既存曲でアルバムに紐付けるもの
      const seen = new Set(); // 同一プレイリスト内の重複videoIdによる二重INSERT防止

      for (const item of allItems) {
        const videoId = item.snippet.resourceId.videoId;
        const url = 'https://www.youtube.com/watch?v=' + videoId;
        // 突合はvideoIdベース（既存データのURL形式混在に対応）
        if (existingMap.has(videoId)) {
          if (album_id) toLink.push(existingMap.get(videoId));
          continue;
        }
        if (seen.has(videoId)) continue; // バッチ内重複を弾く（公開重複カード防止）
        seen.add(videoId);
        toInsert.push({
          url, title: item.snippet.title,
          date: item.snippet.publishedAt ? item.snippet.publishedAt.slice(0, 10) : '',
          member: member, tags: tags || '', note: '', album_id: album_id || null
        });
      }

      // 既存曲をアルバムに紐付け（PATCH）
      let linked = 0;
      if (album_id && toLink.length > 0) {
        for (const id of toLink) {
          await fetch(SUPABASE_URL + '/rest/v1/videos?id=eq.' + id, {
            method: 'PATCH',
            headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({ album_id })
          });
          linked++;
        }
      }

      let inserted = 0;
      if (toInsert.length > 0) {
        const insRes = await fetch(SUPABASE_URL + '/rest/v1/videos', {
          method: 'POST',
          headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify(toInsert)
        });
        if (insRes.ok) inserted = toInsert.length;
        else { const errText = await insRes.text(); return resp(500, { error: errText }); }
      }

      const total = allItems.length;
      return resp(200, { total, inserted, skipped: total - inserted - linked, linked });
    }

    return resp(400, { error: 'Unknown action: ' + action });
  } catch (e) {
    return resp(500, { error: e.message });
  }
};
