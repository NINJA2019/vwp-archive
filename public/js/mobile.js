// mobile.js — モバイル S-CURVE UI（app.js L1387-1958 相当）
// 注: window.* で shelf/OL 関数を参照（循環依存回避）

import { _gtag, getVideos, ytId, parseTags, parseMembers, esc, safeUrl, fmtDate, getDailyPicks } from './core.js';
import { mbr } from './i18n.js';

export function initMobile(){
  if(window.innerWidth > 700) return;

  const intro = document.getElementById('ttIntro');
  if(intro) intro.style.display = 'none';
  const mobWelcome = document.getElementById('mobWelcome');
  if(!mobWelcome) return;
  mobWelcome.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';
  const preventScroll = e => { if(!e.target.closest('#mobWelcome') && !e.target.closest('#mobCardView') && !e.target.closest('#mobShelf')) e.preventDefault(); };
  document.addEventListener('touchmove', preventScroll, { passive: false });

  // --- WELCOME: S-curve wheel ---
  const MW_MEMBERS = [
    {id:'vwp',    label:'V.W.P',    img:'/icons/V_W_P.png',        color:'#c4b5fd', glow:'rgba(196,181,253,.35)'},
    {id:'kafu',   label:'KAF',      img:'/icons/KAF.png',          color:'#ffb7c5', glow:'rgba(255,183,197,.35)'},
    {id:'rime',   label:'RIM',      img:'/icons/RIM.png',          color:'#7eb8f7', glow:'rgba(126,184,247,.35)'},
    {id:'harusar',label:'HARU',     img:'/icons/Harusaruhi.png',   color:'#ff7070', glow:'rgba(255,112,112,.35)'},
    {id:'isekai', label:'JOUCHO',   img:'/icons/isekaijocho.png',  color:'#d8d8d8', glow:'rgba(220,220,220,.25)'},
    {id:'koko',   label:'KOKO',     img:'/icons/koko.png',         color:'#c084fc', glow:'rgba(192,132,252,.35)'},
    {id:'all',    label:'ALL',      img:null,                      color:'#b0b8ff', glow:'rgba(176,184,255,.35)'},
  ];
  const MWN = MW_MEMBERS.length;
  const MW_CENTER=110, MW_SMALL=56, MW_TINY=38, MW_VSPACE=120, MW_AMP=70;
  let mwIdx=0, mwOffset=0, mwMomentum=0, mwDragging=false, mwTouchY=0, mwAF=null;

  const mwScroll   = document.getElementById('mwScroll');
  const mwGlow     = document.getElementById('mwGlow');
  const mwCurve    = document.getElementById('mwCurve');
  const mwEnter    = document.getElementById('mwEnter');
  const mwDaily    = document.getElementById('mwDaily');
  const mwTrans    = document.getElementById('mwTrans');
  const mwTransTxt = document.getElementById('mwTransText');

  // Create items
  const mwItems = MW_MEMBERS.map((m, i) => {
    const el = document.createElement('div');
    el.className = 'mw-item';
    const circle = document.createElement('div');
    circle.className = 'mw-circle';
    circle.id = 'mwCircle-'+i;
    if(m.img){
      const img = document.createElement('img');
      img.src = m.img; img.alt = m.label;
      img.onerror = function(){ this.style.display='none'; };
      circle.appendChild(img);
    } else {
      circle.style.background = 'linear-gradient(135deg,#2a2870,#1a1040)';
      circle.style.fontSize = '32px';
      circle.textContent = '◆';
    }
    const ring = document.createElement('div');
    ring.className = 'mw-ring'; ring.id = 'mwRing-'+i;
    circle.appendChild(ring);
    const label = document.createElement('div');
    label.className = 'mw-label'; label.id = 'mwLabel-'+i;
    label.textContent = m.label;
    el.appendChild(circle); el.appendChild(label);
    el.addEventListener('click', () => {
      const diff = i - mwIdx;
      let shortest = diff;
      if(Math.abs(diff - MWN) < Math.abs(shortest)) shortest = diff - MWN;
      if(Math.abs(diff + MWN) < Math.abs(shortest)) shortest = diff + MWN;
      mwOffset = 0; mwIdx = i; mwMomentum = 0;
      mwRender(true);
    });
    mwScroll.appendChild(el);
    return el;
  });

  let mwPathDrawn = false;
  function mwRender(smooth){
    const rect = mwScroll.getBoundingClientRect();
    const cy = rect.height / 2, cx = rect.width * 0.55;
    if(!mwPathDrawn){ mwDrawPath(rect.width, rect.height, cx); mwPathDrawn = true; }
    const m = MW_MEMBERS[mwIdx];
    mwGlow.style.setProperty('--mw-glow-color', m.color);

    mwItems.forEach((el, i) => {
      let dist = i - mwIdx + mwOffset;
      while(dist > MWN/2) dist -= MWN;
      while(dist < -MWN/2) dist += MWN;
      const y = cy + dist * MW_VSPACE;
      const xOff = Math.sin(dist * 0.8) * MW_AMP;
      const x = cx + xOff;
      const ad = Math.abs(dist);
      let size, opacity;
      if(ad < 0.3){ size=MW_CENTER; opacity=1; }
      else if(ad < 1.3){ const t=(ad-0.3)/1; size=MW_CENTER-(MW_CENTER-MW_SMALL)*t; opacity=1-0.3*t; }
      else if(ad < 2.3){ const t=(ad-1.3)/1; size=MW_SMALL-(MW_SMALL-MW_TINY)*t; opacity=0.7-0.35*t; }
      else { size=MW_TINY; opacity=Math.max(0,0.35-(ad-2.3)*0.3); }
      if(ad > 3.2) opacity = 0;

      el.style.transition = smooth ? 'all .45s cubic-bezier(.22,1,.36,1)' : 'none';
      el.style.left = x+'px'; el.style.top = y+'px';
      el.style.transform = 'translate(-50%,-50%)';
      el.style.opacity = opacity;
      el.style.zIndex = Math.round(10 - ad);

      const circleEl = document.getElementById('mwCircle-'+i);
      const ringEl = document.getElementById('mwRing-'+i);
      const labelEl = document.getElementById('mwLabel-'+i);
      if(circleEl){ circleEl.style.width=size+'px'; circleEl.style.height=size+'px'; }
      const isActive = ad < 0.3;
      if(ringEl){
        ringEl.style.borderColor = isActive ? m.color : 'transparent';
        ringEl.style.boxShadow = isActive ? '0 0 20px '+m.glow : 'none';
      }
      if(labelEl){
        labelEl.style.opacity = isActive ? '1' : '0';
        labelEl.style.fontSize = isActive ? 'clamp(24px,7vw,36px)' : '0px';
        labelEl.style.color = isActive ? m.color : 'transparent';
        labelEl.style.letterSpacing = isActive ? '3px' : '0px';
      }
    });
  }

  function mwDrawPath(w, h, cx){
    const cy = h/2, pts = [];
    for(let d=-3.5; d<=3.5; d+=0.1){
      pts.push({x: cx + Math.sin(d*0.8)*MW_AMP, y: cy + d*MW_VSPACE});
    }
    let pathD = 'M '+pts[0].x+' '+pts[0].y;
    for(let i=1;i<pts.length;i++) pathD += ' L '+pts[i].x+' '+pts[i].y;
    mwCurve.innerHTML = '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" style="position:absolute;top:0;left:0"><defs><linearGradient id="mwPG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="white" stop-opacity="0"/><stop offset="30%" stop-color="white" stop-opacity=".04"/><stop offset="50%" stop-color="white" stop-opacity=".06"/><stop offset="70%" stop-color="white" stop-opacity=".04"/><stop offset="100%" stop-color="white" stop-opacity="0"/></linearGradient></defs><path d="'+pathD+'" fill="none" stroke="url(#mwPG)" stroke-width="1.5"/></svg>';
  }

  // Touch/mouse for S-curve
  mwScroll.addEventListener('touchstart', e => {
    mwTouchY = e.touches[0].clientY; mwDragging = true; mwMomentum = 0;
    if(mwAF) cancelAnimationFrame(mwAF);
  }, {passive:true});
  mwScroll.addEventListener('touchmove', e => {
    if(!mwDragging) return;
    const y = e.touches[0].clientY, dy = y - mwTouchY;
    mwTouchY = y;
    mwOffset += dy / MW_VSPACE;
    mwMomentum = dy / MW_VSPACE;
    while(mwOffset >= 0.5){ mwOffset -= 1; mwIdx = (mwIdx - 1 + MWN) % MWN; }
    while(mwOffset <= -0.5){ mwOffset += 1; mwIdx = (mwIdx + 1) % MWN; }
    mwRender(false);
  }, {passive:true});
  mwScroll.addEventListener('touchend', () => { mwDragging = false; mwDecel(); });

  mwScroll.addEventListener('mousedown', e => {
    mwTouchY = e.clientY; mwDragging = true; mwMomentum = 0;
    if(mwAF) cancelAnimationFrame(mwAF);
    const mv = ev => {
      const dy = ev.clientY - mwTouchY; mwTouchY = ev.clientY;
      mwOffset += dy / MW_VSPACE; mwMomentum = dy / MW_VSPACE;
      while(mwOffset >= 0.5){ mwOffset -= 1; mwIdx = (mwIdx - 1 + MWN) % MWN; }
      while(mwOffset <= -0.5){ mwOffset += 1; mwIdx = (mwIdx + 1) % MWN; }
      mwRender(false);
    };
    const up = () => { mwDragging = false; mwDecel(); document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up); };
    document.addEventListener('mousemove',mv);
    document.addEventListener('mouseup',up);
  });

  function mwDecel(){
    if(Math.abs(mwMomentum) < 0.005 && Math.abs(mwOffset) < 0.01){ mwOffset = 0; mwRender(true); return; }
    mwOffset += mwMomentum; mwMomentum *= 0.88;
    while(mwOffset >= 0.5){ mwOffset -= 1; mwIdx = (mwIdx - 1 + MWN) % MWN; }
    while(mwOffset <= -0.5){ mwOffset += 1; mwIdx = (mwIdx + 1) % MWN; }
    if(Math.abs(mwMomentum) < 0.01) mwOffset *= 0.7;
    mwRender(false);
    mwAF = requestAnimationFrame(mwDecel);
  }

  // Buttons
  mwEnter.addEventListener('click', () => mwTransition(MW_MEMBERS[mwIdx]));
  mwDaily.addEventListener('click', () => {
    _gtag('event','mob_observer_link_open',{member_name: MW_MEMBERS[mwIdx]?.id || 'all'});
    mwTransTxt.textContent = 'OBSERVER-LINK';
    mwTransTxt.style.color = '#c4b5fd';
    mwTrans.classList.add('active');
    setTimeout(() => {
      mwTrans.classList.remove('active');
      mobWelcome.style.display = 'none';
      if(typeof window.openObserverLink === 'function') window.openObserverLink();
    }, 800);
  });

  function mwTransition(m){
    mwTransTxt.textContent = m.label;
    mwTransTxt.style.color = m.color;
    mwTrans.classList.add('active');
    _gtag('event','mob_welcome_select',{member_name:m.id});
    setTimeout(() => {
      mwTrans.classList.remove('active');
      mobWelcome.style.display = 'none';
      // Launch card view
      mcSelectedMember = m.id;
      mcIsDaily = false;
      mcInit();
      // 入店確定をオンボーディング（店主メモ等）へ通知（onboarding.js が {once:true} で購読）
      document.dispatchEvent(new CustomEvent('vwp:archive-entered'));
    }, 800);
  }

  // Init
  mwRender(false);
  window.addEventListener('resize', () => { if(window.innerWidth <= 700){ mwPathDrawn = false; mwRender(false); } });

  // === MOBILE CARD VIEW ===
  let mcSelectedMember = 'all', mcIsDaily = false;
  let mcFiltered = [], mcIdx = 0, mcActiveTag = 'all';
  let mcTouchStartY = 0, mcTouchCurY = 0, mcDragging = false, mcRafId = 0;

  const mcCardView = document.getElementById('mobCardView');
  const mcTrack    = document.getElementById('mcTrack');
  const mcGlow     = document.getElementById('mcGlow');
  const mcChips    = document.getElementById('mcChips');
  const mcSortCnt  = document.getElementById('mcSortCount');
  const mcProgress = document.getElementById('mcProgress');
  const mcSearch   = document.getElementById('mcSearchInput');
  const mcShelfBtn = document.getElementById('mcShelfBtn');
  const MC_SWIPE_THRESHOLD = 70;

  // Tag list extracted from videos at runtime
  function mcGetTags(){
    const videos = getVideos();
    const tags = new Set();
    videos.forEach(v => parseTags(v).forEach(t => tags.add(t)));
    return ['all', ...Array.from(tags)];
  }

  function mcInit(){
    mcCardView.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    mcIdx = 0; mcActiveTag = 'all';
    if(mcSearch) mcSearch.value = '';
    mcFilter();
  }

  function mcFilter(){
    const videos = getVideos();
    const q = (mcSearch ? mcSearch.value.trim().toLowerCase() : '');
    let pool = [...videos];
    // Member filter
    if(mcIsDaily){
      pool = getDailyPicks ? getDailyPicks() : pool.slice(0,5);
    } else if(mcSelectedMember !== 'all'){
      pool = pool.filter(v => (v.member||'').includes(mcSelectedMember));
    }
    // Tag filter
    if(mcActiveTag !== 'all'){
      pool = pool.filter(v => parseTags(v).includes(mcActiveTag));
    }
    // Search
    if(q){
      pool = pool.filter(v => (v.title||'').toLowerCase().includes(q) || (v.member||'').toLowerCase().includes(q));
    }
    // Sort newest first
    pool.sort((a,b) => (b.date||'').localeCompare(a.date||''));
    mcFiltered = pool;
    mcIdx = 0;
    mcRenderChips();
    mcRenderCards();
    mcUpdateMeta();
  }

  function mcRenderChips(){
    mcChips.innerHTML = '';
    const tags = mcGetTags();
    tags.forEach(tag => {
      const el = document.createElement('div');
      el.className = 'mc-chip' + (tag === mcActiveTag ? ' mc-active' : '');
      const label = tag === 'all' ? 'すべて' : tag;
      el.innerHTML = '<span class="mc-emoji">' + (tag === 'all' ? '✦' : '#') + '</span>' + esc(label);
      if(tag === mcActiveTag){
        const color = window.getMemberColor ? window.getMemberColor(mcSelectedMember) : '#b0b8ff';
        el.style.borderColor = color + '44';
        el.style.boxShadow = '0 0 12px ' + color + '22';
      }
      el.addEventListener('click', () => {
        mcActiveTag = tag; mcIdx = 0;
        _gtag('event','mob_tag_filter',{tag_name:tag,member_name:mcSelectedMember});
        mcFilter();
      });
      mcChips.appendChild(el);
    });
  }

  function mcRenderCards(){
    mcTrack.innerHTML = '';
    if(mcFiltered.length === 0){
      mcTrack.innerHTML = '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px"><svg width="40" height="40" viewBox="0 0 24 24" stroke="rgba(255,255,255,.15)" stroke-width="1.2" fill="none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span style="font-family:\'Shippori Mincho\',serif;font-size:14px;color:rgba(232,236,248,.45)">該当する曲がありません</span></div>';
      return;
    }
    const count = Math.min(3, mcFiltered.length);
    for(let i = count-1; i >= 0; i--){
      const idx = (mcIdx + i) % mcFiltered.length;
      mcTrack.appendChild(mcCreateCard(mcFiltered[idx], i));
    }
    const cur = mcFiltered[mcIdx % mcFiltered.length];
    const color = window.getMemberColor ? window.getMemberColor(cur.member) : '#b0b8ff';
    mcGlow.style.setProperty('--mc-glow-color', color);
    mcCardView.style.setProperty('--mc-active', color);
    const front = mcTrack.querySelector('[data-pos="0"]');
    if(front) mcAttachSwipe(front);
  }

  function mcCreateCard(song, pos){
    const color = window.getMemberColor ? window.getMemberColor(song.member) : '#b0b8ff';
    const card = document.createElement('div');
    card.className = 'mc-card';
    card.dataset.pos = pos <= 2 ? pos : 'hide';
    card.dataset.sid = song.id;
    const vid = ytId(song.url);
    const thumbUrl = vid ? 'https://img.youtube.com/vi/'+vid+'/mqdefault.jpg' : '';
    const memberLabel = parseMembers(song).map(mid => mbr(mid)).join(', ') || song.member || '';
    const tags = parseTags(song);

    // LP disc (lazy — drawn on first tap)
    const lpWrap = document.createElement('div');
    lpWrap.className = 'mc-lp-wrap';

    card.innerHTML = '<div class="mc-card-inner">' +
      '<div class="mc-card-thumb"><img src="'+esc(thumbUrl)+'" alt="'+esc(song.title||'')+'" loading="lazy" onerror="this.parentElement.style.background=\'#111627\'"></div>' +
      '<div class="mc-card-info">' +
        '<div class="mc-card-color-bar" style="background:linear-gradient(90deg,'+color+',transparent)"></div>' +
        '<div class="mc-card-member" style="color:'+color+'">'+esc(memberLabel)+'</div>' +
        '<div class="mc-card-title">'+esc(song.title||'')+'</div>' +
        '<div class="mc-card-date">'+esc(fmtDate(song.date))+'</div>' +
        '<div class="mc-card-tags">'+tags.map(t => '<span class="mc-card-tag">'+esc(t)+'</span>').join('')+'</div>' +
      '</div>' +
      '<div class="mc-card-pin'+(window.isOnShelf && window.isOnShelf(song.id) ? ' mc-pinned' : '')+'" role="button" aria-label="棚に追加">' +
        '<svg viewBox="0 0 24 24"><path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 8 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8z"/><circle cx="12" cy="10" r="2.5" fill="none"/></svg>' +
      '</div>' +
      '<div class="mc-card-ol" role="button" aria-label="Observer-Linkで送る" data-vid="'+song.id+'">' +
        '<svg viewBox="0 0 16 16" width="16" height="16" fill="none"><circle cx="4" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3"/><line x1="6.5" y1="8" x2="9.5" y2="8" stroke="currentColor" stroke-width="1.2" stroke-dasharray="1.5 1.5"/></svg>' +
      '</div>' +
      '<div class="mc-card-cta" role="button">' +
        '<svg viewBox="0 0 24 24"><polygon points="8,5 20,12 8,19"/></svg>' +
        '<span>YOUTUBE</span>' +
      '</div>' +
    '</div>';

    card.appendChild(lpWrap);

    // Tap → LP peek (lazy canvas draw)
    card.addEventListener('click', e => {
      if(Math.abs(mcTouchCurY - mcTouchStartY) > 15) return;
      if(e.target.closest('.mc-card-pin') || e.target.closest('.mc-card-ol') || e.target.closest('.mc-card-cta')) return;
      if(!lpWrap.querySelector('canvas') && window.drawVinylDisc){
        const canvas = document.createElement('canvas');
        window.drawVinylDisc(canvas, color, 140);
        lpWrap.appendChild(canvas);
      }
      card.classList.toggle('mc-lp-peek');
      _gtag('event','mob_card_tap',{song_title:song.title||'',member_name:song.member||''});
    });

    // Pin
    const pinBtn = card.querySelector('.mc-card-pin');
    pinBtn.addEventListener('click', e => {
      e.stopPropagation();
      if(window.isOnShelf && window.isOnShelf(song.id)){
        if(window.removeFromShelf) window.removeFromShelf(song.id);
        pinBtn.classList.remove('mc-pinned');
      } else {
        if(window.addToShelf) window.addToShelf(song.id);
        pinBtn.classList.add('mc-pinned');
      }
    });

    // OL Quick Send
    const olBtn = card.querySelector('.mc-card-ol');
    if(olBtn){
      olBtn.addEventListener('click', e => {
        e.stopPropagation();
        if(window.olQuickSend) window.olQuickSend(song.id, olBtn, e);
      });
    }

    // CTA → YouTube
    const cta = card.querySelector('.mc-card-cta');
    cta.addEventListener('click', e => {
      e.stopPropagation();
      if(song.url) window.open(safeUrl(song.url), '_blank');
    });

    return card;
  }

  function mcApplyDrag(el, dy){
    el.style.transform = 'translateY('+dy+'px) scale('+Math.max(.95,1-Math.abs(dy)/800)+') rotate('+dy*-0.02+'deg)';
    el.style.opacity = Math.max(.3,1-Math.abs(dy)/400);
  }
  function mcSwipeEnd(el){
    mcDragging = false;
    if(mcRafId){ cancelAnimationFrame(mcRafId); mcRafId = 0; }
    el.style.willChange = '';
    const dy = mcTouchCurY - mcTouchStartY;
    el.style.transition = '';
    if(Math.abs(dy) > MC_SWIPE_THRESHOLD){
      const dir = dy < 0 ? 'up' : 'down';
      el.classList.add(dy < 0 ? 'mc-out-up' : 'mc-out-down');
      _gtag('event','mob_card_swipe',{direction:dir,song_title:mcFiltered[mcIdx%mcFiltered.length]?.title||''});
      setTimeout(() => {
        if(dy < 0){ mcIdx = (mcIdx + 1) % mcFiltered.length; }
        else { mcIdx = (mcIdx - 1 + mcFiltered.length) % mcFiltered.length; }
        mcRenderCards(); mcUpdateMeta();
      }, 300);
    } else { el.style.transform = ''; el.style.opacity = ''; }
  }
  function mcAttachSwipe(card){
    card.addEventListener('touchstart', function(e){
      mcTouchStartY = e.touches[0].clientY; mcTouchCurY = mcTouchStartY;
      mcDragging = true;
      this.style.transition = 'none';
      this.style.willChange = 'transform,opacity';
    }, {passive:true});
    card.addEventListener('touchmove', function(e){
      if(!mcDragging) return;
      mcTouchCurY = e.touches[0].clientY;
      if(mcRafId) return;
      const el = this;
      mcRafId = requestAnimationFrame(() => {
        mcRafId = 0;
        mcApplyDrag(el, mcTouchCurY - mcTouchStartY);
      });
    }, {passive:true});
    card.addEventListener('touchend', function(){ if(mcDragging) mcSwipeEnd(this); });
    // Mouse fallback
    card.addEventListener('mousedown', function(e){
      mcTouchStartY = e.clientY; mcTouchCurY = mcTouchStartY;
      mcDragging = true;
      this.style.transition = 'none';
      this.style.willChange = 'transform,opacity';
      const self = this;
      const mv = ev => {
        mcTouchCurY = ev.clientY;
        if(mcRafId) return;
        mcRafId = requestAnimationFrame(() => {
          mcRafId = 0;
          mcApplyDrag(self, mcTouchCurY - mcTouchStartY);
        });
      };
      const up = () => {
        if(mcDragging) mcSwipeEnd(self);
        document.removeEventListener('mousemove',mv);
        document.removeEventListener('mouseup',up);
      };
      document.addEventListener('mousemove',mv);
      document.addEventListener('mouseup',up);
    });
  }

  function mcUpdateMeta(){
    mcSortCnt.innerHTML = '<b>'+mcFiltered.length+'</b> 曲';
    if(mcFiltered.length > 0){
      mcProgress.innerHTML = '<b>'+(mcIdx%mcFiltered.length+1)+'</b> / '+mcFiltered.length;
    } else {
      mcProgress.innerHTML = '—';
    }
  }

  if(mcSearch) mcSearch.addEventListener('input', () => mcFilter());

  // Card view header buttons
  if(mcShelfBtn) mcShelfBtn.addEventListener('click', () => msInit());
  const mcBackBtn = document.getElementById('mcBackBtn');
  if(mcBackBtn) mcBackBtn.addEventListener('click', () => {
    _gtag('event','mob_back_to_welcome',{member_name:mcSelectedMember});
    mcCardView.style.display = 'none';
    mobWelcome.style.display = 'flex';
    mwRender(true);
  });

  // === MOBILE SHELF ===
  let msSongs = [], msAct = 0, msST;

  const mobShelf = document.getElementById('mobShelf');
  const msCar    = document.getElementById('msCar');
  const msGlow   = document.getElementById('msGlow');
  const msCnt    = document.getElementById('msCnt');
  const msDet    = document.getElementById('msDet');
  const msDI     = document.getElementById('msDI');
  const msDM     = document.getElementById('msDM');
  const msDT     = document.getElementById('msDT');
  const msDD     = document.getElementById('msDD');
  const msDG     = document.getElementById('msDG');
  const msCW     = document.getElementById('msCW');

  function msInit(){
    const shelfIds = window.getShelf ? window.getShelf() : [];
    const videos = getVideos();
    msSongs = shelfIds.map(id => videos.find(v => v.id === id)).filter(Boolean);
    msAct = 0;
    mobShelf.style.display = 'flex';
    mcCardView.style.display = 'none';
    msRender();
    if(msSongs.length) msSetAct(0);
  }

  function msRender(){
    clearTimeout(msST);
    msCar.innerHTML = ''; msDet.classList.remove('ms-open');
    if(!msSongs.length){
      msCW.innerHTML = '<div class="ms-empty"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg><p>棚はまだ空です<br>曲カードの📌ボタンで追加</p></div>';
      msCnt.innerHTML = '<b>0</b> / 10'; return;
    }
    msCnt.innerHTML = '<b>'+msSongs.length+'</b> / 10';
    msSongs.forEach((s, i) => {
      const c = window.getMemberColor ? window.getMemberColor(s.member) : '#c4b5fd';
      const vid = ytId(s.url);
      const thumbUrl = vid ? 'https://img.youtube.com/vi/'+vid+'/mqdefault.jpg' : '';
      const memberLabel = parseMembers(s).map(mid => mbr(mid)).join(', ') || s.member || '';
      const el = document.createElement('div');
      el.className = 'ms-jk' + (i === msAct ? ' ms-active' : '');
      el.innerHTML = '<div class="ms-jk-img"><img src="'+esc(thumbUrl)+'" alt="'+esc(s.title||'')+'"><div class="ms-jk-bar" style="background:linear-gradient(90deg,'+c+',transparent)"></div></div><div class="ms-jk-info"><div class="ms-jk-mem" style="color:'+c+'">'+esc(memberLabel)+'</div><div class="ms-jk-tit">'+esc(s.title||'')+'</div></div>';
      el.addEventListener('click', () => msSetAct(i));
      msCar.appendChild(el);
    });
    msUpdateGlow();
  }

  function msSetAct(i){
    if(i < 0 || i >= msSongs.length) return;
    msAct = i;
    msCar.querySelectorAll('.ms-jk').forEach((el, j) => el.classList.toggle('ms-active', j === i));
    const t = msCar.querySelectorAll('.ms-jk')[i];
    if(t) t.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
    msShowDet(msSongs[i]); msUpdateGlow();
  }

  function msUpdateGlow(){ if(msSongs.length && msSongs[msAct]) msGlow.style.setProperty('--ms-glow-color', window.getMemberColor ? window.getMemberColor(msSongs[msAct].member) : '#c4b5fd'); }

  function msShowDet(s){
    if(!s) return;
    const c = window.getMemberColor ? window.getMemberColor(s.member) : '#c4b5fd';
    const vid = ytId(s.url);
    msDI.src = vid ? 'https://img.youtube.com/vi/'+vid+'/mqdefault.jpg' : '';
    const memberLabel = parseMembers(s).map(mid => mbr(mid)).join(', ') || s.member || '';
    msDM.textContent = memberLabel; msDM.style.color = c;
    msDT.textContent = s.title || '';
    msDD.textContent = fmtDate(s.date);
    msDG.innerHTML = '';
    parseTags(s).forEach(tag => { const sp = document.createElement('span'); sp.className = 'ms-det-tag'; sp.textContent = tag; msDG.appendChild(sp); });
    msDet.classList.add('ms-open');
  }

  // Scroll snap → update active
  msCar.addEventListener('scroll', () => { clearTimeout(msST); msST = setTimeout(() => {
    const jks = msCar.querySelectorAll('.ms-jk'), cc = msCar.scrollLeft + msCar.offsetWidth/2;
    let cl = 0, md = Infinity;
    jks.forEach((el, i) => { const d = Math.abs(el.offsetLeft + el.offsetWidth/2 - cc); if(d < md){ md = d; cl = i; } });
    if(cl !== msAct) msSetAct(cl);
  }, 80); });

  // Shelf back button → card view
  const msBackBtn = document.getElementById('msBackBtn');
  if(msBackBtn) msBackBtn.addEventListener('click', () => {
    mobShelf.style.display = 'none';
    mcCardView.style.display = 'flex';
    mcRenderCards(); mcUpdateMeta();
  });

  // YouTube button
  document.getElementById('msBY')?.addEventListener('click', () => {
    if(msSongs.length && msSongs[msAct]?.url) window.open(safeUrl(msSongs[msAct].url), '_blank');
  });

  // Remove button
  document.getElementById('msBR')?.addEventListener('click', () => {
    if(!msSongs.length) return;
    const s = msSongs[msAct];
    if(window.removeFromShelf) window.removeFromShelf(s.id);
    msSongs.splice(msAct, 1);
    if(msAct >= msSongs.length) msAct = Math.max(0, msSongs.length - 1);
    msRender(); if(msSongs.length) msSetAct(msAct);
  });
}
