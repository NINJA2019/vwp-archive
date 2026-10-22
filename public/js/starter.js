// starter.js — スターターリストオーバーレイ（PR feat/starter-list）
// shelf.js / observer-link.js のモジュールパターン踏襲
// 公開: initStarter() のみ。windowへの新キー露出なし（憲法8）。

import { getVideos, thumb, esc, safeUrl, trackSongClick } from './core.js';
import { t, mbr } from './i18n.js';
import { trackScreen, trackScreenRestore } from './pageview.js';
import { renderFanSelect } from './setlist.js';

// ── 内部状態 ────────────────────────────────────────────
var _initialized = false;

// ── ヘルパー ────────────────────────────────────────────
function getStarterVideos() {
  return getVideos()
    .filter(function(v) { return v.is_starter; })
    .sort(function(a, b) {
      var oa = (a.starter_order != null ? a.starter_order : 9999);
      var ob = (b.starter_order != null ? b.starter_order : 9999);
      if (oa !== ob) return oa - ob;
      return a.id - b.id;
    });
}

function memberCls(member) {
  var known = ['kafu','rime','harusar','isekai','koko','vwp','all'];
  return known.indexOf(member) !== -1 ? 'starter-member-' + member : 'starter-member-all';
}

// ── オーバーレイ描画 ─────────────────────────────────────
function buildStarterList() {
  var body = document.getElementById('starter-list-body');
  if (!body) return;

  var videos = getStarterVideos();

  if (videos.length === 0) {
    body.innerHTML = '<p class="starter-empty">' + esc(t('starterEmpty')) + '</p>';
    renderFanSelect(body); // 店主セレクトが空でもファン・セレクトは出す
    return;
  }

  var items = videos.map(function(v, i) {
    var num = String(i + 1).padStart(2, '0');
    var thumbUrl = thumb(v);
    var thumbImg = thumbUrl
      ? '<img class="starter-thumb" src="' + esc(thumbUrl) + '" alt="" loading="lazy" decoding="async">'
      : '<div class="starter-thumb" style="background:rgba(255,255,255,.06)"></div>';
    var noteHtml = v.starter_note
      ? '<div class="starter-note">' + esc(v.starter_note) + '</div>'
      : '';
    var memberSlug = v.member || 'all';
    return (
      '<li class="starter-item" data-id="' + v.id + '" data-url="' + esc(safeUrl(v.url)) + '">' +
        '<span class="starter-num">' + num + '</span>' +
        thumbImg +
        '<div class="starter-info">' +
          '<div class="starter-title">' + esc(v.title || '—') + '</div>' +
          '<div class="starter-member ' + memberCls(memberSlug) + '">' + esc(mbr(memberSlug)) + '</div>' +
          noteHtml +
        '</div>' +
      '</li>'
    );
  }).join('');

  body.innerHTML = '<ul class="starter-list">' + items + '</ul>';

  // クリックイベント（trackSongClick = GA4 + YouTube新タブ）
  // safeUrl が '#' を返す場合（URL不正）はデッドタブを開かないためガード
  body.querySelectorAll('.starter-item').forEach(function(el) {
    el.addEventListener('click', function() {
      var id = parseInt(el.getAttribute('data-id'), 10);
      var url = el.getAttribute('data-url');
      if (!url || url === '#') return;
      trackSongClick(id, url);
    });
  });

  // ファン・セレクト（店主セレクトの下に併記。非同期に埋まる）
  renderFanSelect(body);
}

// ── open/close ───────────────────────────────────────────
function openStarter() {
  var screen = document.getElementById('starter-list-screen');
  if (!screen) return;
  buildStarterList();
  screen.style.display = '';
  document.body.style.overflow = 'hidden';
  trackScreen('/starter','Starter List | VWP Archive',{overlay:true});
}

function closeStarter() {
  var screen = document.getElementById('starter-list-screen');
  if (screen) screen.style.display = 'none';
  document.body.style.overflow = '';
  trackScreenRestore();
}

// ── initStarter ───────────────────────────────────────────
export function initStarter() {
  if (_initialized) return;
  _initialized = true;

  // sidebar open button
  var openBtn = document.getElementById('starterListBtn');
  if (openBtn) {
    openBtn.addEventListener('click', openStarter);
  }

  // close button (inside overlay)
  var closeBtn = document.querySelector('.starter-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeStarter);
  }

  // backdrop click to close
  var screen = document.getElementById('starter-list-screen');
  if (screen) {
    screen.addEventListener('click', function(e) {
      if (e.target === screen) closeStarter();
    });
  }

  // Esc key to close
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var sl = document.getElementById('setlist-overlay');
      if (sl && sl.style.display !== 'none') return; // setlist が上に開いているときは setlist.js が処理
      var s = document.getElementById('starter-list-screen');
      if (s && s.style.display !== 'none') closeStarter();
    }
  });
}
