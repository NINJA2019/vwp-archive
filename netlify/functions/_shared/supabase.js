// netlify/functions/_shared/supabase.js
// Supabase接続の共通ヘルパー（内部実装の重複排除のみ。外部挙動は1バイトも変えない）
// キー選択は現行の3変種を意図的に分離して維持する（統一しない — B3計画§3）
// 注意: env欠落チェックは共通化しない（有→有、無→無の現状維持。各Function側の責務）

/** SUPABASE_URL */
function getSupabaseUrl() {
  return process.env.SUPABASE_URL;
}

/** 変種A: 書き込み系（admin CRUD / admin-query / ingest 等）が使う secret key */
function secretKey() {
  return process.env.SUPABASE_SECRET_KEY;
}

/** 変種B: 公開read系（albums-get / videos-get）。ANON優先、未設定ならSECRETにフォールバック */
function readKey() {
  return process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY;
}

/** 変種C: Observer-Link系（exchange / result）。SERVICE_ROLE優先、未設定ならSECRETにフォールバック */
function serviceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
}

/** PostgREST用ヘッダ。extra で Content-Type / Prefer 等の現行の揺れをそのまま維持する */
function sbHeaders(key, extra = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

/**
 * Supabase fetch ラッパー（非OK時はthrow）。
 * errSlice: エラーテキストの切り詰め長（exchange=200 / ingest=300 の現行差をパラメタ化して維持）
 */
async function sbFetch(url, options, { errSlice = 200 } = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${text.slice(0, errSlice)}`);
  }
  return res.json();
}

/**
 * PostgREST 全件fetch（憲法5: 1,000件ずつ offset を進めるページングループ）+ 上限到達ガード。
 *
 * 背景: PostgREST の Max Rows 設定が1リクエストを1,000行にキャップするため、
 * `limit=10000` や `.range(0,9999)` 等の単発指定では silent に1,000行へ切り詰められる
 * （service role keyでも同じ）。テーブルが1,000件を超えた環境では単発fetchだと
 * 先頭1,000行しか返らず、dedup用途では1,001行目以降を見逃して重複pendingを取り込む
 * （＝憲法2違反の温床）。よって videos-get.js と同じ `limit=1000&offset=N` 方式で
 * ページングし、戻りが1,000件未満になるまで繰り返す。
 *
 * order明示（必須）: offsetページングは各ページ間で安定した全順序を前提とする。
 * 無指定だと PostgREST の返す順は実装依存でページ間の行重複/欠落が起き得るため、
 * 呼び出し側は path に `order=id.asc`（id は単調増加PK・全順序安定）等を含めること。
 *
 * overflow: MAX_ROWS(=50,000行=50ページ)に達したら overflow=true で打ち切る。
 *   無限ループ防止に加え、呼び出し側3系統（ingest / playlist-import / admin-query）の
 *   既存 overflow ガード（突合不完全時に取り込みを中止する安全弁）を活かすため。
 *   従来 overflow は「10,000到達」を意味したが、ページングで全件取れるため
 *   「50,000到達＝異常膨張/クエリ暴走」の意味に再定義した。本番videosは現状数千件規模で
 *   1桁以上の余裕がある一方、想定外のテーブル膨張時に無限ページングへ落ちない現実的な天井。
 *
 * throwOnHttpError=true: 非OK時にthrow（ingest-youtubeの現行挙動。sbFetch経由）。
 * false: 現行どおり res.ok 未チェックで res.json()（playlist-import / admin-queryの現行挙動）。
 *   非配列レスポンス（PostgRESTエラーJSON等）が返った場合は従来どおりそのまま rows として返し、
 *   overflow=false / count=0 とする（各Functionの既存の非配列ハンドリングを不変に保つ）。
 *
 * 戻り値 { rows, overflow, count } は不変。
 */
const MAX_ROWS = 50000; // 安全上限: 50ページ（1,000件×50）。上記コメント参照

/**
 * 汎用ページングfetch。path は '<table>?select=...&<filter>&order=...' のクエリ文字列
 * （先頭の '/rest/v1/' は付けない）。limit/offset は本関数が付与する。
 */
async function fetchAllRows(supaUrl, key, path, { throwOnHttpError = false, errSlice = 200 } = {}) {
  const PAGE_SIZE = 1000; // PostgREST Max Rows キャップと同値。これ未満の戻り=最終ページ
  const sep = path.includes('?') ? '&' : '?';
  const all = [];
  let offset = 0;
  let overflow = false;
  while (true) {
    const url = `${supaUrl}/rest/v1/${path}${sep}limit=${PAGE_SIZE}&offset=${offset}`;
    const page = throwOnHttpError
      ? await sbFetch(url, { headers: sbHeaders(key) }, { errSlice })
      : await (await fetch(url, { headers: sbHeaders(key) })).json();
    // 非配列（PostgRESTエラーJSON等）: 従来挙動を維持し、そのまま rows として返す
    if (!Array.isArray(page)) {
      return { rows: page, overflow: false, count: 0 };
    }
    for (const r of page) all.push(r);
    // 戻りがPAGE_SIZE未満なら最終ページ
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    // 安全上限到達: これ以上ページングせず overflow で打ち切る（呼び出し側の中止ガードに委ねる）
    if (offset >= MAX_ROWS) { overflow = true; break; }
  }
  return { rows: all, overflow, count: all.length };
}

/**
 * videos全件fetch（fetchAllRows への薄いラッパ。select だけ渡せば済む videos 専用の便利版）。
 * order=id.asc をここで明示付与し、dedup用全件fetchのページ間全順序を保証する。
 */
async function fetchAllVideoRows(supaUrl, key, select, { throwOnHttpError = false, errSlice = 200 } = {}) {
  return fetchAllRows(supaUrl, key, `videos?select=${select}&order=id.asc`, { throwOnHttpError, errSlice });
}

module.exports = { getSupabaseUrl, secretKey, readKey, serviceKey, sbHeaders, sbFetch, fetchAllRows, fetchAllVideoRows };
