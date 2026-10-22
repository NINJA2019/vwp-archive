// netlify/functions/_shared/setlist.js
// setlist-submit / setlist-rankings の共通定数・整形（Phase 1）
// 注意: 他の Function からは参照しない（セットリスト系の内部共有のみ）。

const SETLIST_MEMBERS = ['kafu', 'rime', 'harusar', 'isekai', 'koko', 'vwp'];
const SETLIST_SIZE = 3;
const MIN_SUBMITTERS = 10;   // 冷スタート閾値（メンバーごと）。未満のメンバーは top を隠す
const RANK_LIMIT = 50;       // RPC p_limit。6 × 50 = 300 行 < 1,000（憲法5）
const ALLOWED_ORIGIN = 'https://vwp-archive.netlify.app';

// result.js / status.js と同一の uuidRegex
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** migration 未適用（テーブル/関数なし）を PostgREST のエラー文から判定 */
function isMissingSchemaError(e) {
  const msg = String((e && e.message) || e || '');
  // 対象名入りに絞る（無関係な 404/does not exist を「未適用」と誤判定しない）
  return /relation "public\.setlists" does not exist|relation "setlists" does not exist|42P01[^]*setlists|42883[^]*setlist_rankings|PGRST202[^]*setlist_rankings|PGRST205[^]*setlists|Could not find the (table|function) '?public\.setlist/i.test(msg);
}

/**
 * RPC setlist_rankings の行配列 → メンバー別の整形。
 * 登録 0 のメンバーも submitters:0 で必ず返す。ready=false のメンバーは top を空にする。
 */
function shapeRankings(rows) {
  const members = {};
  for (const m of SETLIST_MEMBERS) {
    members[m] = { submitters: 0, ready: false, remaining: MIN_SUBMITTERS, top: [] };
  }
  if (!Array.isArray(rows)) return members;
  for (const r of rows) {
    const m = members[r.member];
    if (!m) continue;
    const subs = Number(r.submitters) || 0;
    if (subs > m.submitters) m.submitters = subs;
    // LEFT JOIN の NULL 行（published 曲 0 件のメンバー）は submitters だけ採用し top には入れない
    if (r.video_id == null || r.rank == null) continue;
    m.top.push({ video_id: Number(r.video_id), votes: Number(r.votes) || 0, rank: Number(r.rank) || 0 });
  }
  for (const m of SETLIST_MEMBERS) {
    const e = members[m];
    e.ready = e.submitters >= MIN_SUBMITTERS;
    e.remaining = e.ready ? 0 : MIN_SUBMITTERS - e.submitters;
    e.top.sort((a, b) => a.rank - b.rank);
    if (!e.ready) e.top = [];
  }
  return members;
}

module.exports = { SETLIST_MEMBERS, SETLIST_SIZE, MIN_SUBMITTERS, RANK_LIMIT, ALLOWED_ORIGIN, uuidRegex, isMissingSchemaError, shapeRankings };
