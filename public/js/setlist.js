// setlist.js — ファンのセットリスト登録 + ファン・セレクト表示（Phase 1）
// starter.js / shelf.js / observer-link.js のモジュールパターン踏襲。
// 公開: initSetlist / openSetlist / fetchRankings / getMySetlists / renderFanSelect。
// window への新キー露出なし（憲法8）。CSS プレフィックス `sl-`、スコープ `#setlist-overlay`（憲法4）。
// localStorage 新キー: vwp_client_id（匿名ID）/ vwp_setlist（登録済みの表示用ミラー）。
// vwp_shelf は読むだけ（憲法3）。再生は trackSongClick（YouTube 別タブ、憲法9）。

import { getVideos, thumb, esc, safeUrl, trackSongClick, _gtag, parseMembers, searchKey } from './core.js';
import { tokenize, searchWithFallback, bigrams } from './search.js';
import { t, mbr } from './i18n.js';
import { MEMBER_COLORS } from './vinyl.js';
import { trackScreen, trackScreenRestore } from './pageview.js';

// ── 定数 ────────────────────────────────────────────────
const CLIENT_KEY = 'vwp_client_id';
const SETLIST_KEY = 'vwp_setlist';
const SHELF_KEY = 'vwp_shelf';            // 読み取り専用（憲法3）
const MEMBERS = ['kafu','rime','harusar','isekai','koko','vwp'];
const SIZE = 3;
const NON_SONG_TYPES = ['shorts','live','announcement']; // core.js / starter-refresh.js と同値
const API_RANKINGS = '/api/setlist-rankings';
const API_SUBMIT = '/api/setlist-submit';
const TOP_N = 3;

// ── 状態 ────────────────────────────────────────────────
let _initialized = false;
let slOpen = false;
let slView = 'pick';          // 'pick' | 'done'
let slMember = null;
let slSlots = [null, null, null];
let slTab = 'shelf';          // 'shelf' | 'all'
let slQuery = '';
let slSource = 'starter';     // 'starter' | 'shelf'
let slSubmitting = false;
let slDone = null;            // 直近 submit の応答
let _rankingsPromise = null;
let _rankingsAt = 0;
const _sessionOverride = {};  // member → submit 応答由来の鮮度100%データ（CDN 5分キャッシュ対策）
const _bgCache = new WeakMap();
const RANKINGS_TTL = 60 * 1000;
const _rankViewSent = new Set();  // setlist_rank_view はセッション内でメンバーごと 1 回

// ── localStorage ─────────────────────────────────────────
function uuidv4(){
  try { if(crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID(); } catch(e){}
  const b = new Uint8Array(16);
  try { crypto.getRandomValues(b); } catch(e){ for(let i=0;i<16;i++) b[i] = Math.floor(Math.random()*256); }
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2,'0')).join('');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
function getClientId(){
  let id = '';
  try { id = localStorage.getItem(CLIENT_KEY) || ''; } catch(e){}
  if(!/^[0-9a-f-]{36}$/i.test(id)){
    id = uuidv4();
    try { localStorage.setItem(CLIENT_KEY, id); } catch(e){}
  }
  return id;
}
export function getMySetlists(){
  try { const o = JSON.parse(localStorage.getItem(SETLIST_KEY) || '{}'); return (o && typeof o === 'object') ? o : {}; } catch(e){ return {}; }
}
function saveMySetlist(member, ids){
  const o = getMySetlists(); o[member] = ids.slice(0, SIZE);
  try { localStorage.setItem(SETLIST_KEY, JSON.stringify(o)); } catch(e){}
}
function getShelfIds(){ try { return JSON.parse(localStorage.getItem(SHELF_KEY) || '[]'); } catch(e){ return []; } }

