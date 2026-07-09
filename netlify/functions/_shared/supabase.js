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
 * videos全件fetch（憲法5: limit=10000&offset=0 明示）+ 上限到達ガード。
 * 10000到達時はthrowせず overflow フラグで返す — 500 bodyの文言は各Functionが現行のまま組み立てる
 * （ingest / playlist-import / admin-query で文言が異なるため）。
 * throwOnHttpError=true: 非OK時にthrow（ingest-youtubeの現行挙動）。
 * false: 現行どおり res.ok 未チェックで res.json()（playlist-import / admin-queryの現行挙動）。
 */
async function fetchAllVideoRows(supaUrl, key, select, { throwOnHttpError = false, errSlice = 200 } = {}) {
  const url = `${supaUrl}/rest/v1/videos?select=${select}&limit=10000&offset=0`;
  const rows = throwOnHttpError
    ? await sbFetch(url, { headers: sbHeaders(key) }, { errSlice })
    : await (await fetch(url, { headers: sbHeaders(key) })).json();
  const isArray = Array.isArray(rows);
  return { rows, overflow: isArray && rows.length >= 10000, count: isArray ? rows.length : 0 };
}

module.exports = { getSupabaseUrl, secretKey, readKey, serviceKey, sbHeaders, sbFetch, fetchAllVideoRows };
