// main.js — ES Module エントリポイント（PR-B2a / v1.8.0、feat/starter-list v1.9.4）
// import順: constants → i18n/supabase/vinyl → pageview → core → shelf → starter → observer-link → intro → mobile
// window露出テーブル: A=明示24件 / B=インラインハンドラ11件 / C=要確認55件（_searchGa4Timer除く）

// ── Leaf modules ──────────────────────────────────────────────
import {
  I18N, MEMBERS, MBR_CLS, PAGE_SIZE, CARD_ANIM_DELAY_STEP,
  PW_SK, THEME_SK, DAILY_MEMBERS, DAILY_SK,
} from './constants.js';
import {
  getLang, setLang, t, mbr, applyI18n, tTag,
} from './i18n.js';
import {
  getMemberColor, drawVinylDisc, MEMBER_COLORS,
} from './vinyl.js';

// ── Core ──────────────────────────────────────────────────────
import {
  // state getters / setters
  getVideos, setVideos,
  getSelectedMembers, setSelectedMembers_state,
  getCurMember, setCurMember,
  getCurTag, setCurTag,
  getCurSort, setCurSort,
  getCurAlbum, setCurAlbum,
  getCurContentType, setCurContentType,
  getSearchQ, setSearchQ,
  getIsAdmin,
  getFilteredCache,
  getAlbums,
  getInputTags, setInputTags,
  getEditId, setEditId,
  invalidateVideosCache, invalidateAlbumsCache,
  // utilities
  openPage, closePage, showFetchError,
  _gtag, trackSongClick, trackExternalLink,
  getStoredPw, storePw,
  loadAlbums, loadVideos,
  addAlbumApiFn, updateAlbumApiFn, deleteAlbumApiFn, albumThumb,
  addVideoApiFn, deleteVideoApiFn, updateVideoApiFn,
  ytId, thumb, fmtDate, parseTags, parseMembers,
  esc, safeUrl, tagPills, mbPill, spotifyBtn,
  seededRand, getTodayJST, getDailyPicks, getDailyPicksFromCache,
  filtered, allTagsOf, updateCounts, buildSidebar, buildMobFilters,
  del, edit, showMb,
  setupObserver, loadMoreItems, updateNewBadgeIds, render,
  renderTagSuggest, renderTagChips, addInputTag, removeInputTag,
  buildMemberSelect, refreshAlbumSelects, refreshImportAlbumSelect,
  getSelectedMembersForm, setSelectedMembersForm,
  openLinkSongModal, linkSong, unlinkSong,
  openEditAlbumModal, openAlbumModal,
  setAdminMode, verifyPw,
  initCore, bootstrapApp,
} from './core.js';

// ── Shelf ─────────────────────────────────────────────────────
import {
  getShelf, isOnShelf, addToShelf, removeFromShelf,
  updateShelfNavCnt, buildShelfUI,
  shelfOpenPanel, openShelf, toggleShelfPin, shelfPinHtml,
  buildReceivedShelfUI, shelfRcvTap,
  initShelf,
} from './shelf.js';

// ── Observer-Link ─────────────────────────────────────────────
import {
  olInit, olOpen, olClose,
  olClickYoutube, olShareResult,
  openShareDialog, closeShareDialog,
  olShareToDiscord, olCopyShareUrl, olTrackXShare,
  olResetCompose, olQuickSendHtml, olQuickSend,
} from './observer-link.js';

// ── Starter List ──────────────────────────────────────────────
import { initStarter } from './starter.js';

// ── Setlist / Fan Select（window露出しない） ──────────────────
import { initSetlist } from './setlist.js';

// ── Intro / Mobile ────────────────────────────────────────────
import { initIntro } from './intro.js';
import { initMobile } from './mobile.js';

// ── Onboarding（店主メモ + NEWドット） ─────────────────────────
import { initOnboarding } from './onboarding.js';

// ── Event Ticker（ライブ告知ティッカー） ─────────────────────
import { initEventTicker } from './events.js';

// ── GA4 仮想 page_view（window露出しない） ───────────────────
import { trackScreen } from './pageview.js';

// ── ハッシュルーティング（window露出しない） ──────────────────
import { parseHash, writeHash } from './route.js';