// ── ヘルパー ─────────────────────────────────────────────
function isSong(v){ return !NON_SONG_TYPES.includes(v.content_type); }
function songsOf(member){
  return getVideos().filter(v => isSong(v) && parseMembers(v).includes(member));
}
function shelfSongsOf(member){
  const vids = getVideos(); const ids = getShelfIds();
  return ids.map(id => vids.find(v => v.id === id)).filter(v => v && isSong(v) && parseMembers(v).includes(member));
}
function videoById(id){ return getVideos().find(v => v.id === id) || null; }
function colorOf(member){ return MEMBER_COLORS[member] || '#b0b8ff'; }
function fmt(key, vars){ let s = t(key); Object.keys(vars || {}).forEach(k => { s = s.replace('{'+k+'}', () => String(vars[k])); }); return s; }
function songBigrams(v){ let c = _bgCache.get(v); if(c) return c; c = bigrams(searchKey(v)); _bgCache.set(v, c); return c; }
function showToast(msg){
  const el = document.getElementById('sl-toast'); if(!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(showToast._t); showToast._t = setTimeout(() => el.classList.remove('show'), 2400);
}
function el(id){ return document.getElementById(id); }

// ── ランキング取得 ────────────────────────────────────────
function applyOverride(data){
  if(!data || !data.members) return data;
  Object.keys(_sessionOverride).forEach(m => { data.members[m] = _sessionOverride[m]; });
  return data;
}
export function fetchRankings(force){
  const now = Date.now();
  if(!force && _rankingsPromise && (now - _rankingsAt) < RANKINGS_TTL) return _rankingsPromise.then(applyOverride);
  _rankingsAt = now;
  // 通信失敗 / 5xx は success:false（available は undefined のまま）で返し、キャッシュしない
  _rankingsPromise = fetch(API_RANKINGS, { cache: 'no-cache' })
    .then(r => r.ok ? r.json() : { success:false })
    .then(d => (d && d.success) ? d : { success:false, members:{} })
    .catch(() => ({ success:false, members:{} }))
    .then(d => { if(!d.success) _rankingsAt = 0; return d; });
  return _rankingsPromise.then(d => applyOverride(JSON.parse(JSON.stringify(d))));
}

// ── ファン・セレクト（スターターリスト内セクション） ─────────
function rankRowHtml(entry, submitters, rankNum, mine){
  const v = videoById(entry.video_id);
  if(!v) return '';
  const thumbUrl = thumb(v);
  const img = thumbUrl ? '<img class="sl-thumb" src="'+esc(thumbUrl)+'" alt="" loading="lazy" decoding="async">' : '<div class="sl-thumb"></div>';
  const mineHtml = mine ? '<span class="sl-mine">'+esc(t('slMyPick'))+'</span>' : '';
  return '<li class="sl-rank-item" data-id="'+v.id+'" data-rank="'+rankNum+'" data-url="'+esc(safeUrl(v.url))+'">'+
    '<span class="sl-num">'+String(rankNum).padStart(2,'0')+'</span>'+img+
    '<div class="sl-info"><div class="sl-title">'+esc(v.title||'—')+'</div>'+
    '<div class="sl-votes">'+esc(fmt('slVotes',{m:entry.votes,n:submitters}))+mineHtml+'</div></div></li>';
}
export function renderFanSelect(host){
  if(!host) return;
  let sec = host.querySelector('#sl-fans');
  if(!sec){ sec = document.createElement('section'); sec.className = 'sl-fans'; sec.id = 'sl-fans'; host.appendChild(sec); }
  sec.innerHTML = '';
  fetchRankings().then(data => {
    // available===false（migration 未適用）のときだけ非表示。通信失敗時はランキングなし・登録ボタンありで描画
    if(data && data.available === false){ sec.remove(); return; }
    if(!data || !data.members) data = { members:{} };
    const mine = getMySetlists();
    let html = '<div class="sl-fans-head"><div class="sl-fans-heading">'+esc(t('slFans'))+'</div><div class="sl-fans-sub">'+esc(t('slFansSub'))+'</div></div>';
    MEMBERS.forEach(m => {
      const e = data.members[m] || { submitters:0, ready:false, remaining:data.min_submitters||10, top:[] };
      const myIds = Array.isArray(mine[m]) ? mine[m] : [];
      const btnLabel = myIds.length ? t('slUpdate') : t('slRegister');
      let rows = '';
      if(e.ready){
        let n = 0;
        for(const entry of e.top){
          if(n >= TOP_N) break;
          const h = rankRowHtml(entry, e.submitters, n+1, myIds.includes(entry.video_id));
          if(h){ rows += h; n++; }
        }
      }
      const status = e.ready ? fmt('slSubmitters',{n:e.submitters}) : fmt('slCounting',{n:e.remaining});
      html += '<div class="sl-fans-member" data-member="'+m+'">'+
        '<div class="sl-fans-row"><span class="sl-fans-name" style="color:'+colorOf(m)+'">'+esc(mbr(m))+'</span>'+
        '<span class="sl-fans-status">'+esc(status)+'</span>'+
        (myIds.length ? '<span class="sl-fans-reg">'+esc(t('slRegistered'))+'</span>' : '')+
        '<button type="button" class="sl-entry-btn sl-fans-btn" data-member="'+m+'">'+esc(btnLabel)+' →</button></div>'+
        (rows ? '<ul class="sl-rank-list">'+rows+'</ul>' : '')+
        '</div>';
      if(!_rankViewSent.has(m)){ _rankViewSent.add(m); _gtag('event','setlist_rank_view',{member:m, submitters:e.submitters, ready:e.ready}); }
    });
    sec.innerHTML = html;
    sec.querySelectorAll('.sl-fans-btn').forEach(b => b.addEventListener('click', () => openSetlist(b.getAttribute('data-member'), 'starter')));
    sec.querySelectorAll('.sl-rank-item').forEach(li => li.addEventListener('click', () => {
      const id = parseInt(li.getAttribute('data-id'),10); const url = li.getAttribute('data-url');
      if(!url || url === '#') return;
      const m = li.closest('.sl-fans-member');
      _gtag('event','setlist_rank_song_click',{video_id:String(id), member:m?m.getAttribute('data-member'):'', rank:parseInt(li.getAttribute('data-rank'),10)});
      trackSongClick(id, url);
    }));
  });
}

// ── オーバーレイ: 選曲画面 ───────────────────────────────
function pickMemberForShelf(){
  let best = null, bestN = 0;
  MEMBERS.forEach(m => { const n = shelfSongsOf(m).length; if(n > bestN){ best = m; bestN = n; } });
  return { member: best || MEMBERS[0], count: bestN };
}
function resetSlots(){
  const mine = getMySetlists()[slMember];
  slSlots = [null,null,null];
  if(Array.isArray(mine)) mine.slice(0,SIZE).forEach((id,i) => { if(videoById(id)) slSlots[i] = id; });
}
function renderMembers(){
  const host = el('sl-members'); if(!host) return;
  const mine = getMySetlists();
  host.innerHTML = MEMBERS.map(m => '<button type="button" class="sl-member-tab'+(m===slMember?' active':'')+'" data-member="'+m+'" style="--sl-c:'+colorOf(m)+'">'+esc(mbr(m))+(Array.isArray(mine[m])&&mine[m].length?'<span class="sl-check">✓</span>':'')+'</button>').join('');
  host.querySelectorAll('.sl-member-tab').forEach(b => b.addEventListener('click', () => {
    const m = b.getAttribute('data-member'); if(m === slMember) return;
    slMember = m; resetSlots(); slQuery = ''; const q = el('sl-search'); if(q) q.value = '';
    if(slTab === 'shelf' && shelfSongsOf(m).length < SIZE) slTab = 'all';
    _gtag('event','setlist_member_select',{member:m});
    renderPick();
  }));
  const sub = el('sl-sub'); if(sub) sub.textContent = fmt('slSub',{member:mbr(slMember)});
}
function renderSlots(){
  const host = el('sl-slots'); if(!host) return;
  host.innerHTML = slSlots.map((id,i) => {
    const v = id ? videoById(id) : null;
    if(!v) return '<div class="sl-slot sl-slot-empty"><span class="sl-slot-num">'+(i+1)+'</span><span class="sl-slot-label">'+esc(t('slSlotEmpty'))+'</span></div>';
    const tu = thumb(v);
    return '<div class="sl-slot sl-slot-filled" data-idx="'+i+'" title="'+esc(v.title||'')+'"><span class="sl-slot-num">'+(i+1)+'</span>'+(tu?'<img class="sl-slot-thumb" src="'+esc(tu)+'" alt="" loading="lazy">':'<div class="sl-slot-thumb"></div>')+'<span class="sl-slot-title">'+esc(v.title||'')+'</span><span class="sl-slot-x">✕</span></div>';
  }).join('');
  host.querySelectorAll('.sl-slot-filled').forEach(s => s.addEventListener('click', () => { slSlots[parseInt(s.getAttribute('data-idx'),10)] = null; renderSlots(); renderList(); updateSubmit(); }));
}
function renderTabs(){
  const host = el('sl-tabs'); if(!host) return;
  host.querySelectorAll('.sl-tab').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === slTab));
  const sw = el('sl-search-wrap'); if(sw) sw.style.display = slTab === 'all' ? '' : 'none';
  const q = el('sl-search'); if(q) q.placeholder = t('slSearchPh');
}
function listSongs(){
  if(slTab === 'shelf') return shelfSongsOf(slMember);
  const pool = songsOf(slMember).slice().sort((a,b) => (b.date||'').localeCompare(a.date||''));
  const tokens = tokenize(slQuery);
  if(!tokens.length) return pool;
  // メンバー外には広げない（scoped = all = メンバー曲）。レベル1は実質無効、2-3 の表記ゆれ救済だけを使う
  return searchWithFallback({ tokens, scoped: pool, all: pool, keyOf: searchKey, bigramsOf: songBigrams, limit: 30 }).list;
}
function renderList(){
  const host = el('sl-list'); if(!host) return;
  const songs = listSongs();
  if(!songs.length){ host.innerHTML = '<div class="sl-empty">'+esc(t('slNoSongs'))+'</div>'; return; }
  host.innerHTML = songs.map(v => {
    const tu = thumb(v); const sel = slSlots.includes(v.id);
    return '<div class="sl-item'+(sel?' selected':'')+'" data-id="'+v.id+'">'+(tu?'<img class="sl-item-thumb" src="'+esc(tu)+'" alt="" loading="lazy" decoding="async">':'<div class="sl-item-thumb"></div>')+
      '<div class="sl-item-info"><div class="sl-item-title">'+esc(v.title||'')+'</div><div class="sl-item-date">'+esc(v.date||'')+'</div></div>'+(sel?'<span class="sl-item-check">✓</span>':'')+'</div>';
  }).join('');
  host.querySelectorAll('.sl-item').forEach(it => it.addEventListener('click', () => {
    const id = parseInt(it.getAttribute('data-id'),10);
    const idx = slSlots.indexOf(id);
    if(idx !== -1){ slSlots[idx] = null; }
    else {
      const empty = slSlots.indexOf(null);
      if(empty === -1) return;
      slSlots[empty] = id;
      _gtag('event','setlist_slot_add',{member:slMember, source: slTab === 'shelf' ? 'shelf' : (slQuery ? 'search' : 'all')});
    }
    renderSlots(); renderList(); updateSubmit();
  }));
}
function updateSubmit(){
  const b = el('sl-submit'); if(!b) return;
  const full = slSlots.every(Boolean);
  const mine = getMySetlists()[slMember];
  b.disabled = !full || slSubmitting;
  b.textContent = slSubmitting ? t('slSubmitting') : (Array.isArray(mine) && mine.length ? t('slUpdate') : t('slSubmit'));
}
function renderPick(){
  slView = 'pick';
  const pick = el('sl-pick'), done = el('sl-done');
  if(pick) pick.style.display = ''; if(done) done.style.display = 'none';
  renderMembers(); renderSlots(); renderTabs(); renderList(); updateSubmit();
}

