// ═══════════════════════════════════════════════════════════════
// albums-stock-scan.js — アルバム在庫自動スキャンFunction
// 起動: GitHub Actions cron（1日1回 JST朝6:00）+ 手動curl
//       Authorization: Bearer <ADMIN_PASSWORD> 必須（POSTのみ）
// 対象: albums.purchase_url が FINDME STORE（findmestore.thinkr.jp = Shopify）の行。
//       `https://findmestore.thinkr.jp/products/<handle>.js` の JSON `available` を
//       is_sold_out へ同期する（newSoldOut = !available）。
// 安全側の原則: HTTPエラー・非JSON・available欠落・ハンドル抽出失敗は該当行を
//       skipped に記録して is_sold_out には絶対に触らない（ページ消滅・一時障害で
//       誤って SALE に戻す事故防止）。更新は判定が確定し現状と異なる場合のみ。
// ═══════════════════════════════════════════════════════════════

const { getSupabaseUrl, secretKey, sbHeaders, sbFetch } = require('./_shared/supabase');
const { methodNotAllowed, json } = require('./_shared/responses');

// 対応ストアの判定文字列（将来ストア追加時はここに分岐を足す。対象外は skipped:unsupported_domain）
const SUPPORTED_STORE = 'findmestore.thinkr.jp/products/';
// purchase_url からの商品ハンドル抽出（例: /products/kyoso?query → kyoso）
const HANDLE_RE = /\/products\/([^/?#]+)/;
const FETCH_TIMEOUT_MS = 10000; // Shopify product.js のタイムアウト
const POLITE_WAIT_MS = 300;     // 逐次リクエスト間の待機（礼儀）

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  // ── 起動ガード（ingest-youtube の手動起動ガードと同型） ──
  // 本Functionは常にHTTP起動（GitHub Actions cron / 手動curl）のため無条件で必須。
  const ADMIN_PW = process.env.ADMIN_PASSWORD;
  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!ADMIN_PW || token !== ADMIN_PW) {
    return json(401, { error: '起動には Authorization: Bearer <ADMIN_PASSWORD> が必要です' });
  }

  const SUPABASE_URL = getSupabaseUrl();
  const SUPABASE_KEY = secretKey();
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return json(500, { error: '環境変数が不足しています' });
  }

  try {
    // ── albums 全件取得 ──
    // 現状31件程度なので単発クエリでよいが、憲法5の精神で limit 明示 + order=id.asc。
    // limit=1000 は PostgREST Max Rows キャップと同値（albumsが1,000件に迫ったらページング化すること）。
    const albums = await sbFetch(
      `${SUPABASE_URL}/rest/v1/albums?select=id,name,purchase_url,is_sold_out&order=id.asc&limit=1000`,
      { headers: sbHeaders(SUPABASE_KEY) },
      { errSlice: 300 }
    );
    if (!Array.isArray(albums)) {
      return json(500, { error: 'albums取得結果が配列ではありません' });
    }

    // ── 対象抽出（purchase_url なしは対象外・記録もしない） ──
    const targets = [];  // { album, handle }
    const skipped = [];  // { id, reason }
    for (const album of albums) {
      const url = album.purchase_url;
      if (!url) continue;
      if (!url.includes(SUPPORTED_STORE)) {
        // 将来ストア追加の目印
        skipped.push({ id: album.id, reason: 'unsupported_domain' });
        continue;
      }
      const m = HANDLE_RE.exec(url);
      if (!m) {
        skipped.push({ id: album.id, reason: 'handle_extract_failed' });
        continue;
      }
      targets.push({ album, handle: m[1] });
    }

    // ── 逐次スキャン（並列にしない + 300ms待機 = ストアへの礼儀） ──
    const changed = [];  // { id, name, from, to }
    let scanned = 0;     // product.js のfetchを試行した件数
    const today = new Date().toISOString().slice(0, 10); // status_updated_at（YYYY-MM-DD）

    for (let i = 0; i < targets.length; i++) {
      const { album, handle } = targets[i];
      if (i > 0) await sleep(POLITE_WAIT_MS);
      scanned++;

      // (1) Shopify product.js fetch — 失敗系はすべて skip（is_sold_out に触らない）
      let res;
      try {
        res = await fetch(`https://findmestore.thinkr.jp/products/${handle}.js`, {
          headers: {
            'User-Agent': 'vwp-archive-stock-scan/1.0 (+https://vwp-archive.netlify.app)',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
      } catch (e) {
        const detail = (e && e.name === 'TimeoutError') ? 'timeout' : String(e && e.message).slice(0, 100);
        skipped.push({ id: album.id, reason: `fetch_error: ${detail}` });
        continue;
      }
      if (!res.ok) {
        // 404 = ページ消滅の可能性。売り切れ扱いにせず skip（人間が purchase_url を見直す）
        skipped.push({ id: album.id, reason: `http_${res.status}` });
        continue;
      }
      let product;
      try {
        product = await res.json();
      } catch {
        skipped.push({ id: album.id, reason: 'invalid_json' });
        continue;
      }
      // available が boolean 以外（メンテページ等の想定外JSON）は判定不能として skip
      if (!product || typeof product.available !== 'boolean') {
        skipped.push({ id: album.id, reason: 'available_not_boolean' });
        continue;
      }

      // (2) 判定・差分がある場合のみ更新
      const newSoldOut = !product.available;
      if (newSoldOut === album.is_sold_out) continue; // 変化なし

      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/albums?id=eq.${album.id}`, {
        method: 'PATCH',
        headers: sbHeaders(SUPABASE_KEY, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({ is_sold_out: newSoldOut, status_updated_at: today }),
      });
      if (!patchRes.ok) {
        const text = await patchRes.text().catch(() => '');
        console.error(`albums-stock-scan: PATCH失敗 id=${album.id}: ${patchRes.status} ${text.slice(0, 200)}`);
        skipped.push({ id: album.id, reason: `patch_failed_${patchRes.status}` });
        continue;
      }
      changed.push({ id: album.id, name: album.name, from: album.is_sold_out, to: newSoldOut });
    }

    return json(200, { ok: true, scanned, changed, skipped });
  } catch (e) {
    console.error('albums-stock-scan fatal error:', e);
    return json(500, { error: e.message });
  }
};