// ═══════════════════════════════════════════════════════════════
// window露出テーブル（A + B + C の計90件）
// _rcvSongs は shelf.js 内で実行時代入のため除外
// _searchGa4Timer は内部タイマーIDのため露出対象外（Yuki決定 Q3）
// ═══════════════════════════════════════════════════════════════
Object.assign(window, {

  // ── A. 明示24件（旧 app.js の window.xxx= 群） ──────────────
  // A-shelf (12件)
  shelfOpenPanel,   // [A] shelf詳細パネル開く
  openShelf,        // [A] 棚オーバーレイ開く
  toggleShelfPin,   // [A] カード上ピンボタン
  shelfPinHtml,     // [A] HTML生成（カードテンプレ）
  // _rcvSongs は shelf.js 内 buildReceivedShelfUI() で代入維持
  shelfRcvTap,      // [A] 受信レコードタップ
  getMemberColor,   // [A] メンバーカラー取得（vinyl.js由来）
  drawVinylDisc,    // [A] LP Canvas描画（vinyl.js由来）
  addToShelf,       // [A] 棚に追加
  removeFromShelf,  // [A] 棚から削除
  isOnShelf,        // [A] 棚在否
  getShelf,         // [A] 棚ID配列取得

  // A-OL (12件)
  openObserverLink: olOpen,  // [A] OL画面を開く
  olClose,          // [A] OL画面を閉じる
  olClickYoutube,   // [A] OL結果画面からYouTubeへ
  olShareResult,    // [A] OL共有
  openShareDialog,  // [A] 共有ダイアログを開く
  closeShareDialog, // [A] 共有ダイアログを閉じる
  olShareToDiscord, // [A] Discord共有
  olCopyShareUrl,   // [A] URLコピー
  olTrackXShare,    // [A] X(Twitter)共有GA4
  olResetCompose,   // [A] OL compose画面リセット
  olQuickSendHtml,  // [A] HTML生成（カードテンプレ）
  olQuickSend,      // [A] クイック送信

  // ── B. インラインハンドラ11件（index.html / 生成HTML の onclick） ──
  openPage,         // [B] index.html:200 onclick
  closePage,        // [B] index.html:371 onclick
  trackSongClick,   // [B] カードテンプレ生成HTML
  trackExternalLink,// [B] spotifyBtn() 生成HTML
  edit,             // [B] カードテンプレ（admin時）
  del,              // [B] カードテンプレ（admin時）
  addInputTag,      // [B] タグ入力chip
  renderTagSuggest, // [B] タグサジェスト
  removeInputTag,   // [B] タグchip削除
  linkSong,         // [B] 既存曲紐付けモーダル
  unlinkSong,       // [B] 紐付け解除モーダル

  // ── C. 要確認55件（Chrome拡張 Object.defineProperty 監視候補） ──
  t,                   // [C]
  mbr,                 // [C]
  applyI18n,           // [C]
  showFetchError,      // [C]
  _gtag,               // [C]
  getStoredPw,         // [C]
  storePw,             // [C]
  loadAlbums,          // [C]
  addAlbumApi: addAlbumApiFn,    // [C] DI wrapper
  updateAlbumApi: updateAlbumApiFn, // [C] DI wrapper
  deleteAlbumApi: deleteAlbumApiFn, // [C] DI wrapper
  albumThumb,          // [C]
  loadVideos,          // [C]
  addVideoApi: addVideoApiFn,    // [C] DI wrapper
  deleteVideoApi: deleteVideoApiFn, // [C] DI wrapper
  updateVideoApi: updateVideoApiFn, // [C] DI wrapper
  ytId,                // [C]
  thumb,               // [C]
  fmtDate,             // [C]
  parseTags,           // [C]
  parseMembers,        // [C]
  tTag,                // [C]
  esc,                 // [C]
  safeUrl,             // [C]
  tagPills,            // [C]
  mbPill,              // [C]
  spotifyBtn,          // [C]
  seededRand,          // [C]
  getTodayJST,         // [C]
  getDailyPicks,       // [C]
  getDailyPicksFromCache, // [C]
  filtered,            // [C]
  allTagsOf,           // [C]
  updateCounts,        // [C]
  buildSidebar,        // [C]
  buildMobFilters,     // [C]
  showMb,              // [C]
  // renderGrid / renderList / renderTimeline はB1で削除済み。
  // 現行mainのwindowに存在しないキーのためObject.assignで追加しない（憲法8: 拡張のdefinePropertyを誤発火させない）
  setupObserver,       // [C]
  loadMoreItems,       // [C]
  updateNewBadgeIds,   // [C]
  render,              // [C]
  renderTagChips,      // [C]
  buildMemberSelect,   // [C]
  refreshAlbumSelects, // [C]
  refreshImportAlbumSelect, // [C]
  getSelectedMembers: getSelectedMembersForm, // [C] フォームUI用（旧名: getSelectedMembers）
  setSelectedMembers: setSelectedMembersForm, // [C] フォームUI用（旧名: setSelectedMembers）
  openLinkSongModal,   // [C]
  openEditAlbumModal,  // [C]
  openAlbumModal,      // [C]
  setAdminMode,        // [C]
  verifyPw,            // [C]
});

