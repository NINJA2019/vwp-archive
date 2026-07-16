// intro.js — ターンテーブルイントロ（app.js L1152-1386 相当）

import { _gtag, setSelectedMembers_state, setCurMember, setCurTag, setCurSort, setCurAlbum, setSearchQ, buildSidebar, updateCounts, render } from './core.js';

export function initIntro(){
  // スタートページ表示中は裏のページをスクロール固定
  document.body.style.overflow = 'hidden';
  const MEMBERS = [
    {m:'ol',     icon:'✦',  img:null,  ol:true,               ja:'Observer-Link', en:'OBSERVER-LINK', spd:'48s', bg:'radial-gradient(circle at 38% 32%,#2a1e6e,#120d3a)', mc:'#6c5ce7', mglow:'rgba(108,92,231,.35)'},
    {m:'vwp',    icon:'✦',  img:'/icons/V_W_P.png',           ja:'V.W.P',      en:'V.W.P',        spd:'42s', bg:'radial-gradient(circle at 38% 32%,#2c1e50,#0d0a1e)', mc:'#c4b5fd', mglow:'rgba(196,181,253,.35)'},
    {m:'kafu',   icon:'🌸', img:'/icons/KAF.png',             ja:'花譜',       en:'KAF',          spd:'55s', bg:'radial-gradient(circle at 38% 32%,#48182a,#180810)', mc:'#ffb7c5', mglow:'rgba(255,183,197,.35)'},
    {m:'rime',   icon:'🌱', img:'/icons/RIM.png',             ja:'理芽',       en:'RIM',          spd:'46s', bg:'radial-gradient(circle at 38% 32%,#0e284a,#060e1e)', mc:'#7eb8f7', mglow:'rgba(126,184,247,.35)'},
    {m:'harusar',icon:'🔥', img:'/icons/Harusaruhi.png',      ja:'春猿火',     en:'HARU SARUHI',  spd:'40s', bg:'radial-gradient(circle at 38% 32%,#481010,#180505)', mc:'#ff7070', mglow:'rgba(255,112,112,.35)'},
    {m:'isekai', icon:'🌼', img:'/icons/isekaijocho.png',     ja:'ヰ世界情緒', en:'ISEKAI JOUCHO',spd:'52s', bg:'radial-gradient(circle at 38% 32%,#282828,#0e0e0e)', mc:'#d8d8d8', mglow:'rgba(220,220,220,.25)'},
    {m:'koko',   icon:'⚡', img:'/icons/koko.png',            ja:'幸祜',       en:'KOKO',         spd:'44s', bg:'radial-gradient(circle at 38% 32%,#2c1248,#0e061a)', mc:'#c084fc', mglow:'rgba(192,132,252,.35)'},
  ];

  const stage   = document.getElementById('ttStage');
  const ttFace  = document.getElementById('ttFace');
  const ttLabel = document.getElementById('ttRecLabel');
  const ttPlat  = document.getElementById('ttPlatter');
  const ttArm   = document.getElementById('ttArm');
  const infoName= document.getElementById('ttInfoName');
  const infoJa  = document.getElementById('ttInfoJa');
  const enterBtn= document.getElementById('ttEnterBtn');
  const hint    = document.getElementById('ttHint');
  const intro   = document.getElementById('ttIntro');

  // 画面サイズに応じてスケール
  // ヘッダー(約60px) + 名前テキスト込みのマージン + ボタン類(約120px) を除いた残り高さ
  const baseSize = 560;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // 使える縦幅: モバイルはヘッダー+ボタン類で約160px消費、PCは約200px
  const isMobile = vw < 600;
  const reservedH = isMobile ? 150 : 200;
  const maxSize = Math.min(vw - (isMobile ? 16 : 24), vh - reservedH, baseSize);
  const scale = Math.max(maxSize / baseSize, 0.4); // 最小40%
  const stageSize = Math.round(baseSize * scale);
  const stage2 = document.getElementById('ttStage');
  if(stage2){ stage2.style.width = stageSize+'px'; stage2.style.height = stageSize+'px'; }

  // ターンテーブルもスケール
  const ttWrap = stage2?.querySelector('div');
  const ttW = Math.round(230 * scale);
  const platW = Math.round(182 * scale);
  const armH = Math.round(96 * scale);
  if(ttWrap){ ttWrap.style.width=ttW+'px'; ttWrap.style.height=ttW+'px'; }
  const ttBody2 = ttWrap?.querySelector('div');
  if(ttBody2){ ttBody2.style.width=ttW+'px'; ttBody2.style.height=ttW+'px'; }
  const plat2 = document.getElementById('ttPlatter');
  if(plat2){ plat2.style.width=platW+'px'; plat2.style.height=platW+'px'; }
  const arm2 = document.getElementById('ttArm');
  if(arm2){ arm2.style.height=armH+'px'; }

  // LPラベルサイズ（画像はLP全面）
  document.querySelectorAll('.tt-lp-label').forEach(l=>{
    l.style.width='100%'; l.style.height='100%';
  });

  // LP名前フォントサイズもスケール
  const nameFontSize = Math.max(Math.round(12 * scale), 8);
  const nameWidth = Math.max(Math.round(100 * scale), 60);
  const nameBottom = Math.max(Math.round(26 * scale), 18);
  document.querySelectorAll('.tt-lp-name').forEach(n=>{
    n.style.fontSize = nameFontSize+'px';
    n.style.width = nameWidth+'px';
    n.style.bottom = '-'+nameBottom+'px';
  });

  const lpSize = Math.round(110 * scale);
  const R = Math.round(218 * scale), CX = Math.round(280 * scale), CY = Math.round(280 * scale);
  let busy = false, chosen = null, entering = false;

  // LPを配置
  MEMBERS.forEach((mb, i) => {
    const angle = (i / MEMBERS.length) * 2 * Math.PI - Math.PI / 2;
    const lpHalf = Math.round(55 * scale);
    const x = CX + R * Math.cos(angle) - lpHalf;
    const y = CY + R * Math.sin(angle) - lpHalf;
    const el = document.createElement('div');
    el.className = 'tt-lp';
    el.dataset.m = mb.m;
    el.style.cssText = `left:${x}px;top:${y}px;--spd:${mb.spd};--mc:${mb.mc};--mglow:${mb.mglow};width:${lpSize}px;height:${lpSize}px;`;
    const labelInner = mb.img
      ? `<img src="${mb.img}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : mb.ol
        ? `<span style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.6rem;color:#fff;line-height:1;display:flex;align-items:center;justify-content:center;width:100%;height:100%;position:relative;z-index:10;text-shadow:0 0 12px rgba(108,92,231,.6);">✦</span>`
        : `<span style="font-size:.9rem;">${mb.icon}</span>`;
    // 画像ありの場合は背景を黒のみ、画像なしはメンバーカラー背景
    const faceBg = mb.img ? '#0a0910' : mb.bg;
    el.innerHTML = `
      <div class="tt-lp-face" style="background:${faceBg};">
        <div class="tt-lp-grooves"></div>
        <div class="tt-lp-label" style="background:${mb.img?'transparent':mb.mc};">${labelInner}</div>
        <div class="tt-lp-hole"></div>
      </div>
      <div class="tt-lp-name">${mb.en}</div>`;
    el.addEventListener('click', () => { if(!busy) doSelect(mb, el); });
    stage.appendChild(el);
  });

  function doSelect(mb, el){
    busy = true;
    document.querySelectorAll('.tt-lp').forEach(l => l.classList.remove('tt-chosen'));
    el.classList.add('tt-chosen');
    chosen = mb;

    // Observer-Link: skip platter animation, transition directly
    if(mb.ol){
      infoName.style.color = mb.mc;
      infoName.textContent = mb.en;
      infoJa.style.color = 'rgba(160,170,220,0.65)';
      infoJa.textContent = mb.ja;
      hint.textContent = '';
      enterBtn.style.color = '#ccd4ee';
      enterBtn.style.borderColor = 'rgba(108,92,231,.45)';
      enterBtn.style.cursor = 'pointer';
      enterBtn.style.boxShadow = '0 0 14px rgba(108,92,231,0.25)';
      enterBtn.textContent = '✦ OBSERVER-LINK';
      setTimeout(() => { busy = false; enterArchive(); }, 350);
      return;
    }

    ttFace.style.opacity = '0';
    ttPlat.style.animationPlayState = 'paused';
    ttArm.style.transform = 'rotate(-38deg)';
    infoName.style.color = 'rgba(200,210,255,0.15)';
    infoJa.style.color = 'rgba(90,106,144,0.4)';
    hint.textContent = 'セット中…';

    ttFace.style.background = mb.img ? '#0a0910' : mb.bg;
    if(mb.img){
      ttLabel.innerHTML = `<img src="${mb.img}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      ttLabel.style.background = 'transparent';
      ttLabel.style.fontSize = '0';
    } else {
      ttLabel.innerHTML = '';
      ttLabel.textContent = mb.icon;
      ttLabel.style.background = mb.mc;
      ttLabel.style.fontSize = '1.1rem';
    }

    setTimeout(() => {
      ttFace.style.opacity = '1';
      setTimeout(() => {
        ttArm.style.transform = 'rotate(-6deg)';
        setTimeout(() => {
          ttPlat.style.animationPlayState = 'running';
          infoName.style.color = mb.mc;
          infoName.textContent = mb.en;
          infoJa.style.color = 'rgba(160,170,220,0.65)';
          infoJa.textContent = mb.ja;
          // ENTERボタンを有効化
          enterBtn.style.color = '#ccd4ee';
          enterBtn.style.borderColor = 'rgba(176,184,255,.45)';
          enterBtn.style.cursor = 'pointer';
          enterBtn.style.boxShadow = '0 0 14px rgba(160,150,255,0.18)';
          enterBtn.textContent = '▶ PLAY ARCHIVE';
          hint.textContent = '▶ で入場';
          busy = false;
        }, 900);
      }, 350);
    }, 250);
  }

  function enterArchive(){
    if(!chosen || entering) return;
    entering = true;

    // 黒幕を作成してフェードイン → 暗転完了後にアーカイブ表示 → 黒幕フェードアウト
    const black = document.createElement('div');
    black.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;opacity:0;transition:opacity .55s ease;pointer-events:none;';
    document.body.appendChild(black);

    // 少し待ってから黒幕フェードイン
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { black.style.opacity = '1'; });
    });

    setTimeout(() => {
      // 暗転完了：ターンテーブル画面を非表示
      intro.style.display = 'none';
      document.body.style.overflow = '';
      // 入店確定をオンボーディング（店主メモ等）へ通知（onboarding.js が購読）
      document.dispatchEvent(new CustomEvent('vwp:archive-entered'));

      const m = chosen.m;

      // Observer-Link: open OL screen directly
      if(chosen.ol){
        _gtag('event','archive_enter',{member_name:'ol',view_mode:'observer_link'});
        setSelectedMembers_state([]);
        setCurMember('all');
        setCurSort('new');
        setCurTag('all');
        setCurAlbum(null);
        setSearchQ('');
        const sq = document.getElementById('searchInput');
        if(sq) sq.value = '';
        buildSidebar();
        updateCounts();
        render();
        // Open OL screen after archive renders
        if(typeof window.openObserverLink === 'function') window.openObserverLink();
        setTimeout(() => {
          black.style.opacity = '0';
          setTimeout(() => black.remove(), 600);
        }, 80);
        return;
      }

      // メンバーフィルタを適用
      _gtag('event','archive_enter',{member_name:m,view_mode:'member'});
      setSelectedMembers_state([m]);
      setCurMember(m);
      setCurTag('all');
      setCurSort('new');
      setCurAlbum(null);
      setSearchQ('');
      const sq = document.getElementById('searchInput');
      if(sq) sq.value = '';
      buildSidebar();
      updateCounts();
      render();

      // 黒幕フェードアウト
      setTimeout(() => {
        black.style.opacity = '0';
        setTimeout(() => black.remove(), 600);
      }, 80);
    }, 600);
  }

  enterBtn.addEventListener('click', () => { if(chosen) enterArchive(); });

  // キーボード: Enterでも入場可
  document.addEventListener('keydown', e => {
    if(e.key === 'Enter' && chosen && intro.style.display !== 'none') enterArchive();
  });
}
