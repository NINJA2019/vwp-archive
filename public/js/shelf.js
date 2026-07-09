// shelf.js — MY SHELF（app.js L1965-2462 相当）
// ※ OL_RECEIVED_KEY は observer-link.js で定義。ここでは文字列リテラルを使用。

import { t, mbr } from './i18n.js';
import { getMemberColor, drawVinylDisc, MEMBER_COLORS } from './vinyl.js';
import { getVideos, ytId, parseTags, parseMembers, esc, safeUrl, _gtag, trackExternalLink } from './core.js';

const SHELF_KEY = 'vwp_shelf';
const SHELF_MAX = 10;
const OL_RECEIVED_KEY = 'vwp_received';

let shelfCurrentIdx = null;
let shelfSongs = [];

// --- localStorage read/write ---
export function getShelf(){ try{ return JSON.parse(localStorage.getItem(SHELF_KEY)||'[]'); }catch{ return []; } }
function setShelf(ids){ localStorage.setItem(SHELF_KEY, JSON.stringify(ids.slice(0, SHELF_MAX))); updateShelfNavCnt(); }
export function isOnShelf(id){ return getShelf().includes(id); }

export function addToShelf(id){
  const videos = getVideos();
  const shelf = getShelf();
  if(shelf.length >= SHELF_MAX || shelf.includes(id)) return false;
  shelf.push(id);
  setShelf(shelf);
  const v = videos.find(x=>x.id===id);
  if(v) _gtag('event','shelf_add_song',{song_title:v.title||'',member_name:v.member||''});
  notifyExtension();
  return true;
}
export function removeFromShelf(id){
  const videos = getVideos();
  const shelf = getShelf().filter(x=>x!==id);
  setShelf(shelf);
  const v = videos.find(x=>x.id===id);
  if(v) _gtag('event','shelf_remove_song',{song_title:v.title||''});
  notifyExtension();
}

export function updateShelfNavCnt(){
  const el = document.getElementById('shelfNavCnt');
  if(el){ const c=getShelf().length; el.textContent=c>0?c:''; }
}

