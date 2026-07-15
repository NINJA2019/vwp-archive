// main.js — ES Module エントリポイント（PR-B2a / v1.8.0）
// import順: constants → i18n/supabase/vinyl → core → shelf → observer-link → intro → mobile
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

// ── Intro / Mobile ────────────────────────────────────────────
import { initIntro } from './intro.js';
import { initMobile } from './mobile.js';

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
document.addEventListener('DOMContentLoaded', () => {
  initCore();           // DOM イベント登録・検索・ビュー切替等
  initShelf();          // 棚オーバーレイ初期化
  olInit();             // Observer-Link 初期化（deep-link解析含む）
  initMobile();         // モバイルS字UI（window幅>700pxなら即return）
  initIntro();          // ターンテーブルイントロ（モバイル時はinitMobileが先に制御を取る）
  bootstrapApp();       // データfetch → render → PW自動ログイン
});
