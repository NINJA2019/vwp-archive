// events.js — ライブ告知ティッカー用イベント管理
// 新しいイベントは EVENTS 配列に1件追加するだけ（DB/migration不要）。
// startAt <= now <= endAt の期間内のみ自動表示。
// localStorage キー: vwp_event_ticker（憲法3: 新キーのみ使用）

import { t } from './i18n.js';

// ── イベント定義 ─────────────────────────────────────────────
export const EVENTS = [
  {
    id: 'kwars2026-kawasaki-ciel-seito',
    title: 'KAMITSUBAKI WARS 2026 神椿川崎戦線 CIEL 1st ONE-MAN LIVE『晴途』',
    dateLabel: '2026.11.20 FRI',
    venue: "CLUB CITTA'（川崎）",
    timeLabel: 'OPEN 18:00 / START 19:00',
    url: 'https://kamitsubaki.jp/event/kamitsubaki-wars-2026-%E7%A5%9E%E6%A4%BF%E5%B7%9D%E5%B4%8E%E6%88%A6%E7%B7%9A-ciel-1st-one-man-live-%E3%80%8C%E6%99%B4%E9%80%94%E3%80%8D/',
    startAt: '2026-07-01T00:00:00+09:00',
    endAt:   '2026-11-20T23:59:59+09:00',
  },
];

const TICKER_SK = 'vwp_event_ticker';
const SPEED_PX_PER_SEC = 60; // px/秒（コンテンツ量に依らず一定速度）

// ── アクティブイベント取得 ─────────────────────────────────────
export function getActiveEvents(now = new Date()) {
  return EVENTS.filter(ev => {
    const s = new Date(ev.startAt);
    const e = new Date(ev.endAt);
    return s <= now && now <= e;
  });
}

// ── dismiss済みID読み取り ─────────────────────────────────────
function getDismissed() {
  try {
    const a = JSON.parse(localStorage.getItem(TICKER_SK) || '[]');
    return Array.isArray(a) ? a : [];
  } catch (_) { return []; }
}

// ── dismiss済みIDに追加 ───────────────────────────────────────
function addDismissed(ids) {
  const a = getDismissed();
  ids.forEach(id => { if (!a.includes(id)) a.push(id); });
  try { localStorage.setItem(TICKER_SK, JSON.stringify(a)); } catch (_) {}
}

// ── ティッカー初期化（idempotent） ────────────────────────────
let _tickerBuilt = false;

export function initEventTicker() {
  if (_tickerBuilt) return;

  const container = document.getElementById('eventTicker');
  if (!container) return;

  const active = getActiveEvents();
  const dismissed = getDismissed();
  const visible = active.filter(ev => !dismissed.includes(ev.id));

  // 表示すべきイベントがなければ hidden のまま（レイアウト影響ゼロ）
  if (visible.length === 0) return;

  _tickerBuilt = true;
  container.removeAttribute('hidden');

  // ── ラベルchip（sticky左端） ──────────────────────────────
  const label = document.createElement('div');
  label.className = 'ticker-label';

  const dot = document.createElement('span');
  dot.className = 'ticker-dot';
  dot.setAttribute('aria-hidden', 'true');

  const labelText = document.createElement('span');
  labelText.dataset.i18n = 'eventTickerLabel';
  labelText.textContent = t('eventTickerLabel');

  label.appendChild(dot);
  label.appendChild(labelText);

  // ── ×閉じボタン ──────────────────────────────────────────
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'ticker-close';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'close');

  closeBtn.addEventListener('click', () => {
    addDismissed(visible.map(ev => ev.id));
    container.style.transition = 'opacity .35s';
    container.style.opacity = '0';
    setTimeout(() => {
      container.setAttribute('hidden', '');
      container.style.opacity = '';
      container.style.transition = '';
    }, 380);
  });

  // ── スクロールトラック（2連複製でシームレスループ） ──────
  const track = document.createElement('div');
  track.className = 'ticker-track';

  // イベント1件分のHTML文字列を生成（2連分なので関数化）
  function buildEventFragment(ev) {
    const frag = document.createDocumentFragment();

    // タイトル
    const titleSpan = document.createElement('span');
    titleSpan.className = 'ticker-ev-title';
    titleSpan.textContent = ev.title;
    frag.appendChild(titleSpan);

    frag.appendChild(sep('／'));

    // 日付
    const dateSpan = document.createElement('span');
    dateSpan.className = 'ticker-ev-date';
    dateSpan.textContent = ev.dateLabel;
    frag.appendChild(dateSpan);

    frag.appendChild(sep('／'));

    // 会場
    const venueSpan = document.createElement('span');
    venueSpan.className = 'ticker-ev-venue';
    venueSpan.textContent = ev.venue;
    frag.appendChild(venueSpan);

    frag.appendChild(sep('／'));

    // 時間
    const timeSpan = document.createElement('span');
    timeSpan.className = 'ticker-ev-time';
    timeSpan.textContent = ev.timeLabel;
    frag.appendChild(timeSpan);

    frag.appendChild(sep('／'));

    // チケットリンク
    const link = document.createElement('a');
    link.href = ev.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'ticker-ev-link';
    const linkLabel = document.createElement('span');
    linkLabel.dataset.i18n = 'eventTickerTicket';
    linkLabel.textContent = t('eventTickerTicket');
    link.appendChild(linkLabel);
    const arrow = document.createElement('span');
    arrow.textContent = ' →';
    link.appendChild(arrow);
    frag.appendChild(link);

    return frag;
  }

  function sep(char) {
    const s = document.createElement('span');
    s.className = 'ticker-sep';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = ' ' + char + ' ';
    return s;
  }

  // イベント複数の場合は ◆ で区切る
  function buildAllEvents() {
    const frag = document.createDocumentFragment();
    visible.forEach((ev, i) => {
      if (i > 0) {
        const divider = document.createElement('span');
        divider.className = 'ticker-divider';
        divider.setAttribute('aria-hidden', 'true');
        divider.textContent = ' ◆ ';
        frag.appendChild(divider);
      }
      frag.appendChild(buildEventFragment(ev));
    });
    // 末尾スペーサー（次の複製との間）
    const spacer = document.createElement('span');
    spacer.className = 'ticker-spacer';
    spacer.setAttribute('aria-hidden', 'true');
    spacer.textContent = '  '; // U+2003 em-space ×2
    frag.appendChild(spacer);
    return frag;
  }

  // 1セット目
  const set1 = document.createElement('span');
  set1.className = 'ticker-set';
  set1.appendChild(buildAllEvents());

  // 2セット目（seamless loop用の複製）
  const set2 = document.createElement('span');
  set2.className = 'ticker-set';
  set2.setAttribute('aria-hidden', 'true');
  set2.appendChild(buildAllEvents());

  track.appendChild(set1);
  track.appendChild(set2);

  // ── 組み立て ──────────────────────────────────────────────
  container.appendChild(label);
  container.appendChild(track);
  container.appendChild(closeBtn);

  // ── 速度一定化: scrollWidth → --ticker-dur ─────────────
  // rAF2回待ってレイアウト確定後に計測
  requestAnimationFrame(() => requestAnimationFrame(() => {
    // set1の幅 = コンテンツ1セット分（-50%で丁度1周）
    const contentW = set1.offsetWidth;
    if (contentW > 0) {
      const dur = Math.max(contentW / SPEED_PX_PER_SEC, 8); // 最低8秒
      track.style.setProperty('--ticker-dur', dur.toFixed(1) + 's');
    }
  }));
}
