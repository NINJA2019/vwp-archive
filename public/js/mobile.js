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
    mwGlow.style.background = m.color;

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
  let mcAnimating = false;
  let mcDelegationBound = false; // 初回のみ委譲リスナーをバインド

  // カードごとに参照キャッシュを保持する WeakMap
  // 値: { img, colorBar, member, title, date, tags, pin, ol, cta, lpWrap, song, color }
  const mcCardCache = new WeakMap();

  // 画像プリフェッチ用 LRU Map（上限10）
  const mcPrefetchMap = new Map();

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

  // --- 4枚リングバッファ初期化（プール専用） ---
  // 不変条件: data-pos="hide" のカードは常に mcFiltered[(mcIdx+3)%len] を保持
  // プール配置: pos=0 → mcIdx+0, pos=1 → mcIdx+1, pos=2 → mcIdx+2, hide → mcIdx+3
  function mcRenderCards(){
    mcTrack.innerHTML = '';
    mcAnimating = false;

    if(mcFiltered.length === 0){
      mcTrack.innerHTML = '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px"><svg width="40" height="40" viewBox="0 0 24 24" stroke="rgba(255,255,255,.15)" stroke-width="1.2" fill="none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span style="font-family:\'Shippori Mincho\',serif;font-size:14px;color:rgba(232,236,248,.45)">該当する曲がありません</span></div>';
      mcBindDelegation();
      return;
    }

    const len = mcFiltered.length;

    if(len < 4){
      // legacy分岐: 現行ロジック（count枚生成）を維持
      const count = Math.min(3, len);
      for(let i = count-1; i >= 0; i--){
        const idx = (mcIdx + i) % len;
        mcTrack.appendChild(mcCreateCard(mcFiltered[idx], i));
      }
      const cur = mcFiltered[mcIdx % len];
      const color = window.getMemberColor ? window.getMemberColor(cur.member) : '#b0b8ff';
      mcGlow.style.background = color;
      mcCardView.style.setProperty('--mc-active', color);
    } else {
      // 4枚リングバッファ
      // hide は DOM 上で最初に挿入（z-index 最小で背面）
      // 生成順: hide, 2, 1, 0 (後から追加したものが前面レイヤーへ)
      for(const posStr of ['hide', '2', '1', '0']){
        const offset = posStr === 'hide' ? 3 : parseInt(posStr, 10);
        const song = mcFiltered[(mcIdx + offset) % len];
        const card = mcCreateCard(song, posStr === 'hide' ? 99 : parseInt(posStr, 10));
        mcTrack.appendChild(card);
      }
      const cur = mcFiltered[mcIdx % len];
      const color = window.getMemberColor ? window.getMemberColor(cur.member) : '#b0b8ff';
      mcGlow.style.background = color;
      mcCardView.style.setProperty('--mc-active', color);
      mcPrefetch();
    }

    mcBindDelegation();
  }

  // 委譲リスナー（初回のみバインド、フラグガード）
  function mcBindDelegation(){
    if(mcDelegationBound) return;
    mcDelegationBound = true;

    // --- タッチ ---
    mcTrack.addEventListener('touchstart', e => {
      if(mcAnimating) return;
      const front = e.target.closest('.mc-card[data-pos="0"]');
      if(!front) return;
      mcTouchStartY = e.touches[0].clientY;
      mcTouchCurY = mcTouchStartY;
      mcDragging = true;
      front.style.transition = 'none';
      front.style.willChange = 'transform,opacity';
    }, {passive:true});

    mcTrack.addEventListener('touchmove', e => {
      if(!mcDragging) return;
      mcTouchCurY = e.touches[0].clientY;
      if(mcRafId) return;
      const front = mcTrack.querySelector('.mc-card[data-pos="0"]');
      if(!front) return;
      mcRafId = requestAnimationFrame(() => {
        mcRafId = 0;
        mcApplyDrag(front, mcTouchCurY - mcTouchStartY);
      });
    }, {passive:true});

    mcTrack.addEventListener('touchend', () => {
      if(!mcDragging) return;
      const front = mcTrack.querySelector('.mc-card[data-pos="0"]');
      if(front) mcSwipeEnd(front);
    });

    // --- マウスフォールバック ---
    mcTrack.addEventListener('mousedown', e => {
      if(mcAnimating) return;
      const front = e.target.closest('.mc-card[data-pos="0"]');
      if(!front) return;
      mcTouchStartY = e.clientY;
      mcTouchCurY = mcTouchStartY;
      mcDragging = true;
      front.style.transition = 'none';
      front.style.willChange = 'transform,opacity';
      const mv = ev => {
        mcTouchCurY = ev.clientY;
        if(mcRafId) return;
        mcRafId = requestAnimationFrame(() => {
          mcRafId = 0;
          mcApplyDrag(front, mcTouchCurY - mcTouchStartY);
        });
      };
      const up = () => {
        if(mcDragging) mcSwipeEnd(front);
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });

    // --- クリック委譲 ---
    mcTrack.addEventListener('click', e => {
      const card = e.target.closest('.mc-card');
      if(!card) return;
      // ドラッグ判定（縦15px超はスワイプ）
      if(Math.abs(mcTouchCurY - mcTouchStartY) > 15) return;

      const cache = mcCardCache.get(card);
      const song = cache ? cache.song : null;

      // ピンボタン
      if(e.target.closest('.mc-card-pin')){
        const pinBtn = card.querySelector('.mc-card-pin');
        if(!pinBtn || !song) return;
        if(window.isOnShelf && window.isOnShelf(song.id)){
          if(window.removeFromShelf) window.removeFromShelf(song.id);
          pinBtn.classList.remove('mc-pinned');
        } else {
          if(window.addToShelf) window.addToShelf(song.id);
          pinBtn.classList.add('mc-pinned');
        }
        return;
      }

      // OL ボタン
      if(e.target.closest('.mc-card-ol')){
        const olBtn = card.querySelector('.mc-card-ol');
        if(olBtn && song && window.olQuickSend) window.olQuickSend(song.id, olBtn, e);
        return;
      }

      // CTA ボタン
      if(e.target.closest('.mc-card-cta')){
        if(song && song.url) window.open(safeUrl(song.url), '_blank');
        return;
      }

      // 本体タップ → LP ピーク
      const lpWrap = cache ? cache.lpWrap : card.querySelector('.mc-lp-wrap');
      const color  = cache ? cache.color : (window.getMemberColor ? window.getMemberColor(song && song.member) : '#b0b8ff');
      if(!lpWrap || !song) return;
      if(!lpWrap.querySelector('canvas') && window.drawVinylDisc){
        const canvas = document.createElement('canvas');
        window.drawVinylDisc(canvas, color, 140);
        lpWrap.appendChild(canvas);
      }
      card.classList.toggle('mc-lp-peek');
      _gtag('event','mob_card_tap',{song_title:song.title||'',member_name:song.member||''});
    });
  }

  // カード生成（純粋 DOM ファクトリ — リスナーは委譲で付ける、img.error のみ自身に付ける）
  function mcCreateCard(song, posArg){
    const color = window.getMemberColor ? window.getMemberColor(song.member) : '#b0b8ff';
    const card = document.createElement('div');
    card.className = 'mc-card';
    card.dataset.pos = posArg <= 2 ? String(posArg) : 'hide';
    card.dataset.sid = song.id;

    const vid = ytId(song.url);
    const thumbUrl = vid ? 'https://img.youtube.com/vi/'+vid+'/mqdefault.jpg' : '';
    const memberLabel = parseMembers(song).map(mid => mbr(mid)).join(', ') || song.member || '';
    const tags = parseTags(song);

    const inner = document.createElement('div');
    inner.className = 'mc-card-inner';

    // サムネイル
    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'mc-card-thumb';
    const img = document.createElement('img');
    img.src = thumbUrl;
    img.alt = song.title || '';
    img.loading = 'lazy';
    img.addEventListener('error', () => { thumbDiv.style.background = '#111627'; });
    thumbDiv.appendChild(img);

    // info
    const infoDiv = document.createElement('div');
    infoDiv.className = 'mc-card-info';

    const colorBar = document.createElement('div');
    colorBar.className = 'mc-card-color-bar';
    colorBar.style.background = 'linear-gradient(90deg,'+color+',transparent)';

    const memberEl = document.createElement('div');
    memberEl.className = 'mc-card-member';
    memberEl.style.color = color;
    memberEl.textContent = memberLabel;

    const titleEl = document.createElement('div');
    titleEl.className = 'mc-card-title';
    titleEl.textContent = song.title || '';

    const dateEl = document.createElement('div');
    dateEl.className = 'mc-card-date';
    dateEl.textContent = fmtDate(song.date);

    const tagsEl = document.createElement('div');
    tagsEl.className = 'mc-card-tags';
    tagsEl.innerHTML = tags.map(t => '<span class="mc-card-tag">'+esc(t)+'</span>').join('');

    infoDiv.appendChild(colorBar);
    infoDiv.appendChild(memberEl);
    infoDiv.appendChild(titleEl);
    infoDiv.appendChild(dateEl);
    infoDiv.appendChild(tagsEl);

    // ピンボタン
    const pinBtn = document.createElement('div');
    pinBtn.className = 'mc-card-pin' + (window.isOnShelf && window.isOnShelf(song.id) ? ' mc-pinned' : '');
    pinBtn.setAttribute('role', 'button');
    pinBtn.setAttribute('aria-label', '棚に追加');
    pinBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 8 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8z"/><circle cx="12" cy="10" r="2.5" fill="none"/></svg>';

    // OL ボタン
    const olBtn = document.createElement('div');
    olBtn.className = 'mc-card-ol';
    olBtn.setAttribute('role', 'button');
    olBtn.setAttribute('aria-label', 'Observer-Linkで送る');
    olBtn.dataset.vid = song.id;
    olBtn.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none"><circle cx="4" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3"/><line x1="6.5" y1="8" x2="9.5" y2="8" stroke="currentColor" stroke-width="1.2" stroke-dasharray="1.5 1.5"/></svg>';

    // CTA ボタン
    const cta = document.createElement('div');
    cta.className = 'mc-card-cta';
    cta.setAttribute('role', 'button');
    cta.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="8,5 20,12 8,19"/></svg><span>YOUTUBE</span>';

    inner.appendChild(thumbDiv);
    inner.appendChild(infoDiv);
    inner.appendChild(pinBtn);
    inner.appendChild(olBtn);
    inner.appendChild(cta);

    // LP disc (lazy — drawn on first tap)
    const lpWrap = document.createElement('div');
    lpWrap.className = 'mc-lp-wrap';

    card.appendChild(inner);
    card.appendChild(lpWrap);

    // 要素参照とsong/colorをキャッシュ
    mcCardCache.set(card, { img, colorBar, memberEl, titleEl, dateEl, tagsEl, pinBtn, olBtn, cta, lpWrap, song, color });

    return card;
  }

  // ドラッグ中の変形
  function mcApplyDrag(el, dy){
    el.style.transform = 'translateY('+dy+'px) scale('+Math.max(.95,1-Math.abs(dy)/800)+') rotate('+dy*-0.02+'deg)';
    el.style.opacity = Math.max(.3,1-Math.abs(dy)/400);
  }

  // スワイプ確定
  function mcSwipeEnd(el){
    mcDragging = false;
    if(mcRafId){ cancelAnimationFrame(mcRafId); mcRafId = 0; }
    el.style.willChange = '';
    const dy = mcTouchCurY - mcTouchStartY;
    el.style.transition = '';

    if(Math.abs(dy) > MC_SWIPE_THRESHOLD){
      const dir = dy < 0 ? 'up' : 'down';
      const len = mcFiltered.length;

      if(len < 4){
        // legacy: 全再構築
        el.classList.add(dy < 0 ? 'mc-out-up' : 'mc-out-down');
        // GA4: mcIdx 更新前の曲名で送信
        _gtag('event','mob_card_swipe',{direction:dir,song_title:mcFiltered[mcIdx%len]?.title||''});
        setTimeout(() => {
          if(dy < 0){ mcIdx = (mcIdx + 1) % len; }
          else { mcIdx = (mcIdx - 1 + len) % len; }
          mcRenderCards(); mcUpdateMeta();
        }, 300);
      } else {
        // 4枚リング: mcAdvance
        // GA4: mcIdx 更新前（= 確定前）の曲名で送信
        const cache = mcCardCache.get(el);
        const songTitle = (cache && cache.song) ? (cache.song.title || '') : (mcFiltered[mcIdx%len]?.title||'');
        _gtag('event','mob_card_swipe',{direction:dir,song_title:songTitle});

        // 確定フレーム: 新曲色で即更新
        const newIdx = dir === 'up'
          ? (mcIdx + 1) % len
          : (mcIdx - 1 + len) % len;
        const newSong = mcFiltered[newIdx];
        const newColor = window.getMemberColor ? window.getMemberColor(newSong.member) : '#b0b8ff';
        mcGlow.style.background = newColor;
        mcCardView.style.setProperty('--mc-active', newColor);

        // 確定カードから LP ピーク除去
        el.classList.remove('mc-lp-peek');

        mcAnimating = true;
        mcAdvance(dir);
      }
    } else {
      // しきい値未満: スナップ戻し
      el.style.transform = '';
      el.style.opacity = '';
    }
  }

  // --- transition 一時停止手順 ---
  function mcPauseTransition(card, fn){
    card.style.transition = 'none';
    void card.offsetWidth; // reflow で即時適用
    fn();
    requestAnimationFrame(() => { card.style.transition = ''; });
  }

  // --- 4枚リング昇格・降格 ---
  //
  // UP（dir='up'） newIdx = (mcIdx+1)%len
  //   対応表（不変条件検算）:
  //     旧 pos0 (mcIdx+0) → fly mc-out-up → finalize後 mcResetCard → (newIdx+3)%len → data-pos="hide"
  //     旧 pos1 (mcIdx+1) → data-pos="0"    ... mcIdx+1 = newIdx+0 ✓
  //     旧 pos2 (mcIdx+2) → data-pos="1"    ... mcIdx+2 = newIdx+1 ✓
  //     旧 hide (mcIdx+3) → data-pos="2"    ... mcIdx+3 = newIdx+2 ✓
  //     新 hide は (newIdx+3) = mcIdx+4 → 飛んだカードへ充填 ✓
  //
  // DOWN（dir='down'） newIdx = (mcIdx-1+len)%len
  //   対応表（不変条件検算）:
  //     旧 hide (mcIdx+3) → mcResetCard → newIdx → data-pos="0"   ... newIdx+0 ✓
  //     旧 pos0 (mcIdx+0) → fly mc-out-down → finalize後 data-pos="1" (中身 mcIdx+0 = newIdx+1) ✓
  //     旧 pos1 (mcIdx+1) → data-pos="2"    ... mcIdx+1 = newIdx+2 ✓
  //     旧 pos2 (mcIdx+2) → data-pos="hide" ... mcIdx+2 = newIdx+3 ✓
  //     新 hide は (newIdx+3) = mcIdx+2 → 旧 pos2 そのまま ✓（リセット不要）
  //
  function mcAdvance(dir){
    const len = mcFiltered.length;
    const cards = mcTrack.querySelectorAll('.mc-card');

    let cardPos0, cardPos1, cardPos2, cardHide;
    cards.forEach(c => {
      switch(c.dataset.pos){
        case '0':    cardPos0 = c; break;
        case '1':    cardPos1 = c; break;
        case '2':    cardPos2 = c; break;
        case 'hide': cardHide = c; break;
      }
    });

    if(!cardPos0 || !cardPos1 || !cardPos2 || !cardHide) return;

    const newIdx = dir === 'up'
      ? (mcIdx + 1) % len
      : (mcIdx - 1 + len) % len;

    if(dir === 'up'){
      // UP: pos0 が上へ飛ぶ
      const flyCard = cardPos0;
      flyCard.classList.add('mc-out-up');

      // pos1→0, pos2→1, hide→2（transition 付きで）
      cardPos1.dataset.pos = '0';
      cardPos2.dataset.pos = '1';
      cardHide.dataset.pos = '2';

      // 飛行完了後に飛んだカードをリセットして hide へ
      let finalized = false;
      const finalize = () => {
        if(finalized) return;
        finalized = true;
        if(!flyCard.isConnected) return;
        const targetSong = mcFiltered[(newIdx + 3) % len];
        mcResetCard(flyCard, targetSong);
        mcPauseTransition(flyCard, () => {
          flyCard.classList.remove('mc-out-up');
          flyCard.style.zIndex = '';
          flyCard.dataset.pos = 'hide';
        });
        mcIdx = newIdx;
        mcUpdateMeta();
        mcAnimating = false;
        mcPrefetch();
      };
      flyCard.addEventListener('transitionend', e => {
        if(e.target !== flyCard) return; // 子バブル除外
        finalize();
      }, {once: true});
      setTimeout(finalize, 400); // reduced-motion / フォールバック

    } else {
      // DOWN: hide カードを newIdx 曲でリセットしてから pos0 へ昇格
      // 飛ばす前に充填（hide 位置に既にあるので瞬間配置不要）
      mcResetCard(cardHide, mcFiltered[newIdx]);

      // transition 一時停止で hide → pos0（瞬間昇格してからアニメが走る）
      mcPauseTransition(cardHide, () => {
        cardHide.dataset.pos = '0';
      });

      // 旧 pos0 が下へ飛ぶ（down-flyにはインライン zIndex 5 を付けて前面保証）
      const flyCard = cardPos0;
      flyCard.style.zIndex = '5';
      flyCard.classList.add('mc-out-down');

      // pos1→2, pos2→hide（pos2 の中身は mcIdx+2 = newIdx+3 で既に正しい）
      cardPos1.dataset.pos = '2';
      cardPos2.dataset.pos = 'hide';

      // 飛行完了後に飛んだカードを pos1 へ（中身は mcIdx+0 = newIdx+1 でリセット不要）
      let finalized = false;
      const finalize = () => {
        if(finalized) return;
        finalized = true;
        if(!flyCard.isConnected) return;
        mcPauseTransition(flyCard, () => {
          flyCard.classList.remove('mc-out-down');
          flyCard.style.zIndex = '';
          flyCard.dataset.pos = '1';
        });
        mcIdx = newIdx;
        mcUpdateMeta();
        mcAnimating = false;
        mcPrefetch();
      };
      flyCard.addEventListener('transitionend', e => {
        if(e.target !== flyCard) return; // 子バブル除外
        finalize();
      }, {once: true});
      setTimeout(finalize, 400); // reduced-motion / フォールバック
    }
  }

  // --- カード内容リセット（要素リサイクル） ---
  function mcResetCard(card, song){
    if(!card || !song) return;
    const cache = mcCardCache.get(card);
    if(!cache) return;

    const color = window.getMemberColor ? window.getMemberColor(song.member) : '#b0b8ff';
    const vid = ytId(song.url);
    const thumbUrl = vid ? 'https://img.youtube.com/vi/'+vid+'/mqdefault.jpg' : '';
    const memberLabel = parseMembers(song).map(mid => mbr(mid)).join(', ') || song.member || '';
    const tags = parseTags(song);

    // LP ピーク・canvas 除去
    card.classList.remove('mc-lp-peek');
    const canvas = cache.lpWrap.querySelector('canvas');
    if(canvas) canvas.remove();

    // サムネイル差し替え（差し替え前に親背景リセット）
    if(cache.img.parentElement) cache.img.parentElement.style.background = '';
    cache.img.src = thumbUrl;

    // テキスト更新
    cache.colorBar.style.background = 'linear-gradient(90deg,'+color+',transparent)';
    cache.memberEl.style.color = color;
    cache.memberEl.textContent = memberLabel;
    cache.titleEl.textContent = song.title || '';
    cache.dateEl.textContent = fmtDate(song.date);
    cache.tagsEl.innerHTML = tags.map(t => '<span class="mc-card-tag">'+esc(t)+'</span>').join('');

    // ピン状態再判定
    if(window.isOnShelf && window.isOnShelf(song.id)){
      cache.pinBtn.classList.add('mc-pinned');
    } else {
      cache.pinBtn.classList.remove('mc-pinned');
    }

    // OL ボタンの data-vid 更新
    cache.olBtn.dataset.vid = song.id;

    // dataset.sid 更新
    card.dataset.sid = song.id;

    // インライン残留クリア
    card.style.transform = '';
    card.style.opacity = '';
    card.style.transition = '';
    card.style.willChange = '';

    // キャッシュ更新
    cache.song = song;
    cache.color = color;
  }

  // --- プリフェッチ（mcIdx+2, +3 の mqdefault） ---
  function mcPrefetch(){
    const len = mcFiltered.length;
    if(len < 4) return;
    [2, 3].forEach(offset => {
      const song = mcFiltered[(mcIdx + offset) % len];
      const vid = ytId(song.url);
      if(!vid) return;
      const url = 'https://img.youtube.com/vi/'+vid+'/mqdefault.jpg';
      if(mcPrefetchMap.has(url)) return;
      // LRU: 上限10
      if(mcPrefetchMap.size >= 10){
        const firstKey = mcPrefetchMap.keys().next().value;
        mcPrefetchMap.delete(firstKey);
      }
      const img = new Image();
      img.decode().catch(() => {});
      img.src = url;
      mcPrefetchMap.set(url, img);
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

  function msUpdateGlow(){ if(msSongs.length && msSongs[msAct]) msGlow.style.background = window.getMemberColor ? window.getMemberColor(msSongs[msAct].member) : '#c4b5fd'; }

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
