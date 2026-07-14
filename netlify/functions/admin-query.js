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

const { getSupabaseUrl, secretKey, sbHeaders: buildSbHeaders, fetchAllRows, fetchAllVideoRows } = require('./_shared/supabase');
const { sha256Hex } = require('./_shared/client-hash');
// URLからYouTube videoId（11文字）を抽出 / プレイリスト全件取得（playlist-import.js / ingest-youtube.jsと共通）
const { ytId, fetchAllPlaylistItems } = require('./_shared/yt');

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
  const expected = sha256Hex(process.env.ADMIN_PASSWORD || '');
  if (!auth || auth !== expected) return resp(401, { error: 'Unauthorized' });

  const SUPABASE_URL = getSupabaseUrl();
  const SUPABASE_KEY = secretKey();
  if (!SUPABASE_URL || !SUPABASE_KEY) return resp(500, { error: 'Supabase env vars missing' });

  const sbHeaders = buildSbHeaders(SUPABASE_KEY);

  try {
    const body = JSON.parse(event.body);
    const action = body.action || 'query';

    // ── SELECT ──
    if (action === 'query') {
      if (!body.table) return resp(400, { error: 'table required' });

      // limit明示かつ<1000: 意図的な少件取得（limit:50等）を尊重して単発fetch。
      // limit未指定 or ≥1000: 憲法5に従い fetchAllRows でページング（PostgREST Max Rows=1000の
      //   silent dropを防ぐ）。ページング時に order 未指定なら id.asc を補完し全順序を保証する
      //   （videos/song_bottles/albums は全て id PK）。
      const explicitLimit = body.limit != null ? parseInt(body.limit, 10) : null;
      const paginate = explicitLimit == null || !(explicitLimit < 1000);

      if (paginate) {
        let path = body.table + '?select=' + encodeURIComponent(body.select || '*');
        if (body.filter) path += '&' + body.filter;
        path += '&order=' + (body.order || 'id.asc');
        const { rows, status } = await fetchAllRows(SUPABASE_URL, SUPABASE_KEY, path);
        // 配列（正常）は200で全件返す。非配列（PostgRESTエラーJSON）は単発時と同じく
        // 実ステータス（例: 404 relation does not exist）で透過し、admin.js のエラー契約
        // （!res.ok → data.error/message）を維持する。
        return resp(Array.isArray(rows) ? 200 : (status || 400), rows);
      }

      let url = SUPABASE_URL + '/rest/v1/' + body.table + '?select=' + encodeURIComponent(body.select || '*');
      if (body.filter) url += '&' + body.filter;
      if (body.order) url += '&order=' + body.order;
      url += '&limit=' + body.limit;
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
      const pl = await fetchAllPlaylistItems(playlistId, YT_KEY);
      if (pl.error) return resp(400, { error: 'YouTube API: ' + (pl.error.message || 'Unknown') });
      const allItems = pl.items;

      // 既存動画を全件取得（url と id を取得）
      // 憲法5: fetchAllVideoRows でページング（limit=1000&offset=N&order=id.asc。単発limit=10000はMax Rowsで1,000にsilent drop）
      const { rows: existData, overflow } = await fetchAllVideoRows(SUPABASE_URL, SUPABASE_KEY, 'id,url');
      // 上限到達時は突合不完全＝重複公開の恐れがあるため中止
      if (overflow) {
        return resp(500, { error: 'videos件数が安全上限(50,000)に到達。dedup不完全のため安全のため中止。', count: existData.length });
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
