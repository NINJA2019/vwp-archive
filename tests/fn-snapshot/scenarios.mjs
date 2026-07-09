// tests/fn-snapshot/scenarios.mjs — シナリオ + fixtures（B3計画§6層1）
// 各シナリオ: { name, fn, event, routes, env? }
// routes は run.mjs の fetchスタブ用ルートテーブル。fixture不足は UNMATCHED_FETCH で顕在化する。

import crypto from 'node:crypto';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ── 固定値（run.mjs の BASE_ENV と一致させること） ──
export const PW = 'admin_pw_dummy';
export const SB = 'https://sb.example.test';
const ADMIN_TOKEN = sha256(PW);
const CLIENT_IP = '203.0.113.7';

// bottle UUID（result.js の uuidRegex は hex のみ許容）
const B_MINE = '11111111-1111-1111-1111-111111111111';
const B_OTHER = '22222222-2222-2222-2222-222222222222';
const B_THIRD = '33333333-3333-3333-3333-333333333333';

// videos fixtures（公開済み）
const VIDEO5 = { id: 5, title: '糸', member: 'kafu', date: '2023-01-01', url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA' };
const VIDEO9 = { id: 9, title: 'ヒバリ', member: 'rime', date: '2023-06-15', url: 'https://youtu.be/BBBBBBBBBBB' };
const VIDEO12 = { id: 12, title: 'マザードラッグ', member: 'harusar', date: '2024-02-02', url: 'https://www.youtube.com/watch?v=DDDDDDDDDDD' };

// ── イベントビルダ ──
const post = (body, headers = {}) => ({
  httpMethod: 'POST',
  headers,
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const get = (qs = null, headers = {}) => ({ httpMethod: 'GET', headers, queryStringParameters: qs });

// ── fixtureビルダ ──
const plVid = (videoId, title, publishedAt) => ({
  snippet: { title, publishedAt, resourceId: { kind: 'youtube#video', videoId } },
});
const plNonVideo = () => ({
  snippet: { title: 'チャンネル項目', publishedAt: '2026-01-01T00:00:00Z', resourceId: { kind: 'youtube#channel', channelId: 'UCdummy' } },
});
const ytDetail = (id, title, publishedAt, duration, opts = {}) => ({
  id,
  snippet: { title, description: opts.description || '', publishedAt },
  contentDetails: { duration },
  ...(opts.live ? { liveStreamingDetails: { actualStartTime: publishedAt } } : {}),
});
// videos全件fetch上限（10000件）到達fixture
const bigRows = (n) => Array.from({ length: n }, (_, i) => ({
  id: i + 1,
  url: `https://www.youtube.com/watch?v=${String(i).padStart(11, 'Z')}`,
}));
const pageRows = (n, offset = 0) => Array.from({ length: n }, (_, i) => ({
  id: offset + i + 1, title: 't' + (offset + i + 1), member: 'kafu', status: 'published',
}));

export const scenarios = [];

// ═══════════════════════════════════════════════════════════════
// 共通系: 平文405 / Invalid JSON / 認証失敗（G1 8ファイル同型パターン）
// ═══════════════════════════════════════════════════════════════
for (const fn of ['albums-add', 'albums-delete', 'albums-update', 'auth-check',
  'videos-add', 'videos-delete', 'videos-update', 'playlist-import']) {
  scenarios.push({ name: `${fn}/405-get`, fn, event: get(), routes: [] });
  scenarios.push({ name: `${fn}/invalid-json`, fn, event: post('{bad json'), routes: [] });
  scenarios.push({ name: `${fn}/auth-fail`, fn, event: post({ password: 'wrong_pw' }), routes: [] });
}

// ═══════════════════════════════════════════════════════════════
// albums-add
// ═══════════════════════════════════════════════════════════════
scenarios.push(
  { name: 'albums-add/missing-fields', fn: 'albums-add', event: post({ password: PW }), routes: [] },
  {
    name: 'albums-add/success', fn: 'albums-add',
    event: post({ password: PW, member: 'kafu', name: '狂想', purchase_url: '' }),
    routes: [{ method: 'POST', match: '/rest/v1/albums', status: 201, body: [{ id: 10, member: 'kafu', name: '狂想', purchase_url: null }] }],
  },
  {
    name: 'albums-add/sb-error', fn: 'albums-add',
    event: post({ password: PW, member: 'kafu', name: '狂想' }),
    routes: [{ method: 'POST', match: '/rest/v1/albums', status: 409, body: { message: 'duplicate key value' } }],
  },
);

// ═══════════════════════════════════════════════════════════════
// albums-delete
// ═══════════════════════════════════════════════════════════════
scenarios.push(
  { name: 'albums-delete/missing-id', fn: 'albums-delete', event: post({ password: PW }), routes: [] },
  {
    name: 'albums-delete/success', fn: 'albums-delete',
    event: post({ password: PW, id: 5 }),
    routes: [
      { method: 'PATCH', match: 'videos?album_id=eq.5', status: 204, body: '' },
      { method: 'DELETE', match: 'albums?id=eq.5', status: 204, body: '' },
    ],
  },
  {
    name: 'albums-delete/patch-fail', fn: 'albums-delete',
    event: post({ password: PW, id: 5 }),
    routes: [{ method: 'PATCH', match: 'videos?album_id=eq.5', status: 400, body: 'FK violation text' }],
  },
  {
    name: 'albums-delete/delete-fail', fn: 'albums-delete',
    event: post({ password: PW, id: 5 }),
    routes: [
      { method: 'PATCH', match: 'videos?album_id=eq.5', status: 204, body: '' },
      { method: 'DELETE', match: 'albums?id=eq.5', status: 409, body: 'conflict text' },
    ],
  },
);

// ═══════════════════════════════════════════════════════════════
// albums-update
// ═══════════════════════════════════════════════════════════════
scenarios.push(
  { name: 'albums-update/missing-id', fn: 'albums-update', event: post({ password: PW, name: 'x' }), routes: [] },
  { name: 'albums-update/no-fields', fn: 'albums-update', event: post({ password: PW, id: 5 }), routes: [] },
  {
    name: 'albums-update/env-missing', fn: 'albums-update', env: { SUPABASE_URL: undefined },
    event: post({ password: PW, id: 5, name: 'x' }), routes: [],
  },
  {
    name: 'albums-update/success', fn: 'albums-update',
    event: post({ password: PW, id: 5, name: '狂想（新装版）', is_sold_out: true }),
    routes: [{ method: 'PATCH', match: 'albums?id=eq.5', status: 200, body: [{ id: 5, name: '狂想（新装版）', is_sold_out: true }] }],
  },
  {
    name: 'albums-update/sb-error', fn: 'albums-update',
    event: post({ password: PW, id: 5, name: 'x' }),
    routes: [{ method: 'PATCH', match: 'albums?id=eq.5', status: 400, body: { message: 'invalid input' } }],
  },
  {
    name: 'albums-update/empty-response', fn: 'albums-update',
    event: post({ password: PW, id: 5, name: 'x' }),
    routes: [{ method: 'PATCH', match: 'albums?id=eq.5', status: 200, body: '' }],
  },
  {
    name: 'albums-update/parse-error', fn: 'albums-update',
    event: post({ password: PW, id: 5, name: 'x' }),
    routes: [{ method: 'PATCH', match: 'albums?id=eq.5', status: 200, body: 'not-json-at-all' }],
  },
);

// ═══════════════════════════════════════════════════════════════
// auth-check
// ═══════════════════════════════════════════════════════════════
scenarios.push(
  { name: 'auth-check/success', fn: 'auth-check', event: post({ password: PW }), routes: [] },
);

// ═══════════════════════════════════════════════════════════════
// videos-add
// ═══════════════════════════════════════════════════════════════
scenarios.push(
  {
    name: 'videos-add/env-missing', fn: 'videos-add', env: { SUPABASE_URL: undefined },
    event: post({ password: PW, member: 'kafu', title: '新曲' }), routes: [],
  },
  {
    name: 'videos-add/success', fn: 'videos-add',
    event: post({ password: PW, member: 'kafu', title: '新曲', tags: '', date: '2026-01-01', url: VIDEO5.url, note: '', spotify_url: '', album_id: null }),
    routes: [{ method: 'POST', match: '/rest/v1/videos', status: 201, body: [{ id: 101, member: 'kafu', title: '新曲' }] }],
  },
  {
    name: 'videos-add/sb-error', fn: 'videos-add',
    event: post({ password: PW, member: 'kafu', title: '新曲', date: '2026-01-01', url: VIDEO5.url }),
    routes: [{ method: 'POST', match: '/rest/v1/videos', status: 400, body: { message: 'null value in column' } }],
  },
  {
    name: 'videos-add/empty-response', fn: 'videos-add',
    event: post({ password: PW, member: 'kafu', title: '新曲', date: '2026-01-01', url: VIDEO5.url }),
    routes: [{ method: 'POST', match: '/rest/v1/videos', status: 200, body: '' }],
  },
  {
    name: 'videos-add/parse-error', fn: 'videos-add',
    event: post({ password: PW, member: 'kafu', title: '新曲', date: '2026-01-01', url: VIDEO5.url }),
    routes: [{ method: 'POST', match: '/rest/v1/videos', status: 200, body: 'garbage response text' }],
  },
);

// ═══════════════════════════════════════════════════════════════
// videos-delete
// ═══════════════════════════════════════════════════════════════
scenarios.push(
  { name: 'videos-delete/missing-id', fn: 'videos-delete', event: post({ password: PW }), routes: [] },
  {
    name: 'videos-delete/success', fn: 'videos-delete',
    event: post({ password: PW, id: 7 }),
    routes: [{ method: 'DELETE', match: 'videos?id=eq.7', status: 204, body: '' }],
  },
  {
    name: 'videos-delete/sb-error', fn: 'videos-delete',
    event: post({ password: PW, id: 7 }),
    routes: [{ method: 'DELETE', match: 'videos?id=eq.7', status: 409, body: 'FK constraint text' }],
  },
);

// ═══════════════════════════════════════════════════════════════
// videos-update
// ═══════════════════════════════════════════════════════════════
scenarios.push(
  { name: 'videos-update/missing-id', fn: 'videos-update', event: post({ password: PW, title: 'x' }), routes: [] },
  {
    name: 'videos-update/env-missing', fn: 'videos-update', env: { SUPABASE_URL: undefined },
    event: post({ password: PW, id: 7, title: 'x' }), routes: [],
  },
  {
    name: 'videos-update/success', fn: 'videos-update',
    event: post({ password: PW, id: 7, member: 'rime', title: '改題', tags: 'MV', date: '2026-01-02', url: VIDEO9.url, note: 'メモ', spotify_url: '', album_id: 3 }),
    routes: [{ method: 'PATCH', match: 'videos?id=eq.7', status: 200, body: [{ id: 7, member: 'rime', title: '改題' }] }],
  },
  {
    name: 'videos-update/sb-error', fn: 'videos-update',
    event: post({ password: PW, id: 7, title: 'x' }),
    routes: [{ method: 'PATCH', match: 'videos?id=eq.7', status: 400, body: { message: 'check constraint' } }],
  },
  {
    name: 'videos-update/parse-error', fn: 'videos-update',
    event: post({ password: PW, id: 7, title: 'x' }),
    routes: [{ method: 'PATCH', match: 'videos?id=eq.7', status: 200, body: 'oops not json' }],
  },
);

// ═══════════════════════════════════════════════════════════════
// playlist-import（standalone）
// ═══════════════════════════════════════════════════════════════
// プレイリストfixture: page1(新規A/既存C/動画以外) → page2(新規B/バッチ内重複A)
const PL_ID = 'PLabcdefghijklmnop';
const plRoutesTwoPages = [
  {
    match: (u) => u.includes('playlistItems') && u.includes(PL_ID) && u.includes('pageToken=PT2'),
    body: { items: [plVid('BBBBBBBBBBB', '新曲B', '2026-01-03T00:00:00Z'), plVid('AAAAAAAAAAA', '新曲A（重複）', '2026-01-02T00:00:00Z')] },
  },
  {
    match: (u) => u.includes('playlistItems') && u.includes(PL_ID) && !u.includes('pageToken'),
    body: { items: [plVid('AAAAAAAAAAA', '新曲A', '2026-01-02T00:00:00Z'), plVid('CCCCCCCCCCC', '既存C', '2026-01-01T00:00:00Z'), plNonVideo()], nextPageToken: 'PT2' },
  },
];
const existingC = [{ id: 300, url: 'https://youtu.be/CCCCCCCCCCC' }];

scenarios.push(
  { name: 'playlist-import/missing-fields', fn: 'playlist-import', event: post({ password: PW }), routes: [] },
  { name: 'playlist-import/invalid-playlist-id', fn: 'playlist-import', event: post({ password: PW, playlistId: 'XX', member: 'kafu' }), routes: [] },
  {
    name: 'playlist-import/yt-error', fn: 'playlist-import',
    event: post({ password: PW, playlistId: PL_ID, member: 'kafu' }),
    routes: [{ match: 'playlistItems', body: { error: { message: 'quota exceeded' } } }],
  },
  {
    name: 'playlist-import/yt-error-no-message', fn: 'playlist-import',
    event: post({ password: PW, playlistId: PL_ID, member: 'kafu' }),
    routes: [{ match: 'playlistItems', body: { error: { code: 403 } } }],
  },
  {
    name: 'playlist-import/success-dedup-linked', fn: 'playlist-import',
    event: post({ password: PW, playlistId: PL_ID, member: 'kafu', tags: 'MV', album_id: 55 }),
    routes: [
      ...plRoutesTwoPages,
      { method: 'GET', match: 'videos?select=id,url&limit=10000&offset=0', body: existingC },
      { method: 'PATCH', match: 'videos?id=eq.300', status: 204, body: '' },
      { method: 'POST', match: '/rest/v1/videos', status: 201, body: '' },
    ],
  },
  {
    name: 'playlist-import/success-no-album', fn: 'playlist-import',
    event: post({ password: PW, playlistId: PL_ID, member: 'kafu' }),
    routes: [
      ...plRoutesTwoPages,
      { method: 'GET', match: 'videos?select=id,url&limit=10000&offset=0', body: existingC },
      { method: 'POST', match: '/rest/v1/videos', status: 201, body: '' },
    ],
  },
  {
    name: 'playlist-import/no-new-linked-only', fn: 'playlist-import',
    event: post({ password: PW, playlistId: PL_ID, member: 'kafu', album_id: 55 }),
    routes: [
      { match: 'playlistItems', body: { items: [plVid('CCCCCCCCCCC', '既存C', '2026-01-01T00:00:00Z')] } },
      { method: 'GET', match: 'videos?select=id,url&limit=10000&offset=0', body: existingC },
      { method: 'PATCH', match: 'videos?id=eq.300', status: 204, body: '' },
    ],
  },
  {
    name: 'playlist-import/overflow-guard', fn: 'playlist-import',
    event: post({ password: PW, playlistId: PL_ID, member: 'kafu' }),
    routes: [
      { match: 'playlistItems', body: { items: [plVid('AAAAAAAAAAA', '新曲A', '2026-01-02T00:00:00Z')] } },
      { method: 'GET', match: 'videos?select=id,url&limit=10000&offset=0', body: () => bigRows(10000) },
    ],
  },
  {
    name: 'playlist-import/insert-fail', fn: 'playlist-import',
    event: post({ password: PW, playlistId: PL_ID, member: 'kafu' }),
    routes: [
      { match: 'playlistItems', body: { items: [plVid('AAAAAAAAAAA', '新曲A', '2026-01-02T00:00:00Z')] } },
      { method: 'GET', match: 'videos?select=id,url&limit=10000&offset=0', body: [] },
      { method: 'POST', match: '/rest/v1/videos', status: 500, body: 'insert exploded' },
    ],
  },
);

// ═══════════════════════════════════════════════════════════════
// admin-auth
// ═══════════════════════════════════════════════════════════════
scenarios.push(
  { name: 'admin-auth/options', fn: 'admin-auth', event: { httpMethod: 'OPTIONS', headers: {} }, routes: [] },
  { name: 'admin-auth/405-get', fn: 'admin-auth', event: get(), routes: [] },
  { name: 'admin-auth/wrong-password', fn: 'admin-auth', event: post({ password: 'wrong_pw' }), routes: [] },
  { name: 'admin-auth/success', fn: 'admin-auth', event: post({ password: PW }), routes: [] },
  { name: 'admin-auth/malformed', fn: 'admin-auth', event: post('not json'), routes: [] },
);

// ═══════════════════════════════════════════════════════════════
// admin-query
// ═══════════════════════════════════════════════════════════════
const AQ = { authorization: `Bearer ${ADMIN_TOKEN}` };
scenarios.push(
  { name: 'admin-query/options', fn: 'admin-query', event: { httpMethod: 'OPTIONS', headers: {} }, routes: [] },
  { name: 'admin-query/405-get', fn: 'admin-query', event: get(), routes: [] },
  { name: 'admin-query/no-auth', fn: 'admin-query', event: post({ table: 'videos' }), routes: [] },
  { name: 'admin-query/wrong-auth', fn: 'admin-query', event: post({ table: 'videos' }, { authorization: 'Bearer deadbeef' }), routes: [] },
  { name: 'admin-query/env-missing', fn: 'admin-query', env: { SUPABASE_URL: undefined }, event: post({ table: 'videos' }, AQ), routes: [] },
  { name: 'admin-query/invalid-json', fn: 'admin-query', event: post('{{{', AQ), routes: [] },
  { name: 'admin-query/query-no-table', fn: 'admin-query', event: post({}, AQ), routes: [] },
  {
    // 憲法5ガード: limit未指定 → limit=10000&offset=0 が外向きURLに付くこと（callsで比較）
    name: 'admin-query/query-default-limit', fn: 'admin-query',
    event: post({ table: 'videos', select: 'id,title' }, AQ),
    routes: [{ method: 'GET', match: (u) => u.includes('/rest/v1/videos?select='), body: [VIDEO5, VIDEO9] }],
  },
  {
    name: 'admin-query/query-full-params', fn: 'admin-query',
    event: post({ table: 'videos', select: '*', filter: 'member=eq.kafu', order: 'date.desc', limit: '5', offset: '2' }, AQ),
    routes: [{ method: 'GET', match: (u) => u.includes('/rest/v1/videos?select='), body: [VIDEO5] }],
  },
  {
    name: 'admin-query/query-sb-error', fn: 'admin-query',
    event: post({ table: 'nope' }, AQ),
    routes: [{ method: 'GET', match: '/rest/v1/nope', status: 404, body: { message: 'relation "public.nope" does not exist', code: '42P01' } }],
  },
  { name: 'admin-query/insert-missing', fn: 'admin-query', event: post({ action: 'insert', table: 'videos' }, AQ), routes: [] },
  {
    name: 'admin-query/insert-success', fn: 'admin-query',
    event: post({ action: 'insert', table: 'videos', data: { title: '新曲', member: 'koko' } }, AQ),
    routes: [{ method: 'POST', match: '/rest/v1/videos', status: 201, body: [{ id: 200, title: '新曲', member: 'koko' }] }],
  },
  {
    name: 'admin-query/insert-nonarray-error', fn: 'admin-query',
    event: post({ action: 'insert', table: 'videos', data: { title: 'x' } }, AQ),
    routes: [{ method: 'POST', match: '/rest/v1/videos', status: 409, body: { message: 'duplicate' } }],
  },
  {
    name: 'admin-query/update-success', fn: 'admin-query',
    event: post({ action: 'update', table: 'videos', id: 7, data: { status: 'published' } }, AQ),
    routes: [{ method: 'PATCH', match: 'videos?id=eq.7', status: 200, body: [{ id: 7, status: 'published' }] }],
  },
  {
    name: 'admin-query/delete-success', fn: 'admin-query',
    event: post({ action: 'delete', table: 'videos', id: 7 }, AQ),
    routes: [{ method: 'DELETE', match: 'videos?id=eq.7', status: 204, body: '' }],
  },
  {
    name: 'admin-query/delete-fail', fn: 'admin-query',
    event: post({ action: 'delete', table: 'videos', id: 7 }, AQ),
    routes: [{ method: 'DELETE', match: 'videos?id=eq.7', status: 409, body: '' }],
  },
  { name: 'admin-query/youtube-invalid-id', fn: 'admin-query', event: post({ action: 'youtube', videoId: 'short' }, AQ), routes: [] },
  { name: 'admin-query/youtube-env-missing', fn: 'admin-query', env: { YOUTUBE_API_KEY: undefined }, event: post({ action: 'youtube', videoId: 'AAAAAAAAAAA' }, AQ), routes: [] },
  {
    name: 'admin-query/youtube-not-found', fn: 'admin-query',
    event: post({ action: 'youtube', videoId: 'AAAAAAAAAAA' }, AQ),
    routes: [{ match: 'youtube/v3/videos', body: { items: [] } }],
  },
  {
    name: 'admin-query/youtube-success-thumb-fallback', fn: 'admin-query',
    event: post({ action: 'youtube', videoId: 'AAAAAAAAAAA' }, AQ),
    routes: [{
      match: 'youtube/v3/videos',
      body: { items: [{ snippet: { title: '糸', publishedAt: '2023-01-01T09:00:00Z', thumbnails: { high: { url: 'https://i.ytimg.com/hi.jpg' }, default: { url: 'https://i.ytimg.com/def.jpg' } } } }] },
    }],
  },
  { name: 'admin-query/unknown-action', fn: 'admin-query', event: post({ action: 'destroy-all' }, AQ), routes: [] },
  // ── playlist-import action ──
  { name: 'admin-query/pl-missing-fields', fn: 'admin-query', event: post({ action: 'playlist-import', playlistId: PL_ID }, AQ), routes: [] },
  { name: 'admin-query/pl-invalid-id', fn: 'admin-query', event: post({ action: 'playlist-import', playlistId: 'XX', member: 'kafu' }, AQ), routes: [] },
  {
    name: 'admin-query/pl-yt-error', fn: 'admin-query',
    event: post({ action: 'playlist-import', playlistId: PL_ID, member: 'kafu' }, AQ),
    routes: [{ match: 'playlistItems', body: { error: { message: 'quota exceeded' } } }],
  },
  {
    name: 'admin-query/pl-yt-error-no-message', fn: 'admin-query',
    event: post({ action: 'playlist-import', playlistId: PL_ID, member: 'kafu' }, AQ),
    routes: [{ match: 'playlistItems', body: { error: { code: 403 } } }],
  },
  {
    name: 'admin-query/pl-success-dedup-linked', fn: 'admin-query',
    event: post({ action: 'playlist-import', playlistId: PL_ID, member: 'kafu', tags: 'MV', album_id: 55 }, AQ),
    routes: [
      ...plRoutesTwoPages,
      { method: 'GET', match: 'videos?select=id,url&limit=10000&offset=0', body: existingC },
      { method: 'PATCH', match: 'videos?id=eq.300', status: 204, body: '' },
      { method: 'POST', match: '/rest/v1/videos', status: 201, body: '' },
    ],
  },
  {
    name: 'admin-query/pl-overflow-guard', fn: 'admin-query',
    event: post({ action: 'playlist-import', playlistId: PL_ID, member: 'kafu' }, AQ),
    routes: [
      { match: 'playlistItems', body: { items: [plVid('AAAAAAAAAAA', '新曲A', '2026-01-02T00:00:00Z')] } },
      { method: 'GET', match: 'videos?select=id,url&limit=10000&offset=0', body: () => bigRows(10000) },
    ],
  },
  {
    name: 'admin-query/pl-insert-fail', fn: 'admin-query',
    event: post({ action: 'playlist-import', playlistId: PL_ID, member: 'kafu' }, AQ),
    routes: [
      { match: 'playlistItems', body: { items: [plVid('AAAAAAAAAAA', '新曲A', '2026-01-02T00:00:00Z')] } },
      { method: 'GET', match: 'videos?select=id,url&limit=10000&offset=0', body: [] },
      { method: 'POST', match: '/rest/v1/videos', status: 500, body: 'insert exploded' },
    ],
  },
);

// ═══════════════════════════════════════════════════════════════
// ingest-youtube
// ═══════════════════════════════════════════════════════════════
const CHANNEL = {
  id: 77, channel_id: 'UCkafu_dummy', member_id: 'kafu', enabled: true,
  uploads_playlist_id: 'UUkafu_dummy',
  last_video_published_at: '2026-01-10T00:00:00Z', last_checked_at: '2026-01-14T00:00:00Z',
};
const INGEST_PLAYLIST = {
  items: [
    plVid('sng_kafu_01', '花譜 - 春の歌【オリジナルMV】', '2026-01-12T00:00:00Z'),
    plVid('sht_kafu_02', '新曲ちょい見せ #shorts', '2026-01-12T06:00:00Z'),
    plVid('liv_kafu_03', '不可解参 ワンマンライブ映像', '2026-01-12T12:00:00Z'),
    plVid('ann_kafu_04', '新アルバム発売決定 トレーラー', '2026-01-13T00:00:00Z'),
    plVid('cov_kafu_05', '理芽とデュエット - Covered by 花譜', '2026-01-13T06:00:00Z'),
    plVid('old_kafu_06', 'カーソル以前の旧曲', '2026-01-05T00:00:00Z'),
    plVid('exs_kafu_07', '既存曲（DB登録済み）', '2026-01-14T00:00:00Z'),
    plVid('mis_kafu_08', '詳細未取得（プレミア処理中）', '2026-01-14T06:00:00Z'),
  ],
};
const INGEST_DETAILS = {
  items: [
    ytDetail('sng_kafu_01', '花譜 - 春の歌【オリジナルMV】', '2026-01-12T00:00:00Z', 'PT4M10S'),
    ytDetail('sht_kafu_02', '新曲ちょい見せ #shorts', '2026-01-12T06:00:00Z', 'PT30S'),
    ytDetail('liv_kafu_03', '不可解参 ワンマンライブ映像', '2026-01-12T12:00:00Z', 'PT1H2M3S', { live: true }),
    ytDetail('ann_kafu_04', '新アルバム発売決定 トレーラー', '2026-01-13T00:00:00Z', 'PT2M0S'),
    ytDetail('cov_kafu_05', '理芽とデュエット - Covered by 花譜', '2026-01-13T06:00:00Z', 'PT3M45S'),
    ytDetail('exs_kafu_07', '既存曲（DB登録済み）', '2026-01-14T00:00:00Z', 'PT4M0S'),
    // mis_kafu_08 は意図的に欠落（削除/非公開/プレミア処理中の再現）
  ],
};
const ingestChannelsRoute = (channels) => ({
  method: 'GET', match: 'ingest_channels?select=*&enabled=eq.true', body: channels,
});
const ingestExistingRoute = (rows) => ({
  method: 'GET', match: 'videos?select=url&limit=10000&offset=0', body: rows,
});

scenarios.push(
  { name: 'ingest-youtube/manual-401', fn: 'ingest-youtube', event: post({}), routes: [] },
  { name: 'ingest-youtube/env-missing', fn: 'ingest-youtube', env: { YOUTUBE_API_KEY: undefined }, event: {}, routes: [] },
  {
    name: 'ingest-youtube/scheduled-no-channels', fn: 'ingest-youtube', event: {},
    routes: [ingestChannelsRoute([])],
  },
  {
    name: 'ingest-youtube/manual-ok-no-channels', fn: 'ingest-youtube',
    event: post({}, { authorization: `Bearer ${PW}` }),
    routes: [ingestChannelsRoute([])],
  },
  {
    // 分類全種 + 既存dedup + カーソルクランプ + INSERT + PATCH（外向きbodyもcallsで比較）
    name: 'ingest-youtube/scheduled-rich', fn: 'ingest-youtube', event: {},
    routes: [
      ingestChannelsRoute([CHANNEL]),
      ingestExistingRoute([{ url: 'https://www.youtube.com/watch?v=exs_kafu_07' }]),
      { match: (u) => u.includes('playlistItems') && u.includes('UUkafu_dummy'), body: INGEST_PLAYLIST },
      { match: 'youtube/v3/videos?part=snippet,contentDetails,liveStreamingDetails', body: INGEST_DETAILS },
      { method: 'POST', match: '/rest/v1/videos', status: 201, body: '' },
      { method: 'PATCH', match: 'ingest_channels?id=eq.77', status: 204, body: '' },
    ],
  },
  {
    name: 'ingest-youtube/scheduled-no-new', fn: 'ingest-youtube', event: {},
    routes: [
      ingestChannelsRoute([CHANNEL]),
      ingestExistingRoute([]),
      { match: (u) => u.includes('playlistItems') && u.includes('UUkafu_dummy'), body: { items: [plVid('old_kafu_06', '旧曲', '2026-01-05T00:00:00Z')] } },
      { method: 'PATCH', match: 'ingest_channels?id=eq.77', status: 204, body: '' },
    ],
  },
  {
    name: 'ingest-youtube/overflow-guard', fn: 'ingest-youtube', event: {},
    routes: [
      ingestChannelsRoute([CHANNEL]),
      ingestExistingRoute(bigRows(10000)),
    ],
  },
  {
    name: 'ingest-youtube/channel-yt-error', fn: 'ingest-youtube', event: {},
    routes: [
      ingestChannelsRoute([CHANNEL]),
      ingestExistingRoute([]),
      { match: 'playlistItems', body: { error: { message: 'quota exceeded' } } },
    ],
  },
  {
    name: 'ingest-youtube/resolve-uploads-id', fn: 'ingest-youtube', event: {},
    routes: [
      ingestChannelsRoute([{ ...CHANNEL, id: 78, channel_id: 'UCkoko_dummy', member_id: 'koko', uploads_playlist_id: null }]),
      ingestExistingRoute([]),
      { match: 'youtube/v3/channels?part=contentDetails', body: { items: [{ contentDetails: { relatedPlaylists: { uploads: 'UUkoko_dummy' } } }] } },
      { method: 'PATCH', match: 'ingest_channels?id=eq.78', status: 204, body: '' },
      { match: (u) => u.includes('playlistItems') && u.includes('UUkoko_dummy'), body: { items: [] } },
    ],
  },
  {
    name: 'ingest-youtube/resolve-uploads-fail', fn: 'ingest-youtube', event: {},
    routes: [
      ingestChannelsRoute([{ ...CHANNEL, id: 78, channel_id: 'UCkoko_dummy', member_id: 'koko', uploads_playlist_id: null }]),
      ingestExistingRoute([]),
      { match: 'youtube/v3/channels?part=contentDetails', body: { items: [] } },
    ],
  },
  {
    name: 'ingest-youtube/insert-fail', fn: 'ingest-youtube', event: {},
    routes: [
      ingestChannelsRoute([CHANNEL]),
      ingestExistingRoute([]),
      { match: (u) => u.includes('playlistItems') && u.includes('UUkafu_dummy'), body: { items: [plVid('sng_kafu_01', '花譜 - 春の歌【オリジナルMV】', '2026-01-12T00:00:00Z')] } },
      { match: 'youtube/v3/videos?part=snippet,contentDetails,liveStreamingDetails', body: { items: [ytDetail('sng_kafu_01', '花譜 - 春の歌【オリジナルMV】', '2026-01-12T00:00:00Z', 'PT4M10S')] } },
      { method: 'POST', match: '/rest/v1/videos', status: 500, body: 'db down '.repeat(40) },
    ],
  },
  {
    // sbFetch errSlice=300 の境界確認（350文字 → 300に切り詰め）
    name: 'ingest-youtube/channels-sb-error-slice300', fn: 'ingest-youtube', event: {},
    routes: [{ method: 'GET', match: 'ingest_channels', status: 500, body: 'E'.repeat(350) }],
  },
);

// ═══════════════════════════════════════════════════════════════
// observer-link-exchange（全パス）
// ═══════════════════════════════════════════════════════════════
const EXH = { 'x-nf-client-connection-ip': CLIENT_IP };
const CLIENT_HASH = sha256(CLIENT_IP);
const exRate = (rows) => ({
  method: 'GET', match: (u) => u.includes('song_bottles?select=id&client_hash=eq.'), body: rows,
});
const exVideoById = (id, rows, { retry42703 = false } = {}) => retry42703
  ? [
    { method: 'GET', match: (u) => u.includes(`id=eq.${id}`) && u.includes('rest/v1/videos') && u.includes('status=eq.published'), status: 400, body: 'code 42703: column videos.status does not exist' },
    { method: 'GET', match: (u) => u.includes(`id=eq.${id}`) && u.includes('rest/v1/videos') && !u.includes('status=eq.published'), body: rows },
  ]
  : [{ method: 'GET', match: (u) => u.includes(`id=eq.${id}`) && u.includes('rest/v1/videos') && u.includes('status=eq.published'), body: rows }];
const exInsert = (rows) => ({
  method: 'POST', match: 'rest/v1/song_bottles', status: 201, body: rows,
});
const exCandidates = (rows) => ({
  method: 'GET', match: (u) => u.includes('song_bottles?select=*&status=eq.waiting'), body: rows,
});
const exFallbackList = (rows) => ({
  method: 'GET', match: (u) => u.includes('rest/v1/videos') && u.includes('limit=50') && u.includes('status=eq.published'), body: rows,
});
// fallback抽選のcount=exact窓（content-rangeをresHeadersで返す）。
// total<=50 のfixtureに固定: Math.random消費が増えず result はbase比バイト一致のまま（差分はcallsのみ）。
const exCount = (total) => ({
  method: 'GET',
  match: (u) => u.includes('videos?select=id&status=eq.published&limit=1'),
  body: [{ id: 1 }],
  resHeaders: { 'content-range': `0-0/${total}` },
});
// 42703（status列なし）環境ではcountクエリも400になる — content-range無し → offset=0 degrade経路
const exCount42703 = () => ({
  method: 'GET',
  match: (u) => u.includes('videos?select=id&status=eq.published&limit=1'),
  status: 400,
  body: 'code 42703: column videos.status does not exist',
});
const MY_BOTTLE = { id: B_MINE, video_id: 5, mood_tags: ['Night'], message: 'よい夜を', client_hash: CLIENT_HASH, status: 'waiting', created_at: '2026-01-15T12:00:00.000Z' };
const OTHER_BOTTLE = { id: B_OTHER, video_id: 9, mood_tags: ['Rain'], message: '雨の日に', client_hash: 'otherhash', status: 'waiting', created_at: '2026-01-15T11:00:00.000Z' };
const THIRD_BOTTLE = { id: B_THIRD, video_id: 12, mood_tags: [], message: null, client_hash: 'thirdhash', status: 'waiting', created_at: '2026-01-15T10:00:00.000Z' };

scenarios.push(
  { name: 'exchange/options', fn: 'observer-link-exchange', event: { httpMethod: 'OPTIONS', headers: EXH }, routes: [] },
  { name: 'exchange/405-get', fn: 'observer-link-exchange', event: { httpMethod: 'GET', headers: EXH }, routes: [] },
  { name: 'exchange/invalid-json', fn: 'observer-link-exchange', event: post('{{{', EXH), routes: [] },
  { name: 'exchange/invalid-video-id', fn: 'observer-link-exchange', event: post({ video_id: 'abc' }, EXH), routes: [] },
  {
    name: 'exchange/rate-limit', fn: 'observer-link-exchange',
    event: post({ video_id: 5 }, EXH),
    routes: [exRate(Array.from({ length: 10 }, (_, i) => ({ id: i + 1 })))],
  },
  {
    name: 'exchange/video-not-published', fn: 'observer-link-exchange',
    event: post({ video_id: 5 }, EXH),
    routes: [exRate([]), ...exVideoById(5, [])],
  },
  {
    name: 'exchange/matched', fn: 'observer-link-exchange',
    event: post({ video_id: 5, mood_tags: ['Night', 'Chill', 'Rain'], message: 'この曲をどうぞ、20文字超えたら切り詰め' }, EXH),
    routes: [
      exRate([{ id: 1 }, { id: 2 }]),
      ...exVideoById(5, [VIDEO5]),
      exInsert([MY_BOTTLE]),
      exCandidates([OTHER_BOTTLE, THIRD_BOTTLE]),
      { method: 'PATCH', match: (u) => u.includes(`id=eq.${B_OTHER}`) && u.includes('status=eq.waiting'), body: [{ ...OTHER_BOTTLE, status: 'matched', matched_with: B_MINE }] },
      { method: 'PATCH', match: (u) => u.includes(`id=eq.${B_MINE}`), body: [{ ...MY_BOTTLE, status: 'matched', matched_with: B_OTHER }] },
      ...exVideoById(9, [VIDEO9]),
    ],
  },
  {
    name: 'exchange/race-lost-to-fallback', fn: 'observer-link-exchange',
    event: post({ video_id: 5 }, EXH),
    routes: [
      exRate([]),
      ...exVideoById(5, [VIDEO5]),
      exInsert([MY_BOTTLE]),
      exCandidates([OTHER_BOTTLE]),
      { method: 'PATCH', match: (u) => u.includes(`id=eq.${B_OTHER}`) && u.includes('status=eq.waiting'), body: [] },
      exCount(3),
      exFallbackList([VIDEO5, VIDEO9, VIDEO12]),
      { method: 'PATCH', match: (u) => u.includes(`id=eq.${B_MINE}`), body: [{ ...MY_BOTTLE, status: 'fallback_matched' }] },
    ],
  },
  {
    name: 'exchange/no-candidates-fallback', fn: 'observer-link-exchange',
    event: post({ video_id: 5, mood_tags: 'not-an-array', message: 42 }, EXH),
    routes: [
      exRate([]),
      ...exVideoById(5, [VIDEO5]),
      exInsert([MY_BOTTLE]),
      exCandidates([]),
      exCount(3),
      exFallbackList([VIDEO5, VIDEO9, VIDEO12]),
      { method: 'PATCH', match: (u) => u.includes(`id=eq.${B_MINE}`), body: [{ ...MY_BOTTLE, status: 'fallback_matched' }] },
    ],
  },
  {
    name: 'exchange/fallback-empty-pool', fn: 'observer-link-exchange',
    event: post({ video_id: 5 }, EXH),
    routes: [
      exRate([]),
      ...exVideoById(5, [VIDEO5]),
      exInsert([MY_BOTTLE]),
      exCandidates([]),
      exCount(1),
      exFallbackList([VIDEO5]), // sent自身のみ → pool空 → received:null（PATCHなし）
    ],
  },
  {
    name: 'exchange/42703-retry', fn: 'observer-link-exchange',
    event: post({ video_id: 5 }, EXH),
    routes: [
      exRate([]),
      ...exVideoById(5, [VIDEO5], { retry42703: true }),
      exInsert([MY_BOTTLE]),
      exCandidates([]),
      exCount42703(),
      { method: 'GET', match: (u) => u.includes('rest/v1/videos') && u.includes('limit=50') && u.includes('status=eq.published'), status: 400, body: 'code 42703: column videos.status does not exist' },
      { method: 'GET', match: (u) => u.includes('rest/v1/videos') && u.includes('limit=50') && !u.includes('status=eq.published'), body: [VIDEO5, VIDEO9] },
      { method: 'PATCH', match: (u) => u.includes(`id=eq.${B_MINE}`), body: [{ ...MY_BOTTLE, status: 'fallback_matched' }] },
    ],
  },
  {
    name: 'exchange/insert-empty', fn: 'observer-link-exchange',
    event: post({ video_id: 5 }, EXH),
    routes: [exRate([]), ...exVideoById(5, [VIDEO5]), exInsert([])],
  },
  {
    name: 'exchange/admin-bypass', fn: 'observer-link-exchange',
    event: post({ video_id: 5 }, { ...EXH, 'x-admin-key': PW }),
    routes: [
      // rate limit fetch はスキップされる（callsに出ないことを比較で保証）
      ...exVideoById(5, [VIDEO5]),
      exInsert([MY_BOTTLE]),
      exCandidates([]),
      exCount(2),
      exFallbackList([VIDEO5, VIDEO9]),
      { method: 'PATCH', match: (u) => u.includes(`id=eq.${B_MINE}`), body: [{ ...MY_BOTTLE, status: 'fallback_matched' }] },
    ],
  },
  {
    name: 'exchange/match-patch-http-fail', fn: 'observer-link-exchange',
    event: post({ video_id: 5 }, EXH),
    routes: [
      exRate([]),
      ...exVideoById(5, [VIDEO5]),
      exInsert([MY_BOTTLE]),
      exCandidates([OTHER_BOTTLE]),
      { method: 'PATCH', match: (u) => u.includes(`id=eq.${B_OTHER}`) && u.includes('status=eq.waiting'), status: 500, body: 'patch failed' },
    ],
  },
  {
    // sbFetch errSlice=200 経路（250文字エラー → throw → 500 INTERNAL_ERROR）
    name: 'exchange/sb-error', fn: 'observer-link-exchange',
    event: post({ video_id: 5 }, EXH),
    routes: [{ method: 'GET', match: (u) => u.includes('song_bottles?select=id&client_hash=eq.'), status: 500, body: 'F'.repeat(250) }],
  },
);

// ═══════════════════════════════════════════════════════════════
// observer-link-result（4種HTML全文一致）
// ═══════════════════════════════════════════════════════════════
const rsBottle = (rows) => ({
  method: 'GET', match: (u) => u.includes(`song_bottles?select=*&id=eq.${B_MINE}`), body: rows,
});
const rsMatchedBottle = (rows) => ({
  method: 'GET', match: (u) => u.includes(`song_bottles?select=*&id=eq.${B_OTHER}`), body: rows,
});
const rsVideoById = (id, rows) => ({
  method: 'GET', match: (u) => u.includes(`id=eq.${id}`) && u.includes('rest/v1/videos') && u.includes('status=eq.published'), body: rows,
});

scenarios.push(
  { name: 'result/405-post', fn: 'observer-link-result', event: post({}), routes: [] },
  { name: 'result/no-id-expired', fn: 'observer-link-result', event: get(null), routes: [] },
  { name: 'result/bad-uuid-expired', fn: 'observer-link-result', event: get({ id: 'not-a-uuid' }), routes: [] },
  {
    name: 'result/not-found-expired', fn: 'observer-link-result',
    event: get({ id: B_MINE }),
    routes: [rsBottle([])],
  },
  {
    name: 'result/waiting-page', fn: 'observer-link-result',
    event: get({ id: B_MINE }),
    routes: [
      rsBottle([{ id: B_MINE, video_id: 5, status: 'waiting', matched_with: null, message: '待機中のメッセージ', created_at: '2026-01-15T10:00:00.000Z' }]),
      rsVideoById(5, [VIDEO5]),
    ],
  },
  {
    name: 'result/matched-page', fn: 'observer-link-result',
    event: get({ id: B_MINE }),
    routes: [
      rsBottle([{ id: B_MINE, video_id: 5, status: 'matched', matched_with: B_OTHER, message: '私のメッセージ<b>', created_at: '2026-01-15T10:00:00.000Z' }]),
      rsVideoById(5, [VIDEO5]),
      rsMatchedBottle([{ id: B_OTHER, video_id: 9, status: 'matched', matched_with: B_MINE, message: '相手の"メッセージ"', created_at: '2026-01-14T12:00:00.000Z' }]),
      rsVideoById(9, [VIDEO9]),
    ],
  },
  {
    name: 'result/fallback-page', fn: 'observer-link-result',
    event: get({ id: B_MINE }),
    routes: [
      rsBottle([{ id: B_MINE, video_id: 5, status: 'fallback_matched', matched_with: null, fallback_video_id: 12, message: 'fbメッセージ', created_at: '2026-01-15T10:00:00.000Z' }]),
      rsVideoById(5, [VIDEO5]),
      rsVideoById(12, [VIDEO12]),
    ],
  },
  {
    name: 'result/matched-no-received-expired', fn: 'observer-link-result',
    event: get({ id: B_MINE }),
    routes: [
      rsBottle([{ id: B_MINE, video_id: 5, status: 'matched', matched_with: null, message: null, created_at: '2026-01-15T10:00:00.000Z' }]),
      rsVideoById(5, [VIDEO5]),
    ],
  },
  {
    name: 'result/42703-retry-waiting', fn: 'observer-link-result',
    event: get({ id: B_MINE }),
    routes: [
      rsBottle([{ id: B_MINE, video_id: 5, status: 'waiting', matched_with: null, message: null, created_at: '2026-01-15T10:00:00.000Z' }]),
      { method: 'GET', match: (u) => u.includes('id=eq.5') && u.includes('rest/v1/videos') && u.includes('status=eq.published'), status: 400, body: 'code 42703: column videos.status does not exist' },
      { method: 'GET', match: (u) => u.includes('id=eq.5') && u.includes('rest/v1/videos') && !u.includes('status=eq.published'), body: [VIDEO5] },
    ],
  },
  {
    name: 'result/error-expired', fn: 'observer-link-result',
    event: get({ id: B_MINE }),
    routes: [{ method: 'GET', match: 'song_bottles', networkError: 'network down dummy' }],
  },
);

// ═══════════════════════════════════════════════════════════════
// albums-get / videos-get
// ═══════════════════════════════════════════════════════════════
scenarios.push(
  {
    name: 'albums-get/success', fn: 'albums-get', event: get(),
    routes: [{ method: 'GET', match: '/rest/v1/albums', body: [{ id: 1, member: 'kafu', name: '狂想', purchase_url: null, is_sold_out: false }] }],
  },
  {
    name: 'albums-get/error', fn: 'albums-get', event: get(),
    routes: [{ method: 'GET', match: '/rest/v1/albums', networkError: 'network down dummy' }],
  },
  {
    name: 'videos-get/single-page', fn: 'videos-get', event: get(),
    routes: [{ method: 'GET', match: (u) => u.endsWith('offset=0'), body: [VIDEO5, VIDEO9, VIDEO12] }],
  },
  {
    name: 'videos-get/multi-page', fn: 'videos-get', event: get(),
    routes: [
      { method: 'GET', match: (u) => u.endsWith('offset=1000'), body: () => pageRows(500, 1000) },
      { method: 'GET', match: (u) => u.endsWith('offset=0'), body: () => pageRows(1000, 0) },
    ],
  },
  {
    name: 'videos-get/empty', fn: 'videos-get', event: get(),
    routes: [{ method: 'GET', match: (u) => u.endsWith('offset=0'), body: [] }],
  },
  {
    name: 'videos-get/42703-retry', fn: 'videos-get', event: get(),
    routes: [
      { method: 'GET', match: (u) => u.includes('status=eq.published'), status: 400, body: 'code 42703: column videos.status does not exist' },
      { method: 'GET', match: (u) => !u.includes('status=eq.published'), body: [VIDEO5, VIDEO9] },
    ],
  },
  {
    name: 'videos-get/sb-error-no-store', fn: 'videos-get', event: get(),
    routes: [{ method: 'GET', match: 'rest/v1/videos', status: 500, body: 'db is on fire' }],
  },
  {
    name: 'videos-get/non-array', fn: 'videos-get', event: get(),
    routes: [{ method: 'GET', match: 'rest/v1/videos', body: { message: 'unexpected' } }],
  },
);

// ═══════════════════════════════════════════════════════════════
// youtube（B3では完全無変更 — 回帰検知のためスナップショットには含める）
// ═══════════════════════════════════════════════════════════════
scenarios.push(
  { name: 'youtube/invalid-id', fn: 'youtube', event: get({ id: 'short' }), routes: [] },
  { name: 'youtube/env-missing', fn: 'youtube', env: { YOUTUBE_API_KEY: undefined }, event: get({ id: 'AAAAAAAAAAA' }), routes: [] },
  {
    name: 'youtube/yt-error', fn: 'youtube', event: get({ id: 'AAAAAAAAAAA' }),
    routes: [{ match: 'youtube/v3/videos', body: { error: { message: 'API key invalid' } } }],
  },
  {
    name: 'youtube/not-found', fn: 'youtube', event: get({ id: 'AAAAAAAAAAA' }),
    routes: [{ match: 'youtube/v3/videos', body: { items: [] } }],
  },
  {
    name: 'youtube/success', fn: 'youtube', event: get({ id: 'AAAAAAAAAAA' }),
    routes: [{
      match: 'youtube/v3/videos',
      body: { items: [{ snippet: { title: '糸', publishedAt: '2023-01-01T09:00:00Z', thumbnails: { medium: { url: 'https://i.ytimg.com/med.jpg' }, default: { url: 'https://i.ytimg.com/def.jpg' } } } }] },
    }],
  },
  {
    name: 'youtube/network-error', fn: 'youtube', event: get({ id: 'AAAAAAAAAAA' }),
    routes: [{ match: 'youtube/v3/videos', networkError: 'network down dummy' }],
  },
);
