// route.js — ハッシュルーティング（SPA用、シンプル実装）
// window露出しない（憲法8。拡張が監視するキーを追加しない）。
// history API には replaceState のみ使用（pushState しない = 戻るボタンで混乱させない）。
// overlay や modal はハッシュを書かない（base-screen 切替のみ）。

// 許可するメンバーキー（constants.js の MEMBERS に合わせる）
const VALID_MEMBERS = new Set(['all','vwp','kafu','rime','harusar','isekai','koko']);

/**
 * location.hash を解析し、ルート情報を返す。
 * @returns {{ matched: boolean, path: string, member: string|null }}
 *   matched  - #/archive または #/archive/<member> にマッチした場合 true
 *   path     - '/archive/all' 等（matched=true の場合）
 *   member   - 'all'|'kafu'|... （matched=true の場合）
 */
export function parseHash(){
  try {
    const hash = location.hash; // 例: '#/archive' '#/archive/kafu' ''
    if(!hash) return { matched: false, path: null, member: null };
    // '#/archive' または '#/archive/<member>'
    const m = hash.match(/^#\/archive(?:\/([a-z]+))?$/);
    if(!m) return { matched: false, path: null, member: null };
    const raw = m[1] || 'all';
    const member = VALID_MEMBERS.has(raw) ? raw : 'all';
    const path = '/archive/' + member;
    return { matched: true, path, member };
  } catch(e){
    return { matched: false, path: null, member: null };
  }
}

/**
 * ベース画面のハッシュを書く。location.search（utm等）は保持。
 * 同じ値なら replaceState しない（GA4 ノイズ防止）。
 * @param {string} path - '/archive/all' 等
 */
export function writeHash(path){
  try {
    if(!path) return;
    // /archive/all → #/archive/all
    const newHash = '#' + path;
    // 現在と同じなら書かない
    if(location.hash === newHash) return;
    // location.search を保持したまま hash だけ置換
    history.replaceState(null, '', location.pathname + location.search + newHash);
  } catch(e){}
}
