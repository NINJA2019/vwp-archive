const { readKey, sbHeaders } = require('./_shared/supabase');

exports.handler = async () => {
  const url = process.env.SUPABASE_URL;
  // 読み取り専用: anon key を使用（RLS で制御）
  // フォールバック: SUPABASE_ANON_KEY 未設定時は SECRET_KEY を使用（readKey）
  const key = readKey();
  const headers = sbHeaders(key);

  // 1ページ取得。migration未適用で列が存在しない場合（PostgREST 42703）は
  // 該当列を外して最大2回再試行する。
  // (a) starter列（is_starter/starter_order/starter_note）未存在: starter列をselectから除去。
  // (b) status列未存在: status=eq.published フィルタを除去。
  //     両方が未存在のケースでは (a) → (b) の順に両方除去して合成する。
  //     migration適用前は status 列が存在しない = pending 行も存在し得ないため安全。
  const STARTER_COLS = ',is_starter,starter_order,starter_note';
  async function fetchPage(pageUrl) {
    let res = await fetch(pageUrl, { headers });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (errText.includes('42703')) {
        let retryUrl = pageUrl;
        if (/is_starter|starter_order|starter_note/.test(errText)) {
          // starter列が未存在: selectからstarter列を除去
          retryUrl = retryUrl.replace(STARTER_COLS, '');
        }
        if (pageUrl.includes('&status=eq.published') && /\bstatus\b/.test(errText)) {
          // status列が未存在: statusフィルタを除去（starter除去と合成可能）
          retryUrl = retryUrl.replace('&status=eq.published', '');
        }
        if (retryUrl !== pageUrl) {
          res = await fetch(retryUrl, { headers });
        }
      }
      if (!res.ok) {
        const text = await res.text().catch(() => errText);
        throw new Error(`Supabase ${res.status}: ${(text || errText).slice(0, 200)}`);
      }
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('Supabase returned non-array response');
    }
    return data;
  }

  try {
    let all = [];
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const data = await fetchPage(
        `${url}/rest/v1/videos?select=id,url,title,date,member,tags,note,spotify_url,album_id,content_type${STARTER_COLS}&status=eq.published&order=date.desc,id.desc&limit=${pageSize}&offset=${offset}`
      );
      if (data.length === 0) break;
      all = all.concat(data);
      if (data.length < pageSize) break;
      offset += pageSize;
    }
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // ブラウザは5分キャッシュ
        'Cache-Control': 'public, max-age=300',
        // Netlify CDN: 5分キャッシュ、stale-while-revalidate=600（バックグラウンド更新）
        'Netlify-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
      body: JSON.stringify(all),
    };
  } catch (e) {
    // エラー・非配列レスポンスをキャッシュ可能な200空配列で返さない（CDN焼き付き防止）
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