// === Chrome拡張連携 ===
function _extractVideoId(url){
  if(!url) return null;
  if(/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  try{
    const u=new URL(url);
    if(u.hostname.includes('youtube.com')) return u.searchParams.get('v');
    if(u.hostname==='youtu.be') return u.pathname.slice(1);
  }catch(_){}
  const m=url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m?m[1]:null;
}

function notifyExtension(){
  const videos = getVideos();
  const shelfIds=getShelf();
  const shelfData=shelfIds.map(id=>{
    const video=videos.find(v=>String(v.id)===String(id));
    if(!video) return null;
    return {
      id:video.id,
      title:video.title,
      member:(video.member||'vwp').split(' ')[0],
      year:video.date?new Date(video.date).getFullYear():null,
      url:video.url,
      videoId:_extractVideoId(video.url),
    };
  }).filter(Boolean);
  window.postMessage({type:'VWP_SHELF_UPDATE',data:shelfData},'*');
}

window.addEventListener('message',function(e){
  if(e.source!==window) return;
  if(e.data&&e.data.type==='VWP_SHELF_REQUEST') notifyExtension();
});

// --- Build shelf UI ---
export function buildShelfUI(){
  const videos = getVideos();
  const shelfIds = getShelf();
  shelfSongs = shelfIds.map(id => videos.find(v => v.id === id)).filter(Boolean);

  const labelEl = document.getElementById('shelf-label');
  if(labelEl) labelEl.textContent = 'MY SHELF — ' + shelfSongs.length + ' ' + t('shelfSongs');

  updatePlayAllBtn('shelf-play-all', shelfSongs);

  const container = document.getElementById('shelf-rows-container');
  if(!container) return;
  container.innerHTML = '';

  const emptyEl = document.getElementById('shelf-empty');
  const hintEl = document.getElementById('shelf-hint');

  if(shelfSongs.length === 0){
    if(emptyEl) emptyEl.style.display = '';
    if(hintEl) hintEl.style.display = 'none';
    shelfClosePanel();
    return;
  }
  if(emptyEl) emptyEl.style.display = 'none';
  if(hintEl) hintEl.style.display = '';

  var ROW_SIZE = 5;
  var rowCount = Math.ceil(shelfSongs.length / ROW_SIZE);
  var tilts = [0, 1.2, -0.8, 1.5, -0.5, -0.5, 1, -1, 0.8, 1.2];

  for(var ri = 0; ri < rowCount; ri++){
    var start = ri * ROW_SIZE;
    var rowSongs = shelfSongs.slice(start, start + ROW_SIZE);

    var block = document.createElement('div');
    block.className = 'shelf-block';

    var row = document.createElement('div');
    row.className = 'shelf-row';
    row.innerHTML = rowSongs.map(function(s, i){
      var idx = start + i;
      var tilt = tilts[idx % tilts.length] || 0;
      var vid = ytId(s.url);
      var thumbUrl = vid ? 'url(https://img.youtube.com/vi/'+vid+'/mqdefault.jpg)' : 'none';
      return '<div class="sj" id="sj'+idx+'"'+
        ' style="background-image:'+thumbUrl+';background-size:cover;background-position:center;transform:rotate('+tilt+'deg);"'+
        ' onclick="shelfOpenPanel('+idx+')"></div>';
    }).join('');

    var board = document.createElement('div');
    board.className = 'wood-board-wrap';
    board.innerHTML = '<div class="wood-board"></div><div class="wood-shadow"></div>';

    block.appendChild(row);
    block.appendChild(board);
    container.appendChild(block);
  }
}

// --- Detail panel ---
export function shelfOpenPanel(i){
  if(shelfCurrentIdx === i){ shelfClosePanel(); return; }
  if(shelfCurrentIdx !== null){
    const prev = document.getElementById('sj'+shelfCurrentIdx);
    if(prev) prev.classList.remove('active');
    shelfResetVinyl();
    document.getElementById('dp-info').classList.remove('show');
  }
  shelfCurrentIdx = i;
  const sjEl = document.getElementById('sj'+i);
  if(sjEl) sjEl.classList.add('active');
  document.getElementById('shelf-hint').style.opacity = '0';

  const s = shelfSongs[i];
  if(!s) return;

  const panel = document.getElementById('detail-panel');
  const panelW = panel.offsetWidth - 40;
  const jacketSize = Math.min(200, Math.floor(panelW * 0.18));
  const vinylSize  = jacketSize;
  const slideX     = Math.floor(jacketSize * 0.5);

  const vid = ytId(s.url);
  const jacket = document.getElementById('dp-jacket');
  jacket.style.width  = jacketSize + 'px';
  jacket.style.height = jacketSize + 'px';
  if(vid){
    jacket.style.backgroundImage = 'url(https://img.youtube.com/vi/'+vid+'/mqdefault.jpg)';
    jacket.style.backgroundSize = 'cover';
    jacket.style.backgroundPosition = 'center';
  }

  const vinylCanvas = document.getElementById('shelf-vinyl-canvas');
  if(vinylCanvas) drawVinylDisc(vinylCanvas, getMemberColor(s.member), vinylSize);

  const stage = document.getElementById('dp-stage');
  stage.style.width  = (jacketSize + slideX) + 'px';
  stage.style.height = jacketSize + 'px';

  const vinylEl = document.getElementById('dp-vinyl');
  vinylEl.style.setProperty('--slide-x', slideX + 'px');

  const members = parseMembers(s).map(m => mbr(m)).join(', ');
  const memberColor = getMemberColor(s.member);
  document.getElementById('dp-member').textContent = members;
  document.getElementById('dp-member').style.color = memberColor;
  document.getElementById('dp-title').textContent = s.title || '';

  const ytBtn = document.getElementById('dp-yt');
  ytBtn.href = safeUrl(s.url);
  ytBtn.onclick = function(e){
    e.preventDefault();
    shelfPlaySong(s);
  };

  const tags = parseTags(s);
  document.getElementById('dp-meta').innerHTML = tags.map(function(tg){
    return '<div class="dp-tag">'+esc(tg)+'</div>';
  }).join('');

  panel.classList.add('open');
  document.querySelector('.panel-host')?.classList.add('expanded');

  setTimeout(function(){
    vinylEl.classList.add('out');
    setTimeout(function(){
      document.getElementById('dp-info').classList.add('show');
    }, 300);
  }, 120);
}

function shelfClosePanel(){
  if(shelfCurrentIdx !== null){
    const el = document.getElementById('sj'+shelfCurrentIdx);
    if(el) el.classList.remove('active');
    shelfCurrentIdx = null;
  }
  document.getElementById('dp-info').classList.remove('show');
  shelfResetVinyl();
  document.getElementById('detail-panel').classList.remove('open');
  const host = document.querySelector('.panel-host');
  if(host) host.classList.remove('expanded');
  setTimeout(function(){
    const hint = document.getElementById('shelf-hint');
    if(hint) hint.style.opacity = '1';
  }, 320);
}

function shelfResetVinyl(){
  const v = document.getElementById('dp-vinyl');
  if(v) v.classList.remove('out');
}

function shelfPlaySong(song){
  _gtag('event','shelf_play',{
    song_title: song.title,
    member_name: song.member
  });
  trackExternalLink(song.url, 'shelf_play', song.title||'');
  window.open(safeUrl(song.url), '_blank', 'noopener,noreferrer');
}

// --- Play all（通しで聴く: YouTube一時プレイリスト） ---
function buildWatchVideosUrl(songs){
  const ids = songs.map(function(s){ return ytId(s.url); }).filter(Boolean);
  if(ids.length < 2) return null;
  return 'https://www.youtube.com/watch_videos?video_ids=' + ids.join(',');
}

function updatePlayAllBtn(btnId, songs){
  const btn = document.getElementById(btnId);
  if(!btn) return;
  const playable = songs.filter(function(s){ return ytId(s.url); }).length;
  btn.style.display = playable >= 2 ? '' : 'none';
}

function shelfPlayAll(shelfType){
  // クリック時点で再計算（stale防止）
  const videos = getVideos();
  const ids = shelfType === 'received' ? getReceivedRecords() : getShelf();
  const songs = ids.map(function(id){ return videos.find(function(v){ return v.id === id; }); }).filter(Boolean);
  const url = buildWatchVideosUrl(songs);
  if(!url) return;
  _gtag('event','shelf_play_all',{
    shelf_type: shelfType,
    song_count: songs.filter(function(s){ return ytId(s.url); }).length
  });
  window.open(url, '_blank', 'noopener,noreferrer');
}

// --- Overlay open/close ---
export function openShelf(){
  buildShelfUI();
  buildReceivedShelfUI();
  updateShelfI18n();
  const overlay = document.getElementById('my-shelf-overlay');
  if(!overlay) return;
  overlay.style.display = '';
  document.body.style.overflow = 'hidden';
  _gtag('event','shelf_open',{song_count:getShelf().length});
}

function updateShelfI18n(){
  const hint = document.getElementById('shelf-hint');
  if(hint) hint.textContent = t('shelfHint');
  const empty = document.getElementById('shelf-empty');
  if(empty) empty.innerHTML = '<p>'+esc(t('shelfEmpty'))+'</p>';
  const ytBtn = document.getElementById('dp-yt');
  if(ytBtn){
    const svg = ytBtn.querySelector('.yt-icon');
    const svgHtml = svg ? svg.outerHTML : '';
    ytBtn.innerHTML = svgHtml + ' ' + esc(t('shelfListenYt'));
  }
  const closeBtn = document.querySelector('.shelf-overlay-close');
  if(closeBtn) closeBtn.setAttribute('aria-label', t('shelfClose'));
  const panelClose = document.querySelector('.dp-btn-close');
  if(panelClose) panelClose.setAttribute('aria-label', t('shelfPanelClose'));
  const playAll = document.getElementById('shelf-play-all');
  if(playAll) playAll.textContent = t('shelfPlayAll');
  const rcvPlayAll = document.getElementById('shelf-rcv-play-all');
  if(rcvPlayAll) rcvPlayAll.textContent = t('shelfPlayAll');
}

function closeShelfOverlay(){
  shelfClosePanel();
  const overlay = document.getElementById('my-shelf-overlay');
  if(overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

// --- Shelf pin button ---
export function toggleShelfPin(id, e){
  e.stopPropagation(); e.preventDefault();
  if(isOnShelf(id)){
    removeFromShelf(id);
  } else {
    if(!addToShelf(id)) return;
  }
  document.querySelectorAll('.shelf-pin[data-sid="'+id+'"]').forEach(function(btn){
    const on = isOnShelf(id);
    btn.textContent = on ? '📌' : '＋';
    btn.title = on ? t('shelfRemove') : (getShelf().length>=SHELF_MAX ? t('shelfFull') : t('shelfAdd'));
    btn.classList.toggle('shelf-pin-on', on);
  });
  const overlay = document.getElementById('my-shelf-overlay');
  if(overlay && overlay.style.display !== 'none') buildShelfUI();
}

export function shelfPinHtml(id){
  const on = isOnShelf(id);
  const full = getShelf().length >= SHELF_MAX && !on;
  const tip = on ? t('shelfRemove') : (full ? t('shelfFull') : t('shelfAdd'));
  return '<button class="shelf-pin'+(on?' shelf-pin-on':'')+'" data-sid="'+id+'" title="'+esc(tip)+'" onclick="toggleShelfPin('+id+',event)"'+(full?' disabled':'')+'>'+(on?'📌':'＋')+'</button>';
}

// === RECEIVED RECORDS (Observer-Link) ===
function getReceivedRecords(){
  try{ return JSON.parse(localStorage.getItem(OL_RECEIVED_KEY) || '[]'); }catch{ return []; }
}

export function buildReceivedShelfUI(){
  const videos = getVideos();
  const container = document.getElementById('shelf-rcv-rows-container');
  const header = document.getElementById('shelf-rcv-header');
  const emptyEl = document.getElementById('shelf-rcv-empty');
  if(!container) return;
  container.innerHTML = '';

  const receivedIds = getReceivedRecords();
  const rcvSongs = receivedIds.map(id => videos.find(v => v.id === id)).filter(Boolean);

  updatePlayAllBtn('shelf-rcv-play-all', rcvSongs);

  if(rcvSongs.length === 0){
    if(header) header.style.display = 'none';
    if(emptyEl) emptyEl.style.display = '';
    return;
  }

  if(header) header.style.display = '';
  if(emptyEl) emptyEl.style.display = 'none';
  _gtag('event','shelf_rcv_open',{received_count: rcvSongs.length});

  var ROW_SIZE = 5;
  var rowCount = Math.ceil(rcvSongs.length / ROW_SIZE);
  var tilts = [0.5, -1, 0.8, -0.6, 1.2, -0.4, 0.9, -1.1, 0.3, -0.7];

  for(var ri = 0; ri < rowCount; ri++){
    var start = ri * ROW_SIZE;
    var rowSongs = rcvSongs.slice(start, start + ROW_SIZE);

    var block = document.createElement('div');
    block.className = 'shelf-block';

    var row = document.createElement('div');
    row.className = 'shelf-row';
    row.innerHTML = rowSongs.map(function(s, i){
      var idx = start + i;
      var tilt = tilts[idx % tilts.length] || 0;
      var vid = ytId(s.url);
      var thumbUrl = vid ? 'url(https://img.youtube.com/vi/'+vid+'/mqdefault.jpg)' : 'none';
      return '<div class="sj shelf-rcv-jk" data-rcv-idx="'+idx+'"'+
        ' style="background-image:'+thumbUrl+';background-size:cover;background-position:center;transform:rotate('+tilt+'deg);"'+
        ' onclick="shelfRcvTap('+idx+')"></div>';
    }).join('');

    var board = document.createElement('div');
    board.className = 'wood-board-wrap';
    board.innerHTML = '<div class="wood-board wood-board-dark"></div><div class="wood-shadow"></div>';

    block.appendChild(row);
    block.appendChild(board);
    container.appendChild(block);
  }

  // Store for tap handler（_rcvSongsはwindow経由のみで代入を維持）
  window._rcvSongs = rcvSongs;
}

export function shelfRcvTap(idx){
  const s = window._rcvSongs && window._rcvSongs[idx];
  if(!s) return;
  _gtag('event','shelf_rcv_tap',{video_id: String(s.id), member_name: s.member});
  _gtag('event','shelf_rcv_play',{video_id: String(s.id), member_name: s.member});
  window.open(safeUrl(s.url), '_blank', 'noopener,noreferrer');
}

// === initShelf: イベント登録 + 初期化 ===
export function initShelf(){
  document.querySelector('.shelf-overlay-close')?.addEventListener('click', closeShelfOverlay);
  document.querySelector('.shelf-overlay-backdrop')?.addEventListener('click', closeShelfOverlay);
  document.addEventListener('keydown', function(e){
    if(e.key==='Escape'){
      const shareOv = document.getElementById('olShareOverlay');
      if(shareOv && shareOv.classList.contains('open')){
        if(typeof window.closeShareDialog==='function') window.closeShareDialog();
        return;
      }
      const overlay = document.getElementById('my-shelf-overlay');
      if(overlay && overlay.style.display !== 'none'){
        closeShelfOverlay();
      }
    }
  });
  document.querySelector('.dp-btn-close')?.addEventListener('click', shelfClosePanel);
  document.getElementById('shelf-play-all')?.addEventListener('click', function(){ shelfPlayAll('my'); });
  document.getElementById('shelf-rcv-play-all')?.addEventListener('click', function(){ shelfPlayAll('received'); });
  updateShelfNavCnt();
}
