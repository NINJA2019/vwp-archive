const { serviceKey, sbFetch } = require('./_shared/supabase');

// observer-link-status — 送信済みボトルの status 照会（読み取り専用）
// 憲法2: videos テーブルには一切触れない。song_bottles の id,status のみを返す
// （status は waiting / matched / fallback_matched のenum相当のみ。pending漏洩リスクゼロ）。
// レート制御なし（読み取り専用・enum返却のみ）。getClientHash 不要。

const ALLOWED_ORIGIN = 'https://vwp-archive.netlify.app';

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

// result.js と同一の uuidRegex
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
      },
    };
  }
  if (event.httpMethod !== 'GET') {
    return resp(405, { success: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const raw = event.queryStringParameters?.ids || '';
  const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length < 1 || ids.length > 10 || !ids.every(id => uuidRegex.test(id))) {
    return resp(400, { success: false, error: 'INVALID_IDS' });
  }

  const url = process.env.SUPABASE_URL;
  const key = serviceKey();

  try {
    const rows = await sbFetch(
      `${url}/rest/v1/song_bottles?select=id,status&id=in.(${ids.join(',')})`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    const statuses = {};
    if (Array.isArray(rows)) {
      for (const r of rows) statuses[r.id] = r.status;
    }
    // 欠落id（削除済み等）はキー省略
    return resp(200, { success: true, statuses });
  } catch (e) {
    console.error('observer-link-status error:', e);
    return resp(500, { success: false, error: 'INTERNAL_ERROR' });
  }
};