// ═══════════════════════════════════════════════════════════════
// 起動シーケンス（旧 DOMContentLoaded ブロック相当）
// 順序固定: core → shelf → observer-link → intro/mobile → bootstrap
// ═══════════════════════════════════════════════════════════════

/**
 * ブート判定。
 * hash deep link / ol_result / vwp_intro_seen / viewport から
 * 「イントロをスキップするか」と「初期メンバーフィルタ」を決定する。
 * ※ skip は desktop のみ適用。モバイルは常に通常フロー（mobWelcome はそのまま）。
 * Returns: { skipIntro: boolean, initialMember: string|null }
 */
function decideBoot(){
  const isMobile = window.innerWidth <= 700;
  const hashRoute = parseHash(); // #/archive or #/archive/<member>
  const hasOlResult = new URLSearchParams(location.search).has('ol_result');
  let introSeen = false;
  try { introSeen = localStorage.getItem('vwp_intro_seen') === '1'; } catch(e){}

  // hash deep link または ol_result → スキップ（モバイルでも適用）
  if(hashRoute.matched || hasOlResult){
    return { skipIntro: true, initialMember: hashRoute.matched ? hashRoute.member : null };
  }
  // 再訪者（intro_seen）→ デスクトップのみスキップ（モバイルは mobWelcome が常に出る）
  if(introSeen && !isMobile){
    return { skipIntro: true, initialMember: null };
  }
  return { skipIntro: false, initialMember: null };
}

document.addEventListener('DOMContentLoaded', () => {
  const boot = decideBoot();
  const isMobile = window.innerWidth <= 700;

  // ── 初回 page_view: olInit より前に送る（base/overlay 順序を保証）──
  // skip: desktop のみ archive 画面へ着地。mobile は常に通常フロー。
  if(boot.skipIntro && !isMobile){
    // デスクトップ skip: メンバーフィルタを先に適用し、archive page_view を送る
    const m = boot.initialMember;
    if(m && m !== 'all'){
      setSelectedMembers_state([m]);
      setCurMember(m);
    } else {
      setSelectedMembers_state([]);
      setCurMember('all');
    }
    const archiveSegment = (m && m !== 'all') ? m : 'all';
    try {
      trackScreen('/archive/'+archiveSegment, 'Archive - '+archiveSegment+' | VWP Archive');
    } catch(e) {}
    try { writeHash('/archive/'+archiveSegment); } catch(e){}
  } else {
    // 通常フロー（デスクトップ初回 or モバイル全パターン）
    try {
      trackScreen(isMobile ? '/mobile/welcome' : '/intro',
                  isMobile ? 'Mobile Welcome | VWP Archive' : 'Intro | VWP Archive');
    } catch(e) {}
  }

  initCore();           // DOM イベント登録・検索・ビュー切替等
  initOnboarding();     // 店主メモ+NEWドット（intro入店イベント購読。initIntroより先に登録）
  initEventTicker();    // ライブ告知ティッカー（メイン画面恒常UI）
  initShelf();          // 棚オーバーレイ初期化
  initStarter();        // スターターリストオーバーレイ初期化
  initSetlist();        // セットリスト（ファン・セレクト）オーバーレイ初期化
  olInit();             // Observer-Link 初期化（deep-link解析含む）
  initMobile();         // モバイルS字UI（window幅>700pxなら即return）

  // ── デスクトップ Intro 制御 ──
  // skip は desktop のみ。mobile は initMobile が ttIntro を非表示にして mobWelcome を出す。
  if(boot.skipIntro && !isMobile){
    initIntro({ skip: true });
  } else {
    initIntro(); // デスクトップ Intro 初期化（モバイルでは ttIntro が hidden なので実質 no-op）
  }

  bootstrapApp();       // データfetch → render → PW自動ログイン
});
