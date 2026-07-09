// observer-link.js — OBSERVER-LINK（app.js L2464-3451 相当）

import { t } from './i18n.js';
import { getVideos, ytId, parseTags, parseMembers, esc, safeUrl, _gtag, getIsAdmin, getStoredPw } from './core.js';
import { getShelf } from './shelf.js';
import { getMemberColor } from './vinyl.js';

const OL_MOODS = ['Morning', 'Night', 'Rain', 'Walk', 'Work', 'Chill'];
const OL_DAILY_LIMIT = 10;
const OL_RECEIVED_KEY = 'vwp_received';
const OL_SENT_KEY = 'vwp_sent'; // 新キー（既存キー vwp_shelf / vwp_received は不変=憲法3）
const OL_SENT_MAX = 10;
const OL_SENT_WAITING_MAX_MS = 30 * 86400000; // 30日
const OL_MEMBER_DISPLAY = {kafu:'KAF',rime:'RIM',harusar:'HARU',isekai:'JOUCHO',koko:'KOKO',vwp:'V.W.P'};
const OL_TAG_MAP = {Single:'シングル',Duet:'デュエット',Trio:'トリオ',Cover:'Covered'};
const OL_TAG_LABELS = ['Single','Duet','Trio','Cover'];

let olSelectedSong = null;
let olSelectedMoods = [];
let olDailyUsed = 0;
let olPickerTab = 'shelf';
let olPickerMember = null;
let olPickerSelectedTags = [];
let olLastExchangeId = null;
let olLastReceived = null;
let olPickedBottles = [];

export function olInit(){
  const mc = document.getElementById('olMoodTags');
  if(!mc) return;
  OL_MOODS.forEach(m => {
    const el = document.createElement('button');
    el.className = 'ol-mood-tag';
    el.textContent = m;
    el.onclick = () => olToggleMood(el, m);
    mc.appendChild(el);
  });

  const msgInput = document.getElementById('olMsgInput');
  if(msgInput) msgInput.addEventListener('input', e => {
    document.getElementById('olMsgCount').textContent = e.target.value.length + '/20';
  });

  const sel = document.getElementById('olSongSelect');
  if(sel) sel.addEventListener('click', () => olOpenPicker());

  const sendBtn = document.getElementById('olSendBtn');
  if(sendBtn) sendBtn.addEventListener('click', olSendRecord);

  document.getElementById('olCloseBtn')?.addEventListener('click', olClose);
  document.getElementById('olResultCloseBtn')?.addEventListener('click', olClose);

  const overlay = document.getElementById('olPickerOverlay');
  if(overlay) overlay.addEventListener('click', e => { if(e.target === overlay) olClosePicker(); });

  document.querySelectorAll('.ol-picker-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if(tab.disabled) return;
      olPickerTab = tab.dataset.tab;
      olPickerMember = null;
      olPickerSelectedTags = [];
      document.querySelectorAll('.ol-picker-tab').forEach(t => t.classList.remove('ol-picker-tab-active'));
      tab.classList.add('ol-picker-tab-active');
      _gtag('event','ol_picker_tab',{tab: olPickerTab});
      olBuildPickerContent();
    });
  });

  document.getElementById('olPickedView')?.addEventListener('click', olPickedViewTap);
  document.getElementById('olPickedDismiss')?.addEventListener('click', olPickedDismissTap);
  olCheckSentBottles();

  const params = new URLSearchParams(location.search);
  const olResult = params.get('ol_result');
  if(olResult) {
    const cleanUrl = location.pathname + location.search.replace(/[?&]ol_result=[^&]+/, '').replace(/^\?$/, '').replace(/^&/, '?');
    history.replaceState(null, '', cleanUrl || location.pathname);
    olOpenFromResult(olResult);
  }
}

function olOpenFromResult(exchangeId){
  olOpen();
  olShowScreen('olResultScreen');
  const body = document.getElementById('olResultBody');
  if(body) body.innerHTML = `
    <div class="ol-result-intro">
      <div class="ol-result-intro-title">Observer-Link</div>
      <div class="ol-result-intro-sub">This exchange result was shared with you. Try sending your own record!</div>
    </div>
    <div class="ol-result-actions">
      <button class="ol-btn-again" onclick="olResetCompose()">SEND A RECORD</button>
    </div>`;
}

/* ── OL hero oscilloscope canvas ── */
let _olHeroRaf = null;
let _olHeroT   = 0;

