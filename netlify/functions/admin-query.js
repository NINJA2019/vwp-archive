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

      // Fetch all playlist items
      let items = [], nextPage = '';
      do {
        const pUrl = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId='
          + playlistId + '&key=' + YT_KEY + (nextPage ? '&pageToken=' + nextPage : '');
        const pRes = await fetch(pUrl);
        const pData = await pRes.json();
        if (pData.error) return resp(400, { error: 'YouTube API: ' + (pData.error.message || 'Unknown') });
        (pData.items || []).forEach(i => {
          const s = i.snippet;
          if (s.title === 'Deleted video' || s.title === 'Private video') return;
          items.push({
            url: 'https://www.youtube.com/watch?v=' + s.resourceId.videoId,
            title: s.title,
            date: (s.publishedAt || '').slice(0, 10),
            member: member,
            tags: tags || '',
            note: '',
            spotify_url: null,
            album_id: album_id || null
          });
        });
        nextPage = pData.nextPageToken || '';
      } while (nextPage);

      // Get existing URLs
      const exRes = await fetch(SUPABASE_URL + '/rest/v1/videos?select=url', { headers: sbHeaders });
      const existing = await exRes.json();
      const existingUrls = new Set((Array.isArray(existing) ? existing : []).map(v => v.url));

      const newItems = items.filter(i => !existingUrls.has(i.url));
      let inserted = 0;
      if (newItems.length > 0) {
        const insRes = await fetch(SUPABASE_URL + '/rest/v1/videos', {
          method: 'POST',
          headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify(newItems)
        });
        if (insRes.ok) inserted = newItems.length;
      }

      return resp(200, { total: items.length, skipped: items.length - newItems.length, inserted });
    }

    return resp(400, { error: 'Unknown action: ' + action });
  } catch (e) {
    return resp(500, { error: e.message });
  }
};
