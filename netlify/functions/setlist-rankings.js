// setlist-rankings — ファン・セレクト集計の読み取り（Phase 1、GET）
// RPC setlist_rankings(p_limit) をメンバー別に整形して返す。
// 憲法2: タイトル等は返さず video_id のみ。フロントは getVideos()（published のみ）と突合し、
//        見つからない id はスキップする（RPC 側の published JOIN と合わせて二重に担保）。
// 冷スタート: submitters < MIN_SUBMITTERS のメンバーは top を空で返す（サーバーで隠す）。
// CDN: videos-get と同じ 5 分キャッシュ。migration 未適用時は available:false（no-store）。

const { serviceKey, sbFetch } = require('./_shared/supabase');
const {
  SETLIST_MEMBERS, MIN_SUBMITTERS, RANK_LIMIT, ALLOWED_ORIGIN,
  isMissingSchemaError, shapeRankings,
} = require('./_shared/setlist');

function resp(status, body, cache) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  };
  if (cache) {
    headers['Cache-Control'] = 'public, max-age=300';
    headers['Netlify-CDN-Cache-Control'] = 'public, s-maxage=300, stale-while-revalidate=600';
  } else {
    headers['Cache-Control'] = 'no-store';
  }
  return { statusCode: status, headers, body: JSON.stringify(body) };
}

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
    return resp(405, { success: false, error: 'METHOD_NOT_ALLOWED' }, false);
  }

  const url = process.env.SUPABASE_URL;
  const key = serviceKey();
  const only = event.queryStringParameters && event.queryStringParameters.member;
  if (only !== undefined && only !== null && only !== '' && !SETLIST_MEMBERS.includes(only)) {
    return resp(400, { success: false, error: 'INVALID_MEMBER' }, false);
  }

  try {
    const rows = await sbFetch(
      `${url}/rest/v1/rpc/setlist_rankings`,
      {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_limit: RANK_LIMIT }),
      }
    );
    let members = shapeRankings(rows);
    // 公開応答は上位 3 件のみ（submit 応答は my_ranks 用に 50 件のまま）
    for (const m of Object.keys(members)) members[m].top = members[m].top.slice(0, 3);
    if (only && SETLIST_MEMBERS.includes(only)) {
      members = { [only]: members[only] };
    }
    return resp(200, { success: true, available: true, min_submitters: MIN_SUBMITTERS, members }, true);
  } catch (e) {
    if (isMissingSchemaError(e)) {
      return resp(200, { success: true, available: false, min_submitters: MIN_SUBMITTERS, members: {} }, false);
    }
    console.error('setlist-rankings error:', e);
    return resp(500, { success: false, error: 'INTERNAL_ERROR' }, false);
  }
};