function startOlHeroCanvas(){
  if(_olHeroRaf) return;
  const cvs = document.getElementById('olHeroCanvas');
  if(!cvs) return;
  const ctx = cvs.getContext('2d');
  const W = cvs.width, H = cvs.height;

  function drawOlHero(){
    ctx.fillStyle = '#020508'; ctx.fillRect(0,0,W,H);

    ctx.strokeStyle = 'rgba(96,210,255,0.055)'; ctx.lineWidth = 1;
    for(let i=1;i<8;i++){ ctx.beginPath(); ctx.moveTo(W/8*i,0); ctx.lineTo(W/8*i,H); ctx.stroke(); }
    for(let i=1;i<4;i++){ ctx.beginPath(); ctx.moveTo(0,H/4*i); ctx.lineTo(W,H/4*i); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(96,210,255,0.09)';
    ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();

    const CY1 = H*0.31, CY2 = H*0.69, amp1 = H*0.22, amp2 = H*0.18;

    ctx.beginPath();
    for(let x=0;x<W;x++){
      const p = (x/W)*Math.PI*6 - _olHeroT*2.2, n = Math.sin(x*0.04 + _olHeroT*0.7)*0.08;
      x===0 ? ctx.moveTo(x, CY1 + Math.sin(p+n)*amp1) : ctx.lineTo(x, CY1 + Math.sin(p+n)*amp1);
    }
    ctx.strokeStyle = 'rgba(50,150,255,0.9)'; ctx.lineWidth = 1.8;
    ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(50,150,255,0.55)';
    ctx.stroke(); ctx.shadowBlur = 0;

    ctx.beginPath();
    for(let x=0;x<W;x++){
      const p = (x/W)*Math.PI*6 - _olHeroT*2.0 + 1.1, n = Math.sin(x*0.05 - _olHeroT*0.5)*0.06;
      x===0 ? ctx.moveTo(x, CY2 + Math.sin(p+n)*amp2) : ctx.lineTo(x, CY2 + Math.sin(p+n)*amp2);
    }
    ctx.strokeStyle = 'rgba(130,195,255,0.52)'; ctx.lineWidth = 1.4;
    ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(130,195,255,0.38)';
    ctx.stroke(); ctx.shadowBlur = 0;

    const sx = (_olHeroT * 60) % W;
    const sy1 = CY1 + Math.sin((sx/W)*Math.PI*6 - _olHeroT*2.2)*amp1;
    const sy2 = CY2 + Math.sin((sx/W)*Math.PI*6 - _olHeroT*2.0 + 1.1)*amp2;
    ctx.setLineDash([2,5]);
    ctx.beginPath(); ctx.moveTo(sx,sy1); ctx.lineTo(sx,sy2);
    ctx.strokeStyle = 'rgba(96,210,255,0.20)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.setLineDash([]);
    [sy1,sy2].forEach(sy => {
      ctx.beginPath(); ctx.arc(sx,sy,3,0,Math.PI*2);
      ctx.fillStyle = 'rgba(200,230,255,0.92)'; ctx.fill();
    });

    const vg = ctx.createRadialGradient(W/2,H/2,H*0.15,W/2,H/2,W*0.62);
    vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg; ctx.fillRect(0,0,W,H);

    ctx.font = '600 10px "Barlow Condensed",sans-serif';
    ctx.fillStyle = 'rgba(80,180,255,0.28)'; ctx.fillText('LINK',8,14);

    _olHeroT += 0.016;
    _olHeroRaf = requestAnimationFrame(drawOlHero);
  }

  _olHeroT = 0;
  drawOlHero();
}

function stopOlHeroCanvas(){
  if(_olHeroRaf){ cancelAnimationFrame(_olHeroRaf); _olHeroRaf = null; }
}

export function olOpen(){
  const screen = document.getElementById('observer-link-screen');
  if(!screen) return;
  screen.style.display = '';
  screen.classList.add('ol-open');
  document.body.style.overflow = 'hidden';
  olSelectedSong = null;
  olSelectedMoods = [];
  olSending = false;
  olLastExchangeId = null;
  olLastReceived = null;
  document.getElementById('olSongPlaceholder').style.display = 'flex';
  document.getElementById('olSongSelected').style.display = 'none';
  document.getElementById('olSongSelect').classList.remove('has-song');
  const msgInput = document.getElementById('olMsgInput');
  if(msgInput) msgInput.value = '';
  document.getElementById('olMsgCount').textContent = '0/20';
  document.querySelectorAll('.ol-mood-tag').forEach(t => t.classList.remove('selected'));
  olUpdateSendBtn();
  olShowScreen('olComposeScreen');
  const shelfIds = getShelf();
  const shelfTab = document.querySelector('.ol-picker-tab[data-tab="shelf"]');
  const allTab = document.querySelector('.ol-picker-tab[data-tab="all"]');
  if(shelfIds.length === 0 && shelfTab){
    shelfTab.disabled = true;
    shelfTab.classList.remove('ol-picker-tab-active');
    if(allTab){ allTab.classList.add('ol-picker-tab-active'); olPickerTab = 'all'; }
  } else if(shelfTab){
    shelfTab.disabled = false;
    olPickerTab = 'shelf';
    shelfTab.classList.add('ol-picker-tab-active');
    if(allTab) allTab.classList.remove('ol-picker-tab-active');
  }
  // 拾得通知（OL open毎に最大1回）
  if(olPickedBottles.length > 0){
    _gtag('event','ol_bottle_picked_notice',{picked_count: olPickedBottles.length});
  }
  startOlHeroCanvas();
}

export function olClose(){
  stopOlHeroCanvas();
  olParticles.destroy();
  olSendingParticles.destroy();
  olResetSendingView();
  const screen = document.getElementById('observer-link-screen');
  if(screen){ screen.style.display = 'none'; screen.classList.remove('ol-open'); }
  document.body.style.overflow = '';
}

function olShowScreen(id){
  document.querySelectorAll('#observer-link-screen .ol-screen').forEach(s => {
    if(s.id === id){ s.classList.remove('ol-hidden'); s.style.display = ''; }
    else { s.classList.add('ol-hidden'); }
  });
  if(id === 'olComposeScreen') startOlHeroCanvas();
  else stopOlHeroCanvas();
}

function olToggleMood(el, mood){
  if(olSelectedMoods.includes(mood)){
    olSelectedMoods = olSelectedMoods.filter(m => m !== mood);
    el.classList.remove('selected');
  } else {
    if(olSelectedMoods.length >= 2){ olShowToast('Up to 2 mood tags'); return; }
    olSelectedMoods.push(mood);
    el.classList.add('selected');
  }
}

function olUpdateSendBtn(){
  const btn = document.getElementById('olSendBtn');
  if(btn) btn.disabled = !olSelectedSong || olDailyUsed >= OL_DAILY_LIMIT;
}

function olSelectSong(song){
  olSelectedSong = song;
  document.getElementById('olSongPlaceholder').style.display = 'none';
  const selEl = document.getElementById('olSongSelected');
  selEl.style.display = 'flex';
  const vid = ytId(song.url);
  document.getElementById('olSelThumb').src = vid ? 'https://img.youtube.com/vi/'+vid+'/mqdefault.jpg' : '';
  const memberIds = parseMembers(song);
  const memberDisplay = memberIds.map(m => OL_MEMBER_DISPLAY[m] || m).join(', ');
  const memberColor = getMemberColor(song.member);
  document.getElementById('olSelMember').textContent = memberDisplay;
  document.getElementById('olSelMember').style.color = memberColor;
  document.getElementById('olSelTitle').textContent = song.title || '';
  document.getElementById('olSelDate').textContent = song.date || '';
  document.getElementById('olSongSelect').classList.add('has-song');
  olClosePicker();
  olUpdateSendBtn();
}

// === PICKER ===
function olOpenPicker(){
  olPickerMember = null;
  olPickerSelectedTags = [];
  olBuildPickerContent();
  document.getElementById('olPickerOverlay').classList.add('open');
}

function olClosePicker(){
  document.getElementById('olPickerOverlay').classList.remove('open');
}

function olBuildPickerContent(){
  const list = document.getElementById('olPickerList');
  if(!list) return;
  list.innerHTML = '';

  if(olPickerTab === 'shelf'){
    olBuildShelfPicker(list);
  } else {
    olBuildAllPicker(list);
  }
}

function olBuildShelfPicker(container){
  const videos = getVideos();
  const shelfIds = getShelf();
  const songs = shelfIds.map(id => videos.find(v => v.id === id)).filter(Boolean);
  if(songs.length === 0){
    container.innerHTML = '<div style="text-align:center;padding:40px 20px;color:rgba(232,236,248,.35);font-size:13px;">No songs on your shelf yet</div>';
    return;
  }
  songs.forEach(s => container.appendChild(olCreatePickerItem(s)));
}

function olBuildAllPicker(container){
  const videos = getVideos();
  if(!olPickerMember){
    const members = [
      {id:'vwp',label:'V.W.P',color:'#c4b5fd'},
      {id:'kafu',label:'KAF',color:'#ffb7c5'},
      {id:'rime',label:'RIM',color:'#7eb8f7'},
      {id:'harusar',label:'HARU',color:'#ff7070'},
      {id:'isekai',label:'JOUCHO',color:'#d8d8d8'},
      {id:'koko',label:'KOKO',color:'#c084fc'},
    ];
    const grid = document.createElement('div');
    grid.className = 'ol-picker-members';
    members.forEach(m => {
      const chip = document.createElement('button');
      chip.className = 'ol-picker-member-chip';
      chip.textContent = m.label;
      chip.style.color = m.color;
      chip.style.borderColor = 'rgba(255,255,255,.08)';
      chip.addEventListener('click', () => {
        olPickerMember = m.id;
        olPickerSelectedTags = [];
        olBuildPickerContent();
      });
      grid.appendChild(chip);
    });
    container.appendChild(grid);
    return;
  }

  const backBtn = document.createElement('button');
  backBtn.className = 'ol-picker-back-btn';
  backBtn.innerHTML = '← All members';
  backBtn.addEventListener('click', () => {
    olPickerMember = null;
    olPickerSelectedTags = [];
    olBuildPickerContent();
  });
  container.appendChild(backBtn);

  const tagWrap = document.createElement('div');
  tagWrap.className = 'ol-picker-tag-chips';
  OL_TAG_LABELS.forEach(label => {
    const chip = document.createElement('button');
    chip.className = 'ol-picker-tag-chip' + (olPickerSelectedTags.includes(label) ? ' selected' : '');
    chip.textContent = label;
    chip.addEventListener('click', () => {
      if(olPickerSelectedTags.includes(label)){
        olPickerSelectedTags = olPickerSelectedTags.filter(t => t !== label);
      } else {
        olPickerSelectedTags.push(label);
      }
      olBuildPickerContent();
    });
    tagWrap.appendChild(chip);
  });
  container.appendChild(tagWrap);

  let filteredVideos = videos.filter(v => v.member && v.member.includes(olPickerMember));
  if(olPickerSelectedTags.length > 0){
    filteredVideos = filteredVideos.filter(v => {
      const parsed = parseTags(v);
      return olPickerSelectedTags.some(t => parsed.includes(OL_TAG_MAP[t]));
    });
  }
  filteredVideos.sort((a,b) => (b.date||'').localeCompare(a.date||''));

  if(filteredVideos.length === 0){
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;padding:30px 20px;color:rgba(232,236,248,.35);font-size:13px;';
    empty.textContent = 'No songs found';
    container.appendChild(empty);
    return;
  }

  filteredVideos.forEach(s => container.appendChild(olCreatePickerItem(s)));
}

function olCreatePickerItem(song){
  const el = document.createElement('div');
  el.className = 'ol-picker-item';
  const vid = ytId(song.url);
  const thumbUrl = vid ? 'https://img.youtube.com/vi/'+vid+'/mqdefault.jpg' : '';
  const memberIds = parseMembers(song);
  const memberDisplay = memberIds.map(m => OL_MEMBER_DISPLAY[m] || m).join(', ');
  const color = getMemberColor(song.member);
  el.innerHTML = '<img class="ol-picker-item-thumb" src="'+esc(thumbUrl)+'" alt="" loading="lazy"><div class="ol-picker-item-info"><div class="ol-picker-item-member" style="color:'+color+'">'+esc(memberDisplay)+'</div><div class="ol-picker-item-title">'+esc(song.title)+'</div></div>';
  el.addEventListener('click', () => olSelectSong(song));
  return el;
}

// === SENDING PARTICLES ===
var olSendingParticles = {
  canvas:null, ctx:null, raf:null, dots:[],
  init:function(canvasEl){
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.dots = [];
    this.resize();
    this._onResize = this.resize.bind(this);
    window.addEventListener('resize', this._onResize);
    var rect = canvasEl.parentElement.getBoundingClientRect();
    for(var i=0;i<40;i++){
      this.dots.push({
        x:Math.random()*rect.width,
        y:Math.random()*rect.height,
        vx:(Math.random()-.5)*.3,
        vy:-(.2+Math.random()*.4),
        r:Math.random()*1.5+.5,
        a:Math.random()*.15+.03,
        life:Math.random()*Math.PI*2
      });
    }
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.animate();
  },
  resize:function(){
    if(!this.canvas) return;
    var d = devicePixelRatio||1;
    var r = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = r.width*d; this.canvas.height = r.height*d;
    this.canvas.style.width = r.width+'px'; this.canvas.style.height = r.height+'px';
    this.ctx.scale(d,d);
  },
  animate:function(){
    var self = this;
    var ctx = this.ctx;
    var r = this.canvas.parentElement.getBoundingClientRect();
    ctx.clearRect(0,0,r.width,r.height);
    this.dots.forEach(function(d){
      d.x += d.vx; d.y += d.vy; d.life += .02;
      if(d.y < -10){ d.y = r.height+10; d.x = Math.random()*r.width; }
      if(d.x < -10) d.x = r.width+10;
      if(d.x > r.width+10) d.x = -10;
      var pulse = (Math.sin(d.life)+1)/2;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(108,92,231,'+(d.a+pulse*.05)+')';
      ctx.fill();
    });
    this.raf = requestAnimationFrame(function(){ self.animate(); });
  },
  destroy:function(){
    if(this.raf) cancelAnimationFrame(this.raf);
    this.raf = null; this.dots = [];
    if(this.canvas && this.ctx){
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if(this._onResize) window.removeEventListener('resize', this._onResize);
  }
};

// === SEND ===
let olSending = false;

function olShowSendingCard(song){
  var card = document.getElementById('olSendingCard');
  if(!card || !song) return;
  var vid = ytId(song.url || '');
  var thumb = vid ? 'https://img.youtube.com/vi/'+vid+'/mqdefault.jpg' : '';
  var memberDisplay = olGetMemberDisplay(song.member);
  card.innerHTML = '<div class="ol-sending-card-thumb">'+(thumb?'<img src="'+esc(thumb)+'" alt="">':'')+'</div>'
    + '<div style="overflow:hidden"><div class="ol-sending-card-member">'+esc(memberDisplay)+'</div>'
    + '<div class="ol-sending-card-title">'+esc(song.title)+'</div></div>';
  card.classList.add('visible');
}

function olResetSendingView(){
  var view = document.getElementById('olSendingScreen');
  if(view) view.classList.remove('matched');
  var title = document.getElementById('olSendingTitle');
  if(title){ title.textContent = 'LINKING OBSERVERS'; title.style.color = ''; }
  var sub = document.getElementById('olSendingSub');
  if(sub) sub.textContent = 'Searching for a match...';
  var card = document.getElementById('olSendingCard');
  if(card){ card.classList.remove('visible'); card.innerHTML = ''; }
  olSendingParticles.destroy();
}

function olSendRecord(){
  const videos = getVideos();
  if(!olSelectedSong || olSending) return;
  olSending = true;
  document.getElementById('olSendBtn').disabled = true;
  const msg = document.getElementById('olMsgInput')?.value.trim() || '';

  _gtag('event','ol_send_record',{
    video_id: String(olSelectedSong.id),
    member_name: olSelectedSong.member,
    mood_tags: olSelectedMoods.join(','),
    has_message: msg ? 'true' : 'false',
  });

  olResetSendingView();
  olShowScreen('olSendingScreen');
  olShowSendingCard(olSelectedSong);
  var pCanvas = document.getElementById('ol-sending-particles');
  if(pCanvas) olSendingParticles.init(pCanvas);
  document.getElementById('olAmbientGlow')?.classList.add('bright');

  const olHeaders = {'Content-Type':'application/json'};
  if(getIsAdmin()){ const pw = getStoredPw(); if(pw) olHeaders['x-admin-key'] = pw; }
  fetch('/.netlify/functions/observer-link-exchange', {
    method: 'POST',
    headers: olHeaders,
    body: JSON.stringify({
      video_id: olSelectedSong.id,
      mood_tags: olSelectedMoods,
      message: msg || undefined,
    }),
  })
  .then(r => r.json())
  .then(data => {
    if(!data.success){
      const errMsg = data.error === 'RATE_LIMIT_EXCEEDED' ? 'Daily limit reached (10/day)'
        : data.error === 'INVALID_VIDEO_ID' ? 'Invalid song'
        : 'Something went wrong';
      olShowToast(errMsg);
      olSending = false;
      olUpdateSendBtn();
      olResetSendingView();
      olShowScreen('olComposeScreen');
      document.getElementById('olAmbientGlow')?.classList.remove('bright');
      return;
    }
    olDailyUsed = data.daily_used != null ? data.daily_used : (olDailyUsed + 1);
    if(data.is_admin){
      document.getElementById('olUsedCount').textContent = '∞';
      document.getElementById('olDailyBadge').textContent = '∞ admin';
    } else {
      document.getElementById('olUsedCount').textContent = olDailyUsed;
      document.getElementById('olDailyBadge').textContent = olDailyUsed + ' / ' + OL_DAILY_LIMIT;
    }
    olUpdateSendBtn();
    olLastExchangeId = data.exchange_id;
    olLastReceived = data.received;
    // fallback時のみ再訪フックに保存（guardによりwaiting残存個体があり後日拾われ得る）
    if(data.is_fallback === true) olSaveSentBottle(data.exchange_id);

    if(data.received && !data.is_fallback){
      olSaveReceivedRecord(data.received.video_id);
    }

    if(data.is_fallback){
      _gtag('event','ol_match_fallback',{sent_video_id:String(olSelectedSong.id),received_video_id:data.received?String(data.received.video_id):''});
    } else {
      _gtag('event','ol_match_success',{sent_video_id:String(olSelectedSong.id),received_video_id:data.received?String(data.received.video_id):'',time_ago_seconds:data.received?.time_ago_seconds||0});
    }

    var view = document.getElementById('olSendingScreen');
    var title = document.getElementById('olSendingTitle');
    var sub = document.getElementById('olSendingSub');
    if(view) view.classList.add('matched');
    if(title){ title.textContent = 'LINK ESTABLISHED'; title.style.color = '#22c55e'; }
    if(sub) sub.textContent = 'A record from another observer';

    setTimeout(() => {
      olSending = false;
      olUpdateSendBtn();
      olResetSendingView();
      olShowResult(data);
      document.getElementById('olAmbientGlow')?.classList.remove('bright');
    }, 1300);
  })
  .catch(() => {
    olShowToast('Network error — please try again');
    olSending = false;
    olUpdateSendBtn();
    olResetSendingView();
    olShowScreen('olComposeScreen');
    document.getElementById('olAmbientGlow')?.classList.remove('bright');
  });
}

function olFormatTimeAgo(seconds){
  if(seconds == null) return null;
  if(seconds < 60) return seconds + ' seconds';
  if(seconds < 3600) return Math.floor(seconds / 60) + ' minutes';
  if(seconds < 86400) return Math.floor(seconds / 3600) + ' hours';
  return Math.floor(seconds / 86400) + ' days';
}

function olGetMemberDisplay(memberStr){
  if(!memberStr) return 'Observer';
  for(const [id, name] of Object.entries(OL_MEMBER_DISPLAY)){
    if(memberStr.includes(id)) return name;
  }
  return memberStr;
}

// === OL PARTICLE SYSTEM ===
var olParticles = {
  canvas:null, ctx:null, W:0, H:0,
  particles:[], raf:null, burstFired:false,
  init:function(canvasEl){
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.resize();
    this._onResize = this.resize.bind(this);
    window.addEventListener('resize', this._onResize);
    this.animate();
    setTimeout(this.burst.bind(this), 1400);
  },
  resize:function(){
    this.W = this.canvas.width = this.canvas.offsetWidth;
    this.H = this.canvas.height = this.canvas.offsetHeight;
  },
  spawn:function(x,y,isBurst){
    var angle = Math.random()*Math.PI*2;
    var speed = isBurst ? (2+Math.random()*6) : (0.3+Math.random()*1.5);
    var colors = [[108,92,231],[93,201,168],[200,220,255]];
    this.particles.push({
      x:x, y:y,
      vx:Math.cos(angle)*speed,
      vy:Math.sin(angle)*speed-(isBurst?2:0),
      life:1,
      decay:isBurst?(0.008+Math.random()*0.015):(0.002+Math.random()*0.005),
      size:isBurst?(1.5+Math.random()*3):(0.5+Math.random()*1.5),
      color:colors[Math.floor(Math.random()*colors.length)]
    });
  },
  burst:function(){
    if(this.burstFired) return;
    this.burstFired = true;
    var cx = this.W/2;
    var cy = Math.min(this.H*0.22, 180);
    for(var i=0;i<60;i++) this.spawn(cx, cy, true);
  },
  animate:function(){
    var self = this;
    var ctx = this.ctx, W = this.W, H = this.H, ps = this.particles;
    ctx.clearRect(0,0,W,H);
    if(ps.length<30 && Math.random()<0.15){
      this.spawn(Math.random()*W, H*0.1+Math.random()*H*0.5, false);
    }
    for(var i=ps.length-1;i>=0;i--){
      var p=ps[i];
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.02; p.vx*=0.99; p.life-=p.decay;
      var r=Math.max(0,p.size*p.life);
      if(r<0.01||p.life<=0){ps.splice(i,1);continue;}
      ctx.globalAlpha=p.life*0.8;
      ctx.fillStyle='rgb('+p.color[0]+','+p.color[1]+','+p.color[2]+')';
      ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=p.life*0.15;
      ctx.beginPath();ctx.arc(p.x,p.y,r*3,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    this.raf = requestAnimationFrame(function(){self.animate();});
  },
  destroy:function(){
    if(this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.particles = [];
    this.burstFired = false;
    if(this._onResize) window.removeEventListener('resize', this._onResize);
  }
};

function olShowResult(data){
  var sent = data.sent;
  var received = data.received;
  var isFallback = data.is_fallback;

  var sentVid = ytId(sent.url || '');
  var sentThumb = sentVid ? 'https://img.youtube.com/vi/'+sentVid+'/mqdefault.jpg' : '';
  var sentMemberDisplay = olGetMemberDisplay(sent.member);
  var sentColor = getMemberColor(sent.member);

  // 漂着ラベルはreceivedありのfallbackに限定。received無し（候補空の稀ケース）は従来の'RECOMMENDED'
  var labelText = (received && !isFallback) ? 'LINKED' : (received ? t('olDriftLabel') : 'RECOMMENDED');
  var subText = !received ? 'Something went wrong — try again'
    : isFallback ? t('olDriftSub')
    : 'From an observer ' + (olFormatTimeAgo(received.time_ago_seconds) || 'moments') + ' ago';

  var badgeHtml = '<canvas id="olResultParticles"></canvas>'
    + '<div class="ol-ambient"></div>'
    + '<div class="ol-match-badge' + (isFallback ? ' ol-drift' : '') + '">'
    + '<div class="ol-ring-container">'
    + '<div class="ol-ring ol-ring-1"></div><div class="ol-ring ol-ring-2"></div><div class="ol-ring ol-ring-3"></div>'
    + '<div class="ol-ripple ol-ripple-1"></div><div class="ol-ripple ol-ripple-2"></div><div class="ol-ripple ol-ripple-3"></div>'
    + '<div class="ol-match-circle"><svg class="ol-checkmark" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg></div>'
    + '</div>'
    + '<div class="ol-match-label">'+esc(labelText)+'</div>'
    + '<div class="ol-match-sub">'+esc(subText)+'</div>'
    + '</div>';

  var sentCardHtml = '<div class="ol-record-card ol-card-sent">'
    + '<div class="ol-card-label sent">Your record</div>'
    + '<div class="ol-card-body">'
    + '<div class="ol-card-thumb"><img src="'+esc(sentThumb)+'" alt="" loading="lazy"></div>'
    + '<div class="ol-card-meta-wrap"><div class="ol-card-member" style="color:'+sentColor+'">'+esc(sentMemberDisplay)+'</div>'
    + '<div class="ol-card-title">'+esc(sent.title)+'</div>'
    + '<div class="ol-card-date">'+esc(sent.date||'')+'</div></div></div></div>';

  var connectorHtml = '<div class="ol-connector"><svg viewBox="0 0 20 28" fill="none"><line x1="10" y1="0" x2="10" y2="28" stroke="rgba(108,92,231,.2)" stroke-width="1" stroke-dasharray="3 3"/><circle cx="10" cy="14" r="3" fill="none" stroke="rgba(93,201,168,.3)" stroke-width="1"/><circle cx="10" cy="14" r="1" fill="rgba(93,201,168,.5)"/></svg></div>';

  var receivedCardHtml = '';
  if(received){
    var recVid = ytId(received.url || '');
    var recThumb = recVid ? 'https://img.youtube.com/vi/'+recVid+'/mqdefault.jpg' : '';
    var recMemberDisplay = olGetMemberDisplay(received.member);
    var recColor = getMemberColor(received.member);

    receivedCardHtml = '<div class="ol-record-card ol-card-received">'
      + '<div class="ol-card-label received">' + esc(isFallback ? t('olDriftCardLabel') : 'Received record') + '</div>'
      + '<div class="ol-card-body">'
      + '<div class="ol-card-thumb"><img src="'+esc(recThumb)+'" alt="" loading="lazy">'
      + '<div class="ol-mini-disc"></div></div>'
      + '<div class="ol-card-meta-wrap"><div class="ol-card-member" style="color:'+recColor+'">'+esc(recMemberDisplay)+'</div>'
      + '<div class="ol-card-title">'+esc(received.title)+'</div>'
      + '<div class="ol-card-date">'+esc(received.date||'')+'</div></div></div>';

    if(!isFallback && received.time_ago_seconds != null){
      receivedCardHtml += '<div class="ol-time-badge"><div class="ol-pulse-dot"></div><span>Sent '+esc(olFormatTimeAgo(received.time_ago_seconds))+' ago</span></div>';
    }
    if(received.mood_tags && received.mood_tags.length){
      receivedCardHtml += '<div class="ol-mood-row">'+received.mood_tags.map(function(m){return '<span class="ol-mood-pill">'+esc(m)+'</span>';}).join('')+'</div>';
    }
    if(received.message){
      receivedCardHtml += '<div class="ol-card-msg">'+esc(received.message)+'</div>';
    }
    if(recVid){
      receivedCardHtml += '<button class="ol-yt-btn" onclick="olClickYoutube(\''+esc(received.url)+'\',\''+esc(String(received.video_id))+'\',\''+esc(received.member)+'\')">'
        + '<svg viewBox="0 0 24 24"><polygon points="8,5 20,12 8,19"/></svg>'
        + 'LISTEN ON YOUTUBE</button>';
    }
    receivedCardHtml += '</div>';

    olSetShareData(received.title, olLastExchangeId || '');
  }

  var actionsHtml = '<div class="ol-actions">'
    + (received ? '<button class="ol-action-btn ol-action-primary" onclick="olShareResult()">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>'
      + 'SHARE THIS LINK</button>' : '')
    + '<div class="ol-action-row">'
    + '<button class="ol-action-btn ol-action-secondary" onclick="olResetCompose()">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 105.64-11.36L1 10"/></svg>'
    + 'SEND ANOTHER</button>'
    + '<button class="ol-action-btn ol-action-secondary" onclick="olClose()">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
    + 'CLOSE</button>'
    + '</div></div>';

  var body = document.getElementById('olResultBody');
  body.innerHTML = badgeHtml
    + '<div class="ol-cards-area">' + sentCardHtml + connectorHtml + receivedCardHtml + '</div>'
    + actionsHtml;

  olResetSendingView();
  olShowScreen('olResultScreen');

  olParticles.destroy();
  var pCanvas = document.getElementById('olResultParticles');
  if(pCanvas) olParticles.init(pCanvas);
}

export function olClickYoutube(url, videoId, member){
  _gtag('event','ol_youtube_click',{video_id: videoId, member_name: member});
  window.open(safeUrl(url), '_blank', 'noopener,noreferrer');
}

/* === OL SHARE === */
var olShareData = { text: '', url: '' };

function olSetShareData(receivedTitle, exchangeId) {
  var resultUrl = location.origin + '/result/?id=' + exchangeId;
  var shareText = '#ObserverLink で「' + (receivedTitle || '曲') + '」を受け取りました！';
  olShareData = { text: shareText, url: resultUrl };
  document.title = shareText;
}

export function olShareResult(){
  if (!olShareData.url) return;
  var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile && navigator.share) {
    navigator.share({ title: 'Observer-Link', text: olShareData.text, url: olShareData.url })
      .then(function() { _gtag('event', 'ol_share', { method: 'share_api' }); })
      .catch(function(e) { if (e.name !== 'AbortError') window.openShareDialog(); });
  } else {
    window.openShareDialog();
  }
}

export function openShareDialog() {
  var ov = document.getElementById('olShareOverlay');
  if (!ov) return;
  var xLink = document.getElementById('olShareX');
  if (xLink) xLink.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(olShareData.text) + '&url=' + encodeURIComponent(olShareData.url);
  var urlInput = document.getElementById('olShareUrl');
  if (urlInput) urlInput.value = olShareData.url;
  ov.classList.add('open');
  ov.querySelector('.ol-share-backdrop').onclick = window.closeShareDialog;
}

export function closeShareDialog() {
  var ov = document.getElementById('olShareOverlay');
  if (ov) ov.classList.remove('open');
}

export function olShareToDiscord() {
  navigator.clipboard.writeText(olShareData.text + '\n' + olShareData.url).then(function() {
    olShowToast('Copied for Discord!');
    window.closeShareDialog();
    _gtag('event', 'ol_share', { method: 'discord' });
  }).catch(function() { olShowToast('Copy failed'); });
}

export function olCopyShareUrl() {
  navigator.clipboard.writeText(olShareData.url).then(function() {
    olShowToast('Link copied!');
    window.closeShareDialog();
    _gtag('event', 'ol_share', { method: 'copy_url' });
  }).catch(function() { olShowToast('Copy failed'); });
}

export function olTrackXShare() {
  _gtag('event', 'ol_share', { method: 'x_intent' });
}

export function olResetCompose(){
  olParticles.destroy();
  olSendingParticles.destroy();
  olResetSendingView();
  olSelectedSong = null;
  olSelectedMoods = [];
  olSending = false;
  document.getElementById('olSongPlaceholder').style.display = 'flex';
  document.getElementById('olSongSelected').style.display = 'none';
  document.getElementById('olSongSelect').classList.remove('has-song');
  const msgInput = document.getElementById('olMsgInput');
  if(msgInput) msgInput.value = '';
  document.getElementById('olMsgCount').textContent = '0/20';
  document.querySelectorAll('.ol-mood-tag').forEach(t => t.classList.remove('selected'));
  olUpdateSendBtn();
  olShowScreen('olComposeScreen');
  document.title = 'V.W.P ARCHIVE';
  olShareData = { text: '', url: '' };
}

function olSaveReceivedRecord(videoId){
  try {
    let received = JSON.parse(localStorage.getItem(OL_RECEIVED_KEY) || '[]');
    received = received.filter(id => id !== videoId);
    received.unshift(videoId);
    if(received.length > 10) received = received.slice(0, 10);
    localStorage.setItem(OL_RECEIVED_KEY, JSON.stringify(received));
  } catch(e){}
}

// === SENT BOTTLES（vwp_sent: 再訪フック） ===
// 要素 {id: uuid, at: epoch_ms, st: 'waiting'|'picked'|'done'}。新しい順・最大10件。
function olGetSentBottles(){
  try {
    const sent = JSON.parse(localStorage.getItem(OL_SENT_KEY) || '[]');
    if(!Array.isArray(sent)) return [];
    // プルーニング: 30日超のwaitingはdone化 + 10件truncate
    const now = Date.now();
    return sent
      .filter(b => b && typeof b.id === 'string')
      .map(b => (b.st === 'waiting' && now - (b.at || 0) > OL_SENT_WAITING_MAX_MS) ? { id: b.id, at: b.at, st: 'done' } : b)
      .slice(0, OL_SENT_MAX);
  } catch(e){ return []; }
}

function olSetSentBottles(list){
  try { localStorage.setItem(OL_SENT_KEY, JSON.stringify(list.slice(0, OL_SENT_MAX))); } catch(e){}
}

function olSaveSentBottle(exchangeId){
  if(!exchangeId) return;
  const sent = olGetSentBottles().filter(b => b.id !== exchangeId);
  sent.unshift({ id: exchangeId, at: Date.now(), st: 'waiting' });
  olSetSentBottles(sent);
}

function olUpdatePickedNotice(sent){
  olPickedBottles = sent.filter(b => b.st === 'picked');
  const notice = document.getElementById('olPickedNotice');
  if(!notice) return;
  if(olPickedBottles.length === 0){
    notice.style.display = 'none';
    return;
  }
  const txt = document.getElementById('olPickedText');
  if(txt) txt.textContent = t('olPickedNotice');
  const viewBtn = document.getElementById('olPickedView');
  if(viewBtn) viewBtn.textContent = t('olPickedView');
  notice.style.display = '';
}

function olCheckSentBottles(){
  const sent = olGetSentBottles();
  olSetSentBottles(sent); // プルーニング結果を書き戻し
  olUpdatePickedNotice(sent);
  const waiting = sent.filter(b => b.st === 'waiting');
  if(waiting.length === 0) return; // fetchなし
  fetch('/.netlify/functions/observer-link-status?ids=' + waiting.map(b => encodeURIComponent(b.id)).join(','))
    .then(r => r.json())
    .then(data => {
      if(!data || !data.success || !data.statuses) return;
      const updated = olGetSentBottles().map(b => {
        if(b.st !== 'waiting') return b;
        const st = data.statuses[b.id];
        if(st === 'matched') return { id: b.id, at: b.at, st: 'picked' };
        if(st === 'fallback_matched') return { id: b.id, at: b.at, st: 'done' };
        return b; // waiting据え置き（欠落idも据え置き→30日プルーニングでdone化）
      });
      olSetSentBottles(updated);
      olUpdatePickedNotice(updated);
    })
    .catch(() => {});
}

function olPickedViewTap(){
  const b = olPickedBottles[0];
  if(!b) return;
  _gtag('event','ol_bottle_picked_tap');
  olSetSentBottles(olGetSentBottles().map(x => x.id === b.id ? { id: x.id, at: x.at, st: 'done' } : x));
  location.href = '/result/?id=' + encodeURIComponent(b.id); // 既存経路（憲法7）
}

function olPickedDismissTap(){
  const ids = olPickedBottles.map(b => b.id);
  const updated = olGetSentBottles().map(x => ids.includes(x.id) ? { id: x.id, at: x.at, st: 'done' } : x);
  olSetSentBottles(updated);
  olUpdatePickedNotice(updated);
}

function olShowToast(msg){
  const t = document.getElementById('olToast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// === OL QUICK SEND ===
const OL_QS_SVG = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none"><circle cx="4" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3"/><line x1="6.5" y1="8" x2="9.5" y2="8" stroke="currentColor" stroke-width="1.2" stroke-dasharray="1.5 1.5"/></svg>';

export function olQuickSendHtml(id){
  return '<button class="ol-quick-send-btn" title="Observer-Link" aria-label="Observer-Linkで送る" data-vid="'+id+'" onclick="olQuickSend('+id+',this,event)">'+OL_QS_SVG+'</button>';
}

export function olQuickSend(videoId, btnEl, evt){
  const videos = getVideos();
  if(evt){ evt.stopPropagation(); evt.preventDefault(); }
  if(btnEl.classList.contains('sending') || btnEl.classList.contains('sent')) return;

  var source = 'grid';
  if(btnEl.closest('.mc-card')) source = 'mobile_card';
  else if(btnEl.closest('.vlist') || btnEl.closest('.litem')) source = 'list';
  else if(btnEl.closest('.tl')) source = 'timeline';

  btnEl.classList.add('sending');

  var song = videos.find(function(v){ return String(v.id) === String(videoId); });
  _gtag('event','ol_quick_send',{
    video_id: String(videoId),
    member_name: song ? song.member : '',
    source: source
  });

  var headers = {'Content-Type':'application/json'};
  if(getIsAdmin()){ var pw = getStoredPw(); if(pw) headers['x-admin-key'] = pw; }

  fetch('/.netlify/functions/observer-link-exchange', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ video_id: Number(videoId), mood_tags: [], message: null })
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    if(!data.success){
      btnEl.classList.remove('sending');
      var errMsg = data.error === 'RATE_LIMIT_EXCEEDED' ? 'Daily limit reached (10/10)' : 'Something went wrong';
      olShowToast(errMsg);
      return;
    }

    olDailyUsed = data.daily_used != null ? data.daily_used : (olDailyUsed + 1);
    olUpdateSendBtn();

    if(data.received && !data.is_fallback){
      olSaveReceivedRecord(data.received.video_id);
    }

    btnEl.classList.remove('sending');
    btnEl.classList.add('sent');

    if(data.is_fallback){
      _gtag('event','ol_match_fallback',{sent_video_id:String(videoId),received_video_id:data.received?String(data.received.video_id):''});
    } else {
      _gtag('event','ol_match_success',{sent_video_id:String(videoId),received_video_id:data.received?String(data.received.video_id):'',time_ago_seconds:data.received?.time_ago_seconds||0});
    }

    olLastExchangeId = data.exchange_id;
    olLastReceived = data.received;
    // fallback時のみ再訪フックに保存（olSendRecordと同条件）
    if(data.is_fallback === true) olSaveSentBottle(data.exchange_id);

    var screen = document.getElementById('observer-link-screen');
    if(screen){ screen.style.display = ''; screen.classList.add('ol-open'); }
    document.body.style.overflow = 'hidden';

    olResetSendingView();
    olShowScreen('olSendingScreen');
    olShowSendingCard(song);
    var qsCanvas = document.getElementById('ol-sending-particles');
    if(qsCanvas) olSendingParticles.init(qsCanvas);
    document.getElementById('olAmbientGlow')?.classList.add('bright');

    setTimeout(function(){
      var view = document.getElementById('olSendingScreen');
      var title = document.getElementById('olSendingTitle');
      var sub = document.getElementById('olSendingSub');
      if(view) view.classList.add('matched');
      if(title){ title.textContent = 'LINK ESTABLISHED'; title.style.color = '#22c55e'; }
      if(sub) sub.textContent = 'A record from another observer';
      setTimeout(function(){
        olSending = false;
        olUpdateSendBtn();
        olResetSendingView();
        olShowResult(data);
        document.getElementById('olAmbientGlow')?.classList.remove('bright');
      }, 1300);
    }, 800);
  })
  .catch(function(){
    btnEl.classList.remove('sending');
    olShowToast('Network error — please try again');
  });
}
