// onboarding.js — 軽量オンボーディング（店主メモ + NEWドット）
// トーンはレコード店の「店の掲示・手書きメモ」。チュートリアルUIにしない。
// localStorage は新キーのみ使用（憲法3: vwp_shelf / vwp_received 等の既存キーには触れない）:
//   - vwp_memo_ver  : 表示済み店主メモのバージョン（数値の文字列）
//   - vwp_seen_feat : 既読feature idのJSON配列（NEWドット用）

import { t } from './i18n.js';

// ── 店主メモ ──────────────────────────────────────────────
// 現行メモのバージョン。メモの内容を書き換えたらこの数値を +1 すること。
// 保存済みバージョン（vwp_memo_ver）>= MEMO_VERSION なら表示しないため、
// 番号を上げるだけで既読ユーザーにも新しいメモが再度1回だけ表示される。
export const MEMO_VERSION = 1;
const MEMO_SK = 'vwp_memo_ver';
const MEMO_DELAY_MS = 1000; // 入店（メイン画面表示）から表示までの間

// ── NEWドット ────────────────────────────────────────────
// 定数駆動: 新機能UIの脇に小さな光点を付け、対象要素を操作したら既読化する。
// 新しい対象を増やすときはここに {id, selector, event} を1行足すだけ。
export const FEATURE_DOTS = [
  { id: 'category', selector: '#contentTypeFilters', event: 'click' },
];
const SEEN_FEAT_SK = 'vwp_seen_feat';

function getSeenFeats(){
  try{
    const a = JSON.parse(localStorage.getItem(SEEN_FEAT_SK) || '[]');
    return Array.isArray(a) ? a : [];
  }catch(_){ return []; }
}

function markFeatSeen(id){
  const a = getSeenFeats();
  if(!a.includes(id)) a.push(id);
  try{ localStorage.setItem(SEEN_FEAT_SK, JSON.stringify(a)); }catch(_){}
}

// ═══ 店主メモ（1回だけ表示のWhat's Newカード） ═══════════════

function memoAlreadySeen(){
  const v = parseInt(localStorage.getItem(MEMO_SK) || '0', 10);
  return Number.isFinite(v) && v >= MEMO_VERSION;
}

function showOwnerMemo(){
  if(memoAlreadySeen()) return;
  if(document.getElementById('onbMemo')) return;

  const card = document.createElement('div');
  card.className = 'onb-memo';
  card.id = 'onbMemo';
  card.setAttribute('role', 'note');

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'onb-memo-close';
  close.textContent = '×';
  close.setAttribute('aria-label', t('onbMemoClose'));

  const title = document.createElement('div');
  title.className = 'onb-memo-title';
  title.textContent = t('onbMemoTitle');

  const line1 = document.createElement('p');
  line1.className = 'onb-memo-line';
  line1.textContent = t('onbMemoBody1');

  const line2 = document.createElement('p');
  line2.className = 'onb-memo-line';
  line2.textContent = t('onbMemoBody2');

  close.addEventListener('click', () => {
    // ×で閉じた時点で既読化（次回以降は MEMO_VERSION を上げない限り出ない）
    try{ localStorage.setItem(MEMO_SK, String(MEMO_VERSION)); }catch(_){}
    card.classList.remove('onb-show');
    setTimeout(() => card.remove(), 450);
  });

  card.appendChild(close);
  card.appendChild(title);
  card.appendChild(line1);
  card.appendChild(line2);
  document.body.appendChild(card);

  // 2フレーム待ってからクラス付与 → CSS transitionでフェードイン
  requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('onb-show')));
}

// ═══ NEWドット ═══════════════════════════════════════════

const _wiredDots = new Set(); // 既読化リスナー登録済みのfeature id（多重登録防止）

// buildSidebar() の末尾から毎回呼ばれる想定（再描画でドットが消えても再適用される）。
// ドット自体は innerHTML='' でリセットされる対象要素の中ではなく、
// 外側の枠（.sb-sec）に絶対配置で置くため、通常の再描画では消えない。
export function applyFeatureDots(){
  const seen = getSeenFeats();
  FEATURE_DOTS.forEach(f => {
    if(seen.includes(f.id)) return;
    const target = document.querySelector(f.selector);
    if(!target) return;
    const host = target.closest('.sb-sec') || target.parentElement;
    if(!host) return;

    if(!host.querySelector(`.onb-dot[data-feat="${f.id}"]`)){
      if(getComputedStyle(host).position === 'static') host.style.position = 'relative';
      const dot = document.createElement('span');
      dot.className = 'onb-dot';
      dot.dataset.feat = f.id;
      dot.setAttribute('aria-hidden', 'true');
      host.appendChild(dot);
    }

    // 対象要素（#contentTypeFilters 等）はbuildSidebarで中身だけ差し替わり
    // 要素自体は残るため、リスナーは1回だけ登録すればよい
    if(!_wiredDots.has(f.id)){
      _wiredDots.add(f.id);
      target.addEventListener(f.event, () => {
        markFeatSeen(f.id);
        document.querySelectorAll(`.onb-dot[data-feat="${f.id}"]`).forEach(d => d.remove());
      }, { once: true });
    }
  });
}

// ═══ 初期化 ═══════════════════════════════════════════════

export function initOnboarding(){
  // intro.js の enterArchive() が入店確定時に dispatch するイベントを購読
  // （メイン画面が見えてから MEMO_DELAY_MS 後にメモをフェードイン）
  document.addEventListener('vwp:archive-entered', () => {
    setTimeout(showOwnerMemo, MEMO_DELAY_MS);
  }, { once: true });
}