// ── オーバーレイ: 登録後画面 ─────────────────────────────
function renderDone(){
  slView = 'done';
  const pick = el('sl-pick'), done = el('sl-done'); if(!done) return;
  if(pick) pick.style.display = 'none'; done.style.display = '';
  const d = slDone; const m = slMember;
  const mine = getMySetlists()[m] || [];
  let html = '<div class="sl-done-msg">'+esc(d.ready ? fmt('slDoneReady',{member:mbr(m)}) : fmt('slDoneCounting',{n:d.remaining, member:mbr(m)}))+'</div>';
  if(d.ready){
    let rows = '', n = 0;
    for(const entry of d.ranking){ if(n>=TOP_N) break; const h = rankRowHtml(entry, d.submitters, n+1, mine.includes(entry.video_id)); if(h){ rows += h; n++; } }
    html += '<div class="sl-done-label">'+esc(fmt('slSubmitters',{n:d.submitters}))+'</div><ul class="sl-rank-list">'+rows+'</ul>';
  }
  html += '<div class="sl-done-label">'+esc(t('slYourPicks'))+'</div><ul class="sl-rank-list sl-mine-list">'+mine.map((id,i) => {
    const v = videoById(id); if(!v) return '';
    const r = d.ready ? (d.my_ranks && d.my_ranks[String(id)]) : null;
    const badge = d.ready ? '<span class="sl-mine">'+esc(r ? fmt('slMyRank',{n:r}) : t('slMyRankOut'))+'</span>' : '';
    const tu = thumb(v);
    return '<li class="sl-rank-item" data-id="'+v.id+'" data-url="'+esc(safeUrl(v.url))+'"><span class="sl-num">'+String(i+1).padStart(2,'0')+'</span>'+(tu?'<img class="sl-thumb" src="'+esc(tu)+'" alt="" loading="lazy">':'<div class="sl-thumb"></div>')+'<div class="sl-info"><div class="sl-title">'+esc(v.title||'')+'</div><div class="sl-votes">'+badge+'</div></div></li>';
  }).join('')+'</ul>';
  html += '<div class="sl-done-actions"><button type="button" class="sl-btn" id="sl-another">'+esc(t('slAnother'))+'</button><button type="button" class="sl-btn sl-btn-ghost" id="sl-done-close">'+esc(t('slClose'))+'</button></div>';
  done.innerHTML = html;
  done.querySelectorAll('.sl-rank-item').forEach(li => li.addEventListener('click', () => {
    const url = li.getAttribute('data-url'); if(!url || url==='#') return;
    trackSongClick(parseInt(li.getAttribute('data-id'),10), url);
  }));
  el('sl-another')?.addEventListener('click', () => { slDone = null; resetSlots(); renderPick(); trackScreen('/setlist','Setlist | VWP Archive',{overlay:true}); });
  el('sl-done-close')?.addEventListener('click', closeSetlist);
  trackScreen('/setlist/done','Setlist Done | VWP Archive',{overlay:true});
}

