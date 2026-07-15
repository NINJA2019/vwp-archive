// ═══════════════════════════════════════════════════════════════
// albums-stock-scan.js — アルバム在庫自動スキャンFunction
// 起動: GitHub Actions cron（1日1回 JST朝6:00）+ 手動curl
//       Authorization: Bearer <ADMIN_PASSWORD> 必須（POSTのみ）
// 対象: albums.purchase_url が FINDME STORE（findmestore.thinkr.jp = Shopify）の行。
//       `https://findmestore.thinkr.jp/products/<handle>.js` の JSON `available` を
//       is_sold_out へ同期する（newSoldOut = !available）。
// 安全側の原則: HTTPエラー・非JSON・available欠落・URL/ハンドル不正は該当行を
//       skipped に記録して is_sold_out には絶対に触らない（ページ消滅・一時障害で
//       誤って SALE に戻す事故防止）。更新は判定が確定し現状と異なる場合のみ。
// 時間予算: Netlify Functionsの10秒制限内に収めるため同時5件のバッチ並列 +
//       全体8秒デッドライン（超過分は skipped:deadline で部分結果応答 → 翌日cronが拾う）。
// ═══════════════════════════════════════════════════════════════

const { getSupabaseUrl, secretKey, sbHeaders, sbFetch } = require('./_shared/supabase');
const { methodNotAllowed, json } = require('./_shared/responses');

// 対応ストア（将来ストア追加時はここに分岐を足す。対象外は skipped:unsupported_domain）
const SUPPORTED_HOST = 'findmestore.thinkr.jp';
const SUPPORTED_PATH_PREFIX = '/products/';
// pathname からの商品ハンドル抽出（例: /products/kyoso → kyoso）
const HANDLE_RE = /\/products\/([^/?#]+)/;
const FETCH_TIMEOUT_MS = 5000;  // Shopify product.js の個別タイムアウト
const BATCH_SIZE = 5;           // 同時fetch数（ストアへの礼儀と時間予算のバランス）
const BATCH_WAIT_MS = 100;      // バッチ間の待機
const DEADLINE_MS = 8000;       // 全体デッドライン（Netlify 10秒制限に対する余裕）

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 1アルバムのスキャン: product.js fetch → 判定 → 差分があればPATCH。
 * 戻り値: { skip: reason } | { change: {id,name,from,to} } | {}（変化なし）
 * throwしない設計（失敗系はすべて skip として返す）。
 */
async function scanOne({ album, handle }, supabaseUrl, supabaseKey, today) {
  // (1) Shopify product.js fetch — 失敗系はすべて skip（is_sold_out に触らない）
  let res;
  try {
    res = await fetch(`https://${SUPPORTED_HOST}/products/${handle}.js`, {
      headers: {
        'User-Agent': 'vwp-archive-stock-scan/1.0 (+https://vwp-archive.netlify.app)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    const detail = (e && e.name === 'TimeoutError') ? 'timeout' : String(e && e.message).slice(0, 100);
    return { skip: `fetch_error: ${detail}` };
  }
  if (!res.ok) {
    // 404 = ページ消滅の可能性。売り切れ扱いにせず skip（人間が purchase_url を見直す）
    return { skip: `http_${res.status}` };
  }
  let product;
  try {
    product = await res.json();
  } catch {
    return { skip: 'invalid_json' };
  }
  // available が boolean 以外（メンテページ等の想定外JSON）は判定不能として skip
  if (!product || typeof product.available !== 'boolean') {
    return { skip: 'available_not_boolean' };
  }

  // (2) 判定・差分がある場合のみ更新
  const newSoldOut = !product.available;
  if (newSoldOut === album.is_sold_out) return {}; // 変化なし

  const patchRes = await fetch(`${supabaseUrl}/rest/v1/albums?id=eq.${album.id}`, {
    method: 'PATCH',
    headers: sbHeaders(supabaseKey, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ is_sold_out: newSoldOut, status_updated_at: today }),
  });
  if (!patchRes.ok) {
    const text = await patchRes.text().catch(() => '');
    console.error(`albums-stock-scan: PATCH失敗 id=${album.id}: ${patchRes.status} ${text.slice(0, 200)}`);
    return { skip: `patch_failed_${patchRes.status}` };
  }
  return { change: { id: album.id, name: album.name, from: album.is_sold_out, to: newSoldOut } };
}

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

  const startedAt = Date.now();

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
    // ドメイン判定は new URL() のパース結果で厳格に行う（部分文字列判定だと
    // https://evil.com/findmestore.thinkr.jp/products/x のようなURLを通してしまう）。
    const targets = [];  // { album, handle }
    const skipped = [];  // { id, reason }
    for (const album of albums) {
      const url = album.purchase_url;
      if (!url) continue;
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        skipped.push({ id: album.id, reason: 'invalid_url' });
        continue;
      }
      if (parsed.hostname !== SUPPORTED_HOST || !parsed.pathname.startsWith(SUPPORTED_PATH_PREFIX)) {
        // 将来ストア追加の目印
        skipped.push({ id: album.id, reason: 'unsupported_domain' });
        continue;
      }
      const m = HANDLE_RE.exec(parsed.pathname);
      if (!m) {
        skipped.push({ id: album.id, reason: 'handle_extract_failed' });
        continue;
      }
      targets.push({ album, handle: m[1] });
    }

    // ── バッチ並列スキャン（同時5件 + バッチ間100ms + 全体8秒デッドライン） ──
    const changed = [];  // { id, name, from, to }
    let scanned = 0;     // product.js のfetchを試行した件数
    const today = new Date().toISOString().slice(0, 10); // status_updated_at（YYYY-MM-DD）

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      // デッドライン超過: 残りはスキャンせず skipped:deadline で部分結果応答（翌日cronが拾う）
      if (Date.now() - startedAt >= DEADLINE_MS) {
        for (const t of targets.slice(i)) skipped.push({ id: t.album.id, reason: 'deadline' });
        break;
      }
      if (i > 0) await sleep(BATCH_WAIT_MS);
      const batch = targets.slice(i, i + BATCH_SIZE);
      const settled = await Promise.allSettled(
        batch.map((t) => scanOne(t, SUPABASE_URL, SUPABASE_KEY, today))
      );
      // 集計はバッチ内のtargets順（並列の完了順に依存しない安定した応答順）
      for (let j = 0; j < settled.length; j++) {
        scanned++;
        const s = settled[j];
        if (s.status !== 'fulfilled') {
          // scanOneはthrowしない設計だが、万一の想定外例外もis_sold_outに触らずskip
          skipped.push({ id: batch[j].album.id, reason: `scan_error: ${String(s.reason && s.reason.message).slice(0, 100)}` });
          continue;
        }
        if (s.value.skip) skipped.push({ id: batch[j].album.id, reason: s.value.skip });
        else if (s.value.change) changed.push(s.value.change);
      }
    }

    return json(200, { ok: true, scanned, changed, skipped, elapsed_ms: Date.now() - startedAt });
  } catch (e) {
    console.error('albums-stock-scan fatal error:', e);
    return json(500, { error: e.message });
  }
};
