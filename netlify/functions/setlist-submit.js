// setlist-submit — ファンのセットリスト登録（Phase 1）
// POST { client_id, member, video_ids[3] }
// 憲法2: video_ids は videos?status=eq.published で存在検証。非公開曲・他メンバー曲・非ソング曲は拒否。
// 同一 client_id × member は upsert（on_conflict）で上書き。レート制限は client_hash（IP SHA-256）で 30 件/24h。
// 応答には CDN を経由しない鮮度 100% のランキング（該当メンバー分）を含める（「登録後にランキングが動く」演出用）。

const { serviceKey, sbFetch } = require('./_shared/supabase');
const { getClientHash } = require('./_shared/client-hash');
const {
  SETLIST_MEMBERS, SETLIST_SIZE, MIN_SUBMITTERS, RANK_LIMIT, ALLOWED_ORIGIN,
  uuidRegex, isMissingSchemaError, shapeRankings,
} = require('./_shared/setlist');

const DAILY_LIMIT = 30;
const MAX_BODY_BYTES = 2048;
// starter-refresh.js の NON_SONG_TYPES と同値（NULL/unknown は song 扱い）
const NON_SONG_TYPES = ['shorts', 'live', 'announcement'];

function resp(status, body) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

// core.js parseMembers と同規則（スペース/カンマ区切り）をサーバー側にインライン
function memberIdsOf(row) {
  return String(row.member || '').split(/[ ,]+/).filter(Boolean);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
        'Access-Control-Allow-Methods': 'POST',
      },
    };
  }
  if (event.httpMethod !== 'POST') {
    return resp(405, { success: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const rawBody = event.body || '';
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return resp(413, { success: false, error: 'PAYLOAD_TOO_LARGE' });
  }
  let body;
  try {
    body = JSON.parse(rawBody || '{}');
  } catch {
    return resp(400, { success: false, error: 'INVALID_JSON' });
  }

  const clientId = typeof body.client_id === 'string' ? body.client_id.trim().toLowerCase() : '';
  if (!uuidRegex.test(clientId)) {
    return resp(400, { success: false, error: 'INVALID_CLIENT_ID' });
  }
  const member = typeof body.member === 'string' ? body.member : '';
  if (!SETLIST_MEMBERS.includes(member)) {
    return resp(400, { success: false, error: 'INVALID_MEMBER' });
  }
  const rawIds = body.video_ids;
  if (!Array.isArray(rawIds) || rawIds.length !== SETLIST_SIZE) {
    return resp(400, { success: false, error: 'INVALID_VIDEO_IDS' });
  }
  const videoIds = rawIds.map(x => (typeof x === 'number' || typeof x === 'string') ? parseInt(x, 10) : NaN);
  if (!videoIds.every(n => Number.isFinite(n) && n > 0) || new Set(videoIds).size !== SETLIST_SIZE) {
    return resp(400, { success: false, error: 'INVALID_VIDEO_IDS' });
  }

  const url = process.env.SUPABASE_URL;
  const key = serviceKey();
  const getHeaders = { apikey: key, Authorization: `Bearer ${key}` };
  const clientHash = getClientHash(event);

  // ── admin bypass（Yuki のテスト用。OL exchange と同型） ──
  const adminKey = event.headers['x-admin-key'] || '';
  const isAdmin = adminKey.length > 0 && adminKey === (process.env.ADMIN_PASSWORD || '');

  try {
    // レート制限（24h の更新件数。admin は免除）
    let dailyUsed = 0;
    if (!isAdmin) {
      const since = new Date(Date.now() - 86400000).toISOString();
      const rateData = await sbFetch(
        `${url}/rest/v1/setlists?select=id&client_hash=eq.${clientHash}&updated_at=gte.${since}`,
        { headers: getHeaders }
      );
      dailyUsed = Array.isArray(rateData) ? rateData.length : 0;
      if (dailyUsed >= DAILY_LIMIT) {
        return resp(429, { success: false, error: 'RATE_LIMIT_EXCEEDED', daily_used: dailyUsed, daily_limit: DAILY_LIMIT });
      }
    }

    // 存在検証（憲法2: published のみ）
    const videoRows = await sbFetch(
      `${url}/rest/v1/videos?select=id,member,content_type&id=in.(${videoIds.join(',')})&status=eq.published`,
      { headers: getHeaders }
    );
    if (!Array.isArray(videoRows) || videoRows.length !== SETLIST_SIZE) {
      return resp(400, { success: false, error: 'VIDEO_NOT_FOUND' });
    }
    // メンバー整合（デュエット曲は両メンバーに登録可: includes 判定）
    if (videoRows.some(r => !memberIdsOf(r).includes(member))) {
      return resp(400, { success: false, error: 'MEMBER_MISMATCH' });
    }
    // 非ソング（shorts/live/announcement）除外
    if (videoRows.some(r => NON_SONG_TYPES.includes(r.content_type))) {
      return resp(400, { success: false, error: 'NOT_A_SONG' });
    }

    // 既存行の有無（GA4 is_update 用）
    const existing = await sbFetch(
      `${url}/rest/v1/setlists?select=id&client_id=eq.${clientId}&member=eq.${member}`,
      { headers: getHeaders }
    );
    const isUpdate = Array.isArray(existing) && existing.length > 0;

    // upsert（UNIQUE(client_id, member) を on_conflict キーに。created_at は送らない = 初回値が残る）
    const upserted = await sbFetch(
      `${url}/rest/v1/setlists?on_conflict=client_id,member`,
      {
        method: 'POST',
        headers: { ...getHeaders, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          client_id: clientId,
          member,
          video_ids: videoIds,
          client_hash: clientHash,
          updated_at: new Date().toISOString(),
        }),
      }
    );
    if (!Array.isArray(upserted) || upserted.length === 0) {
      return resp(500, { success: false, error: 'INTERNAL_ERROR' });
    }

    // 鮮度 100% のランキング（該当メンバー分）
    const rows = await sbFetch(
      `${url}/rest/v1/rpc/setlist_rankings`,
      {
        method: 'POST',
        headers: { ...getHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_limit: RANK_LIMIT }),
      }
    );
    const shaped = shapeRankings(rows)[member];
    const myRanks = {};
    if (shaped.ready) {
      for (const id of videoIds) {
        const hit = shaped.top.find(t => t.video_id === id);
        myRanks[String(id)] = hit ? hit.rank : null;
      }
    }

    return resp(200, {
      success: true,
      member,
      is_update: isUpdate,
      submitters: shaped.submitters,
      min_submitters: MIN_SUBMITTERS,
      ready: shaped.ready,
      remaining: shaped.remaining,
      ranking: shaped.top,
      my_ranks: myRanks,
      daily_used: isAdmin ? 0 : dailyUsed + 1,
      daily_limit: isAdmin ? 999 : DAILY_LIMIT,
      is_admin: isAdmin || undefined,
    });
  } catch (e) {
    if (isMissingSchemaError(e)) {
      // migration 未適用: デプロイ順序が逆でも事故らない
      return resp(503, { success: false, error: 'SETLIST_UNAVAILABLE' });
    }
    console.error('setlist-submit error:', e);
    return resp(500, { success: false, error: 'INTERNAL_ERROR' });
  }
};