// ── submit ───────────────────────────────────────────────
function submit(){
  if(slSubmitting || !slSlots.every(Boolean)) return;
  slSubmitting = true; updateSubmit();
  const member = slMember; const ids = slSlots.slice();
  const wasUpdate = Array.isArray(getMySetlists()[member]) && getMySetlists()[member].length > 0;
  fetch(API_SUBMIT, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ client_id: getClientId(), member, video_ids: ids }) })
    .then(r => r.json().then(d => ({ status:r.status, d })).catch(() => ({ status:r.status, d:null })))
    .then(({ status, d }) => {
      slSubmitting = false;
      if(d && d.success){
        saveMySetlist(member, ids);
        _sessionOverride[member] = { submitters:d.submitters, ready:d.ready, remaining:d.remaining, top:d.ranking||[] };
        slDone = d;
        _gtag('event','setlist_submit',{member, song_count:ids.length, is_update: !!d.is_update || wasUpdate});
        renderDone();
        return;
      }
      const err = (d && d.error) || ('HTTP_'+status);
      _gtag('event','setlist_submit_error',{member, error:err});
      showToast(err==='RATE_LIMIT_EXCEEDED' ? t('slErrRate') : err==='SETLIST_UNAVAILABLE' ? t('slErrUnavailable') : t('slErrGeneric'));
      updateSubmit();
    })
    .catch(() => { slSubmitting = false; _gtag('event','setlist_submit_error',{member, error:'NETWORK'}); showToast(t('slErrGeneric')); updateSubmit(); });
}

