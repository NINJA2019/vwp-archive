// pageview.js — GA4 仮想 page_view（SPA画面遷移用）
// 他モジュールを import しない（循環依存回避）。window への新キー露出なし（憲法8）。
// URL / history API には触らず page_location に仮想パスを乗せるだけ。
let basePath = null, baseTitle = null;   // 現在の「ベース画面」
let overlayOpen = false;
let lastPath = null, lastLocation = null; // 直前送信（連続重複抑止 / page_referrer 用）

// location.search から ol_result（deep link 用、replaceState で消される前でも送らない）を除外
function cleanSearch(){
  try {
    const sp = new URLSearchParams(location.search);
    sp.delete('ol_result');
    const q = sp.toString();
    return q ? '?' + q : '';
  } catch(e) { return ''; }
}

// path から screen_name を導出（先頭スラッシュを除いた最初のセグメント or パス全体）
function screenNameOf(path){
  try {
    const seg = path.replace(/^\//, '').split('/')[0];
    return seg || 'top';
  } catch(e) { return 'top'; }
}

function send(path, title){
  // document.title はgtag不在でも設定（adblock環境でも title ownership を維持）
  if(title) document.title = title;
  if(typeof window.gtag !== 'function') return;
  const page_location = location.origin + path + cleanSearch(); // utm等のクエリは保持、ol_result は除外
  const screen_name = screenNameOf(path);
  const params = { page_location, page_title: title, screen_name };
  if(lastLocation) params.page_referrer = lastLocation;
  window.gtag('set', { page_location, page_title: title }); // 以降の全イベントに仮想URLを付与
  window.gtag('event', 'page_view', params);
  lastPath = path; lastLocation = page_location;
}

// ベース画面（intro / archive / mobile 系）または overlay:true でオーバーレイ画面を記録
export function trackScreen(path, title, opts){
  const overlay = !!(opts && opts.overlay);
  if(overlay){
    overlayOpen = true;
  } else {
    basePath = path; baseTitle = title; overlayOpen = false;
    // タイトルは path dedup と無関係に常に同期
    if(title) document.title = title;
  }
  if(path === lastPath) return; // 同一画面の連続送信は抑止
  send(path, title);
}

// オーバーレイを閉じたときにベース画面を再送（滞在時間の帰属をベース画面に戻す）
export function trackScreenRestore(){
  if(!overlayOpen || !basePath) return;
  overlayOpen = false;
  if(basePath === lastPath) return;
  send(basePath, baseTitle);
}

// ベースタイトルのみ復元（page_view を送らない。OL compose リセット時など）
export function restoreBaseTitle(){
  if(baseTitle) document.title = baseTitle;
}