// ── open / close ─────────────────────────────────────────
export function openSetlist(member, source){
  const ov = el('setlist-overlay'); if(!ov) return;
  slSource = source || 'starter';
  if(member && MEMBERS.includes(member)){ slMember = member; slTab = shelfSongsOf(member).length >= SIZE ? 'shelf' : 'all'; }
  else {
    const p = pickMemberForShelf(); slMember = p.member;
    slTab = p.count >= SIZE ? 'shelf' : 'all';
    if(p.count < SIZE) showToast(fmt('slShelfTooFew',{member:mbr(slMember)}));
  }
  slQuery = ''; const q = el('sl-search'); if(q) q.value = '';
  slDone = null; resetSlots();
  ov.style.display = ''; slOpen = true;
  document.body.style.overflow = 'hidden';
  renderPick();
  _gtag('event','setlist_open',{source:slSource, member:slMember});
  trackScreen('/setlist','Setlist | VWP Archive',{overlay:true});
}
function closeSetlist(){
  const ov = el('setlist-overlay'); if(!ov) return;
  ov.style.display = 'none'; slOpen = false;
  // 下にまだオーバーレイが開いているなら、そちらの page_view を明示再送（pageview.js は1段しか覚えない）
  const starter = el('starter-list-screen'), shelf = el('my-shelf-overlay');
  const starterOpen = starter && starter.style.display !== 'none';
  const shelfOpen = shelf && shelf.style.display !== 'none';
  if(starterOpen){ trackScreen('/starter','Starter List | VWP Archive',{overlay:true}); renderFanSelect(el('starter-list-body')); }
  else if(shelfOpen){ trackScreen('/shelf','My Shelf | VWP Archive',{overlay:true}); }
  else { document.body.style.overflow = ''; trackScreenRestore(); }
}
export function isSetlistOpen(){ return slOpen; }

// ── initSetlist ──────────────────────────────────────────
export function initSetlist(){
  if(_initialized) return; _initialized = true;
  const ov = el('setlist-overlay'); if(!ov) return;
  ov.querySelector('.sl-close')?.addEventListener('click', closeSetlist);
  ov.querySelector('.sl-backdrop')?.addEventListener('click', closeSetlist);
  el('sl-tabs')?.querySelectorAll('.sl-tab').forEach(b => b.addEventListener('click', () => { slTab = b.getAttribute('data-tab'); renderTabs(); renderList(); }));
  el('sl-search')?.addEventListener('input', e => { slQuery = e.target.value.trim(); renderList(); });
  el('sl-submit')?.addEventListener('click', submit);
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && slOpen) closeSetlist(); });
  // MY SHELF からの入口（shelf.js が openShelf 末尾で dispatch）
  const entry = el('sl-shelf-entry');
  if(entry){
    entry.addEventListener('click', () => openSetlist(null, 'shelf'));
    document.addEventListener('vwp:shelf-opened', () => {
      entry.textContent = t('slFromShelf');
      entry.style.display = getShelfIds().length >= SIZE ? '' : 'none';
    });
  }
}
