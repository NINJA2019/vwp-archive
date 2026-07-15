// core.js — メイン状態・描画・フィルタ・モーダル・管理者認証・ブートストラップ
// (app.js L32-1150 相当、constants/supabase/i18n/vinylから移転した部分を除く)

import { MEMBERS, MBR_CLS, PAGE_SIZE, CARD_ANIM_DELAY_STEP, PW_SK, THEME_SK, DAILY_MEMBERS, DAILY_SK } from './constants.js';
import { t, mbr, applyI18n, tTag, getLang, setLang } from './i18n.js';
import { loadAlbumsApi, loadVideosApi, addAlbumApi, updateAlbumApi, deleteAlbumApi, addVideoApi, deleteVideoApi, updateVideoApi, verifyPwApi } from './supabase.js';
import { getMemberColor, drawVinylDisc } from './vinyl.js';

// ===== 可変状態 =====
let videos = [], curMember = 'all', selectedMembers = [], curTag = 'all', curSort = 'new', curView = 'grid', searchQ = '', isAdmin = false, editId = null;
let curContentType = 'song'; // メイン表示はデフォルトで楽曲（MV）のみ
let filteredCache = [], curPage = 0;
let ioObserver = null;
let albums = [];
let curAlbum = null;
let _videosCacheTime = 0, _albumsCacheTime = 0;
const VIDEOS_CACHE_TTL = 5 * 60 * 1000;
const ALBUMS_CACHE_TTL = 2 * 60 * 1000;
let newBadgeIds = new Set();
let inputTags = [];

// ===== getters/setters（他モジュールから書き込む箇所用） =====
export function getVideos(){ return videos; }
export function setVideos(v){ videos = v; }
export function getSelectedMembers(){ return selectedMembers; }
export function setSelectedMembers_state(arr){ selectedMembers = arr; }
export function getCurMember(){ return curMember; }
export function setCurMember(v){ curMember = v; }
export function getCurTag(){ return curTag; }
export function setCurTag(v){ curTag = v; }
export function getCurSort(){ return curSort; }
export function setCurSort(v){ curSort = v; }
export function getCurAlbum(){ return curAlbum; }
export function setCurAlbum(v){ curAlbum = v; }
export function getCurContentType(){ return curContentType; }
export function setCurContentType(v){ curContentType = v; }
export function getSearchQ(){ return searchQ; }
export function setSearchQ(v){ searchQ = v; }
export function getIsAdmin(){ return isAdmin; }
export function getFilteredCache(){ return filteredCache; }
export function getAlbums(){ return albums; }
export function getInputTags(){ return inputTags; }
export function setInputTags(v){ inputTags = v; }
export function getEditId(){ return editId; }
export function setEditId(v){ editId = v; }
export function invalidateVideosCache(){ _videosCacheTime = 0; }
export function invalidateAlbumsCache(){ _albumsCacheTime = 0; }

// ===== openPage / closePage =====
export function openPage(page){
  document.getElementById('pageAbout').style.display=page==='about'?'block':'none';
  document.getElementById('pageContact').style.display=page==='contact'?'block':'none';
  document.getElementById('pageUpdate').style.display=page==='update'?'block':'none';
  document.getElementById('pageMover').style.display='block';
  document.body.style.overflow='hidden';
  return false;
}
export function closePage(){
  document.getElementById('pageMover').style.display='none';
  document.getElementById('pageAbout').style.display='none';
  document.getElementById('pageContact').style.display='none';
  document.getElementById('pageUpdate').style.display='none';
  document.body.style.overflow='';
}

// ===== FETCH ERROR TOAST =====
export function showFetchError(msg){
  let toast=document.getElementById('fetchErrToast');
  if(!toast){
    toast=document.createElement('div');
    toast.id='fetchErrToast';
    toast.style.cssText='position:fixed;top:62px;left:50%;transform:translateX(-50%);z-index:9999;background:rgba(252,165,165,.15);border:1px solid rgba(252,165,165,.35);color:#fca5a5;padding:.5rem 1.2rem;border-radius:6px;font-size:.78rem;backdrop-filter:blur(8px);transition:opacity .4s;';
    document.body.appendChild(toast);
  }
  toast.textContent=msg;
  toast.style.opacity='1';
  clearTimeout(toast._tid);
  toast._tid=setTimeout(()=>{toast.style.opacity='0';},5000);
}

// ===== GA4 TRACKING HELPERS =====
export function _gtag(...args){ if(typeof window.gtag==='function') window.gtag(...args); }
export function trackSongClick(id, url){
  const v=videos.find(x=>x.id===id);
  if(v) _gtag('event','song_click',{
    song_title:  v.title||'',
    member_name: v.member||'',
    video_date:  v.date||'',
    album_id:    v.album_id?String(v.album_id):'',
  });
  window.open(url,'_blank');
}
export function trackExternalLink(url, type, label){
  _gtag('event','external_link_click',{
    link_url:   url,
    link_type:  type,
    item_label: label||'',
  });
}

// ===== 管理者PW保存（sessionStorage） =====
export function getStoredPw(){try{return sessionStorage.getItem(PW_SK)||'';}catch{return '';}}
export function storePw(pw){try{sessionStorage.setItem(PW_SK,pw);}catch{}}

// ===== アルバムAPI（getStoredPwをDI） =====
export async function loadAlbums(force = false){
  const now = Date.now();
  if(!force && albums.length > 0 && now - _albumsCacheTime < ALBUMS_CACHE_TTL) return;
  try{ const d = await loadAlbumsApi(); if(Array.isArray(d)){ albums=d; _albumsCacheTime=Date.now(); } }catch(e){console.error(e);showFetchError('アルバムデータの取得に失敗しました');}
}
export async function addAlbumApiFn(payload){
  return addAlbumApi(payload, getStoredPw);
}
export async function updateAlbumApiFn(id, fields){
  return updateAlbumApi(id, fields, getStoredPw);
}
export async function deleteAlbumApiFn(id){
  return deleteAlbumApi(id, getStoredPw);
}

// ===== アルバムサムネイル =====
export function albumThumb(album){
  const first=videos.find(v=>v.album_id===album.id);
  return first?thumb(first):'';
}

// ===== 動画API =====
export async function loadVideos(force = false){
  const now = Date.now();
  if(!force && videos.length > 0 && now - _videosCacheTime < VIDEOS_CACHE_TTL) return;
  try{ const d = await loadVideosApi(); if(Array.isArray(d)){ videos=d; _videosCacheTime=Date.now(); } }catch(e){console.error(e);showFetchError('動画データの取得に失敗しました');}
}
export async function addVideoApiFn(payload){
  return addVideoApi(payload, getStoredPw);
}
export async function deleteVideoApiFn(id){
  return deleteVideoApi(id, getStoredPw);
}
export async function updateVideoApiFn(id, payload){
  return updateVideoApi(id, payload, getStoredPw);
}

// ===== ユーティリティ =====
export function ytId(url){const m=url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);return m?m[1]:null;}
export function thumb(v){const id=ytId(v.url);return id?`https://img.youtube.com/vi/${id}/mqdefault.jpg`:'';}
export function fmtDate(d){if(!d)return '';const dt=new Date(d+'T00:00:00');return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')}`;}
const _ptCache=new WeakMap();
export function parseTags(v){let c=_ptCache.get(v);if(c)return c;const raw=v.tags||v.tag||'';c=raw.split(/[ ,]+/).map(s=>s.replace(/^#/,'')).filter(Boolean);_ptCache.set(v,c);return c;}
const _pmCache=new WeakMap();
export function parseMembers(v){let c=_pmCache.get(v);if(c)return c;c=(v.member||'').split(/[ ,]+/).filter(Boolean);_pmCache.set(v,c);return c;}
// XSS対策: HTML文字列エスケープ（DOM不使用の高速版）
export function esc(s){ if(s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
// XSS対策: href/onclickに使うURLをhttps?://のみ許可
export function safeUrl(url){ if(!url) return '#'; return /^https?:\/\//i.test(url) ? url : '#'; }
export function tagPills(v){return parseTags(v).map(tag=>`<span class="pill">#${esc(tTag(tag))}</span>`).join('');}
export function mbPill(mid){return `<span class="pill ${MBR_CLS[mid]||''}">${esc(mbr(mid))}</span>`;}
export function spotifyBtn(v){if(!v.spotify_url)return '';const u=safeUrl(v.spotify_url);if(u==='#')return '';const _t=(v.title||'').replace(/'/g,"\\'");return `<a class="spotify-btn" href="${u}" target="_blank" rel="noopener" onclick="trackExternalLink('${u}','spotify','${_t}');event.stopPropagation()">♫ ${t('spotify')}</a>`;}

// ===== 今日の観測 =====
export function seededRand(seed){
  let s = seed;
  return function(){
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}
export function getTodayJST(){
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
}
export function getDailyPicks(){
  const today = getTodayJST();
  try {
    const stored = JSON.parse(localStorage.getItem(DAILY_SK)||'null');
    if(stored && stored.date === today) return stored.picks.map(id=>videos.find(v=>v.id===id)).filter(Boolean);
  } catch(e){}
  const seed = today.split('').reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0)|0, 0);
  const rand = seededRand(Math.abs(seed));
  const picks = [];
  DAILY_MEMBERS.forEach(mbr=>{
    const pool = videos.filter(v=>parseMembers(v).includes(mbr) && !parseMembers(v).includes('vwp'));
    if(!pool.length) return;
    const idx = Math.floor(rand() * pool.length);
    picks.push(pool[idx]);
  });
  try { localStorage.setItem(DAILY_SK, JSON.stringify({date:today, picks: picks.map(v=>v.id)})); } catch(e){}
  return picks;
}
export function getDailyPicksFromCache(){
  const today = getTodayJST();
  try {
    const stored = JSON.parse(localStorage.getItem(DAILY_SK)||'null');
    if(stored && stored.date === today){
      return stored.picks.map(id=>videos.find(v=>v.id===id)).filter(Boolean);
    }
  } catch(e){}
  return getDailyPicks();
}

// ===== カテゴリ（content_type）棲み分け =====
// メイン表示は song（MV）のみ。shorts/live/announcement はカテゴリ切替で表示。
// 未知値・NULL は song 扱い（防御的: 旧データや将来の分類追加でメインから消える事故を防ぐ）
const CONTENT_TYPES=[
  {id:'song',key:'ctSong'},
  {id:'shorts',key:'ctShorts'},
  {id:'live',key:'ctLive'},
  {id:'announcement',key:'ctAnnounce'},
];
const NON_SONG_TYPES=['shorts','live','announcement'];
function matchesContentType(v, type){
  const ct = type===undefined ? curContentType : type;
  return ct==='song' ? !NON_SONG_TYPES.includes(v.content_type) : v.content_type===ct;
}

// ===== フィルタリング =====
export function filtered(){
  let list=videos.slice();
  if(curAlbum!==null){
    // アルバム表示は収録曲全件（カテゴリフィルタ対象外: 収録曲リストを欠けさせない）
    list=list.filter(v=>v.album_id===curAlbum);
  } else {
    // メイン表示: カテゴリ棲み分け（デフォルトsong=MVのみ）を先頭で適用
    list=list.filter(v=>matchesContentType(v));
    list=list.filter(v=>!v.album_id);
  }
  if(selectedMembers.length===1){
    list=list.filter(v=>parseMembers(v).includes(selectedMembers[0]));
  } else if(selectedMembers.length>1){
    list=list.filter(v=>selectedMembers.every(m=>parseMembers(v).includes(m)));
  }
  if(curTag!=='all') list=list.filter(v=>parseTags(v).includes(curTag));
  if(searchQ){
    const words=searchQ.toLowerCase().split(/\s+/).filter(Boolean);
    list=list.filter(v=>{
      const hay=(v.title+' '+(v.note||'')).toLowerCase();
      return words.every(w=>hay.includes(w));
    });
  }
  if(curSort!=='daily') list.sort((a,b)=>curSort==='new'?(b.date>a.date?1:-1):(a.date>b.date?1:-1));
  return list;
}
export function allTagsOf(src){const s=new Set();src.forEach(v=>parseTags(v).forEach(t=>s.add(t)));return [...s].sort();}

export function updateCounts(){
  const base=videos.filter(v=>matchesContentType(v)); // 現カテゴリと整合する件数にする
  const srcM=curTag==='all'?base:base.filter(v=>parseTags(v).includes(curTag));
  MEMBERS.forEach(m=>{const el=document.getElementById('mc-'+m.id);if(!el)return;if(m.id==='all'){
      el.textContent=srcM.length;
    } else {
      const testSel=selectedMembers.includes(m.id)?selectedMembers:[...selectedMembers,m.id].slice(0,3);
      if(testSel.length<=1){
        el.textContent=srcM.filter(v=>parseMembers(v).includes(m.id)).length;
      } else {
        el.textContent=srcM.filter(v=>testSel.every(sm=>parseMembers(v).includes(sm))).length;
      }
    }});
  const srcT=selectedMembers.length===0?base:base.filter(v=>selectedMembers.every(m=>parseMembers(v).includes(m)));
  const el0=document.getElementById('tc-all');if(el0)el0.textContent=srcT.length;
  allTagsOf(srcT).forEach(tag=>{const el=document.getElementById('tc-'+tag);if(el)el.textContent=srcT.filter(v=>parseTags(v).includes(tag)).length;});
  // カテゴリチップの件数（content_typeフィルタ前のメンバー選択のみ反映）
  const srcC=selectedMembers.length===0?videos:videos.filter(v=>selectedMembers.every(m=>parseMembers(v).includes(m)));
  CONTENT_TYPES.forEach(ct=>{const el=document.getElementById('ctc-'+ct.id);if(el)el.textContent=srcC.filter(v=>matchesContentType(v,ct.id)).length;});
}

export function buildSidebar(){
  const mp=document.getElementById('memberPills');
  mp.innerHTML='';
  const selCount=document.getElementById('memberSelCount');
  if(selCount) selCount.textContent=selectedMembers.length>0?`(${selectedMembers.length}/3選択中)`:'';
  if(selectedMembers.length>0){
    const reset=document.createElement('button');
    reset.style.cssText='background:rgba(255,100,100,.1);border:1px solid rgba(255,100,100,.25);color:#fca5a5;font-size:.65rem;padding:3px 10px;border-radius:4px;cursor:pointer;margin-bottom:6px;width:100%;transition:all .2s;';
    reset.textContent='✕ 選択をリセット';
    reset.addEventListener('click',()=>{selectedMembers=[];curMember='all';curTag='all';curAlbum=null;buildSidebar();updateCounts();render();});
    mp.appendChild(reset);
  }
  MEMBERS.forEach(m=>{
    const btn=document.createElement('button');
    const isSelected=selectedMembers.includes(m.id);
    const isAll=m.id==='all';
    let dimmed=false;
    if(selectedMembers.length>0 && !isAll && !isSelected && selectedMembers.length<3){
      const testSel=[...selectedMembers,m.id];
      const comboCount=videos.filter(v=>testSel.every(sm=>parseMembers(v).includes(sm))).length;
      if(comboCount===0) dimmed=true;
    }
    if(selectedMembers.length>=3 && !isSelected && !isAll) dimmed=true;
    btn.className='mpill'+(isAll&&selectedMembers.length===0?' on':(isSelected?' on':''));
    if(dimmed){ btn.style.opacity='0.3'; btn.style.cursor='not-allowed'; }
    btn.dataset.m=m.id;
    btn.innerHTML=`<span class="mpill-icon">${m.emoji}</span><span class="mpill-name">${mbr(m.id)}</span><span class="mpill-cnt" id="mc-${m.id}">0</span>`;
    btn.addEventListener('click',()=>{
      if(dimmed) return;
      _gtag('event','member_filter_select',{
        member_name:    m.id,
        action:         m.id==='all'?'reset':selectedMembers.includes(m.id)?'deselect':'select',
        selected_count: selectedMembers.length,
      });
      if(m.id==='all'){
        selectedMembers=[];curMember='all';
      } else {
        const idx=selectedMembers.indexOf(m.id);
        if(idx===-1){
          if(selectedMembers.length<3) selectedMembers.push(m.id);
        } else {
          selectedMembers.splice(idx,1);
        }
        curMember=selectedMembers.length===1?selectedMembers[0]:(selectedMembers.length>1?'multi':'all');
      }
      curTag='all';curAlbum=null;buildSidebar();updateCounts();render();
    });
    mp.appendChild(btn);
  });
  // ===== アルバムセクション =====
  const af=document.getElementById('albumFilters');
  if(af){
    af.innerHTML='';
    const memberAlbums=albums.filter(al=>{
      if(selectedMembers.length===0) return false;
      if(selectedMembers.length===1) return al.member===selectedMembers[0];
      return false;
    });
    const albumSec=document.getElementById('albumSection');
    if(albumSec) albumSec.style.display=memberAlbums.length>0?'block':'none';
    function getSeriesKey(name){
      return name.replace(/(?:\s*LIVE\d*|\s+\d+|\s*[２３４１-９]|\s*[αβγδε])+$/i,'').trim() || name;
    }
    const groups=[];
    const groupMap={};
    memberAlbums.forEach(al=>{
      const key=getSeriesKey(al.name);
      if(!groupMap[key]){ groupMap[key]={key,albums:[]}; groups.push(groupMap[key]); }
      groupMap[key].albums.push(al);
    });
    groups.forEach(g=>{
      if(g.albums.length===1){
        const al=g.albums[0];
        const btn=document.createElement('button');
        const isOn=curAlbum===al.id;
        btn.className='cfilt album-filt'+(isOn?' on':'');
        btn.innerHTML=`<span class="cfilt-label">📀 ${esc(al.name)}</span>`;
      if(isAdmin){
        const del=document.createElement('span');
        del.textContent=' ✕';
        del.style.cssText='font-size:.6rem;opacity:.5;margin-left:2px;cursor:pointer;';
        del.addEventListener('click',async(e)=>{
          e.stopPropagation();
          if(!confirm(`アルバム「${al.name}」を削除しますか？（収録曲のアルバム紐付けも解除されます）`)) return;
          await deleteAlbumApiFn(al.id);
          if(curAlbum===al.id){curAlbum=null;}
          await loadAlbums(true);
          buildSidebar();updateCounts();render();
        });
        btn.appendChild(del);
      }
      btn.addEventListener('click',()=>{
          curAlbum=isOn?null:al.id;
          if(curAlbum!==null) _gtag('event','album_open',{album_title:al.name,member_name:al.member});
          buildSidebar();updateCounts();render();
        });
        af.appendChild(btn);
      } else {
        const hasActive=g.albums.some(a=>curAlbum===a.id);
        let grpOpen=hasActive;
        const header=document.createElement('button');
        header.className='cfilt'+(hasActive?' on':'');
        header.style.cssText='padding-left:.3rem;';
        const arrowSpan=document.createElement('span');
        arrowSpan.style.cssText='font-size:.65rem;color:var(--dim);transition:transform .2s;display:inline-block;margin-right:.3rem;';
        arrowSpan.textContent='▶';
        arrowSpan.style.transform=grpOpen?'rotate(90deg)':'rotate(0deg)';
        const labelSpan=document.createElement('span');
        labelSpan.className='cfilt-label';
        labelSpan.appendChild(arrowSpan);
        labelSpan.appendChild(document.createTextNode('📀 '+g.key+' '));
        const cntSpan=document.createElement('span');
        cntSpan.textContent='('+g.albums.length+')';
        cntSpan.style.cssText='font-size:.6rem;color:var(--dim);';
        labelSpan.appendChild(cntSpan);
        header.appendChild(labelSpan);
        const children=document.createElement('div');
        children.style.cssText='overflow:hidden;transition:max-height .25s ease;padding-left:.6rem;';
        children.style.maxHeight=grpOpen?(g.albums.length*2.2)+'rem':'0';
        g.albums.forEach(al=>{
          const isOn2=curAlbum===al.id;
          const btn2=document.createElement('button');
          btn2.className='cfilt album-filt'+(isOn2?' on':'');
          btn2.style.fontSize='.75rem';
          const lbl2=document.createElement('span');
          lbl2.className='cfilt-label';
          lbl2.textContent='  '+al.name;
          btn2.appendChild(lbl2);
          if(isAdmin){
            const del=document.createElement('span');
            del.textContent=' ✕';
            del.style.cssText='font-size:.6rem;opacity:.5;margin-left:2px;cursor:pointer;';
            del.addEventListener('click',async(e)=>{
              e.stopPropagation();
              if(!confirm('アルバム「'+al.name+'」を削除しますか？')) return;
              await deleteAlbumApiFn(al.id);
              if(curAlbum===al.id){curAlbum=null;}
              _albumsCacheTime=0;
              await loadAlbums(true);
              buildSidebar();updateCounts();render();
            });
            btn2.appendChild(del);
          }
          btn2.addEventListener('click',()=>{
            const on2=curAlbum===al.id;
            curAlbum=on2?null:al.id;
            if(curAlbum!==null) _gtag('event','album_open',{album_title:al.name,member_name:al.member});
            buildSidebar();updateCounts();render();
          });
          children.appendChild(btn2);
        });
        header.addEventListener('click',()=>{
          grpOpen=!grpOpen;
          children.style.maxHeight=grpOpen?(g.albums.length*2.2)+'rem':'0';
          arrowSpan.style.transform=grpOpen?'rotate(90deg)':'rotate(0deg)';
        });
        af.appendChild(header);
        af.appendChild(children);
      }
    });
    if(isAdmin && selectedMembers.length===1){
      const addBtn=document.createElement('button');
      addBtn.className='cfilt';
      addBtn.style.cssText='border-style:dashed;opacity:.6;';
      addBtn.textContent='＋ アルバムを追加';
      addBtn.addEventListener('click',()=>openAlbumModal(selectedMembers[0]));
      af.appendChild(addBtn);
    }
  }

  // ===== カテゴリ（content_type）チップ =====
  const ctf=document.getElementById('contentTypeFilters');
  if(ctf){
    ctf.innerHTML='';
    CONTENT_TYPES.forEach(ct=>{
      const b=document.createElement('button');
      b.className='cfilt'+(curContentType===ct.id?' on':'');
      b.innerHTML=`<span class="cfilt-label">${t(ct.key)}</span><span class="ccnt" id="ctc-${ct.id}">0</span>`;
      b.addEventListener('click',()=>{
        if(curContentType===ct.id) return;
        curContentType=ct.id;
        curTag='all';curAlbum=null;
        buildSidebar();updateCounts();render();
      });
      ctf.appendChild(b);
    });
  }

  const tf=document.getElementById('tagFilters');
  tf.innerHTML='';
  const ctVideos=videos.filter(v=>matchesContentType(v));
  const src=selectedMembers.length===0?ctVideos:ctVideos.filter(v=>selectedMembers.every(m=>parseMembers(v).includes(m)));
  const tags=allTagsOf(src.filter(v=>!v.album_id));
  const allB=document.createElement('button');
  allB.className='cfilt'+(curTag==='all'?' on':'');
  allB.innerHTML=`<span class="cfilt-label">${t('allTag')}</span><span class="ccnt" id="tc-all">0</span>`;
  allB.addEventListener('click',()=>{curTag='all';tf.querySelectorAll('.cfilt').forEach(b=>b.classList.remove('on'));allB.classList.add('on');updateCounts();render();});
  tf.appendChild(allB);
  tags.forEach(tag=>{
    const b=document.createElement('button');
    b.className='cfilt'+(curTag===tag?' on':'');
    b.innerHTML=`<span class="cfilt-label">#${tTag(tag)}</span><span class="ccnt" id="tc-${tag}">0</span>`;
    b.addEventListener('click',()=>{curTag=tag;tf.querySelectorAll('.cfilt').forEach(x=>x.classList.remove('on'));b.classList.add('on');updateCounts();render();});
    tf.appendChild(b);
  });
  buildMobFilters();
}

export function buildMobFilters(){
  const mm=document.getElementById('mobMembers');
  if(!mm)return;
  mm.innerHTML='';
  if(selectedMembers.length>0){
    const reset=document.createElement('button');
    reset.className='mob-chip';
    reset.style.cssText='background:rgba(255,100,100,.1);border-color:rgba(255,100,100,.25);color:#fca5a5;';
    reset.textContent='✕ リセット';
    reset.addEventListener('click',()=>{selectedMembers=[];curMember='all';curTag='all';curAlbum=null;buildSidebar();updateCounts();render();});
    mm.appendChild(reset);
  }
  MEMBERS.forEach(m=>{
    const b=document.createElement('button');
    const isSelected=selectedMembers.includes(m.id);
    const isAll=m.id==='all';
    let dimmed=false;
    if(selectedMembers.length>0 && !isAll && !isSelected && selectedMembers.length<3){
      const testSel=[...selectedMembers,m.id];
      const comboCount=videos.filter(v=>testSel.every(sm=>parseMembers(v).includes(sm))).length;
      if(comboCount===0) dimmed=true;
    }
    if(selectedMembers.length>=3 && !isSelected && !isAll) dimmed=true;
    b.className='mob-chip'+(isAll&&selectedMembers.length===0?' on':(isSelected?' on':''));
    b.dataset.m=m.id;
    if(dimmed){ b.style.opacity='0.3'; b.style.cursor='not-allowed'; }
    b.textContent=m.emoji+' '+mbr(m.id);
    b.addEventListener('click',()=>{
      if(dimmed) return;
      if(m.id==='all'){
        selectedMembers=[];curMember='all';
      } else {
        const idx=selectedMembers.indexOf(m.id);
        if(idx===-1){if(selectedMembers.length<3)selectedMembers.push(m.id);}
        else{selectedMembers.splice(idx,1);}
        curMember=selectedMembers.length===1?selectedMembers[0]:(selectedMembers.length>1?'multi':'all');
      }
      curTag='all';curAlbum=null;buildSidebar();updateCounts();render();
    });
    mm.appendChild(b);
  });
  // ===== モバイル: カテゴリ（content_type）チップ =====
  const mct=document.getElementById('mobContentType');
  if(mct){
    mct.innerHTML='';
    CONTENT_TYPES.forEach(ct=>{
      const b=document.createElement('button');
      b.className='mob-chip'+(curContentType===ct.id?' on':'');
      b.textContent=t(ct.key);
      b.addEventListener('click',()=>{
        if(curContentType===ct.id) return;
        curContentType=ct.id;
        curTag='all';curAlbum=null;
        buildSidebar();updateCounts();render();
      });
      mct.appendChild(b);
    });
  }
  const mt=document.getElementById('mobTags');
  mt.innerHTML='';
  const ctVideos=videos.filter(v=>matchesContentType(v));
  const src=selectedMembers.length===0?ctVideos:ctVideos.filter(v=>selectedMembers.every(m=>parseMembers(v).includes(m)));
  const tags=allTagsOf(src);
  const allB=document.createElement('button');
  allB.className='mob-chip'+(curTag==='all'?' on':'');
  allB.textContent=t('allTag');
  allB.addEventListener('click',()=>{curTag='all';buildSidebar();updateCounts();render();});
  mt.appendChild(allB);
  tags.forEach(tag=>{
    const b=document.createElement('button');
    b.className='mob-chip'+(curTag===tag?' on':'');
    b.textContent='#'+tTag(tag);
    b.addEventListener('click',()=>{curTag=tag;buildSidebar();updateCounts();render();});
    mt.appendChild(b);
  });
}

export async function del(id,e){
  e.stopPropagation();e.preventDefault();
  if(!confirm(t('delConfirm')))return;
  try{await deleteVideoApiFn(id);_videosCacheTime=0;videos=videos.filter(v=>v.id!==id);buildSidebar();updateCounts();render();}
  catch(err){alert(err.message);}
}

export function edit(id,e){
  e.stopPropagation();e.preventDefault();
  const v=videos.find(x=>x.id===id);if(!v)return;
  editId=id;
  inputTags=parseTags(v);
  document.getElementById("iUrl").value=v.url||"";
  document.getElementById("iTitle").value=v.title||"";
  setSelectedMembersForm(v.member||"kafu");
  const iAlbumSel=document.getElementById('iAlbum');if(iAlbumSel) iAlbumSel.value=v.album_id||'';
  document.getElementById("iDate").value=v.date||"";
  document.getElementById("iSpotify").value=v.spotify_url||"";
  document.getElementById("iNote").value=v.note||"";
  const vid=ytId(v.url);
  if(vid){document.getElementById("thumbImg").src=`https://img.youtube.com/vi/${vid}/mqdefault.jpg`;document.getElementById("thumbPreview").style.display="block";}
  document.querySelector("#mover .modal h2").textContent="動画を編集";
  document.getElementById("mSave").textContent="更新する";
  document.getElementById("mover").classList.add("open"); setTimeout(()=>{renderTagChips();renderTagSuggest();},50);
}

export function showMb(v){return curMember==='all'?parseMembers(v).map(m=>mbPill(m)).join(''):''; }

export function setupObserver(){
  if(ioObserver) ioObserver.disconnect();
  const sentinel=document.getElementById('io-sentinel');
  if(!sentinel) return;
  ioObserver=new IntersectionObserver(entries=>{
    if(entries[0].isIntersecting) loadMoreItems();
  },{rootMargin:'200px'});
  ioObserver.observe(sentinel);
}

export function loadMoreItems(){
  const start=curPage*PAGE_SIZE;
  const chunk=filteredCache.slice(start,start+PAGE_SIZE);
  if(!chunk.length) return;
  curPage++;
  const c=document.getElementById('vc');
  const sentinel=document.getElementById('io-sentinel');
  if(curView==='grid'){
    const wrap=c.querySelector('.vgrid')||(() => {const d=document.createElement('div');d.className='vgrid';if(sentinel) c.insertBefore(d,sentinel);else c.appendChild(d);return d;})();
    chunk.forEach((v,i)=>{
      const div=document.createElement('div');
      div.className='vcard';div.style.animationDelay=((start+i)*CARD_ANIM_DELAY_STEP)+'s';
      div.onclick=()=>trackSongClick(v.id,safeUrl(v.url));
      div.innerHTML=`<div class="tw"><img src="${thumb(v)}" alt="" loading="lazy"><div class="tov"><div class="pico">▶</div></div></div><div class="cbody"><div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:.38rem">${tagPills(v)}${showMb(v)}</div><div class="ctitle">${newBadgeIds.has(v.id)?'<span class="new-badge">NEW</span>':''} ${esc(v.title)}</div><div class="cmeta"><span>${fmtDate(v.date)}</span>${spotifyBtn(v)}${v.note?`<span>${esc(v.note)}</span>`:''}${typeof window.shelfPinHtml==="function"?window.shelfPinHtml(v.id):""}${typeof window.olQuickSendHtml==="function"?window.olQuickSendHtml(v.id):""}${isAdmin?`<button class="dbtn" onclick="edit(${v.id},event)" style="color:var(--dim);">✎</button><button class="dbtn" onclick="del(${v.id},event)">✕</button>`:""}</div></div>`;
      wrap.appendChild(div);
    });
  } else if(curView==='list'){
    const wrap=c.querySelector('.vlist')||(() => {const d=document.createElement('div');d.className='vlist';if(sentinel) c.insertBefore(d,sentinel);else c.appendChild(d);return d;})();
    chunk.forEach((v,i)=>{
      const a=document.createElement('a');
      a.className='litem';a.style.animationDelay=((start+i)*CARD_ANIM_DELAY_STEP)+'s';
      a.href=safeUrl(v.url);a.target='_blank';a.rel='noopener';
      a.addEventListener('click',()=>_gtag('event','song_click',{song_title:v.title||'',member_name:v.member||'',video_date:v.date||'',album_id:v.album_id?String(v.album_id):''}));
      a.innerHTML=`<div class="lthumb"><img src="${thumb(v)}" alt="" loading="lazy"></div><div class="linfo"><div class="ltitle">${newBadgeIds.has(v.id)?'<span class="new-badge">NEW</span>':''} ${esc(v.title)}</div><div class="lmeta">${tagPills(v)}${showMb(v)}<span>${fmtDate(v.date)}</span>${spotifyBtn(v)}${v.note?`<span>${esc(v.note)}</span>`:''}</div></div>${typeof window.shelfPinHtml==="function"?window.shelfPinHtml(v.id):""}${typeof window.olQuickSendHtml==="function"?window.olQuickSendHtml(v.id):""}${isAdmin?`<button class="dbtn" onclick="edit(${v.id},event)" style="color:var(--dim);">✎</button><button class="dbtn" onclick="del(${v.id},event)">✕</button>`:""}`;
      wrap.appendChild(a);
    });
  } else {
    let tl=c.querySelector('.tl');
    if(!tl){
      tl=document.createElement('div');tl.className='tl';
      const line=document.createElement('div');line.className='tl-line';tl.appendChild(line);
      if(sentinel) c.insertBefore(tl,sentinel);else c.appendChild(tl);
    }
    let yr=tl.dataset.lastYr||'';
    chunk.forEach((v,i)=>{
      const y=v.date?v.date.slice(0,4):'?';
      if(y!==yr){
        yr=y;tl.dataset.lastYr=y;
        const yrDiv=document.createElement('div');yrDiv.className='tl-yr';yrDiv.textContent=y;tl.appendChild(yrDiv);
      }
      const row=document.createElement('div');
      row.className='tl-row';row.style.animationDelay=((start+i)*CARD_ANIM_DELAY_STEP)+'s';
      row.onclick=()=>trackSongClick(v.id,safeUrl(v.url));
      row.innerHTML=`<div class="tl-dot"></div><div class="tl-th"><img src="${thumb(v)}" alt="" loading="lazy"></div><div style="flex:1;min-width:0"><div class="tl-dt">${fmtDate(v.date)}</div><div class="tl-ti">${newBadgeIds.has(v.id)?'<span class="new-badge">NEW</span>':''} ${esc(v.title)}</div><div style="margin-top:5px;display:flex;gap:4px;flex-wrap:wrap">${tagPills(v)}${showMb(v)}${spotifyBtn(v)}${v.note?`<span style="font-size:.62rem;color:var(--dim)">${esc(v.note)}</span>`:''}</div></div>${typeof window.shelfPinHtml==="function"?window.shelfPinHtml(v.id):""}${typeof window.olQuickSendHtml==="function"?window.olQuickSendHtml(v.id):""}${isAdmin?`<button class="dbtn" onclick="edit(${v.id},event)" style="color:var(--dim);">✎</button><button class="dbtn" onclick="del(${v.id},event)">✕</button>`:""}`;
      tl.appendChild(row);
    });
  }
  if(curPage*PAGE_SIZE>=filteredCache.length){
    if(sentinel) sentinel.style.display='none';
    if(ioObserver) ioObserver.disconnect();
  } else {
    if(sentinel) sentinel.style.display='block';
  }
}

export function updateNewBadgeIds(){
  const members=['kafu','rime','harusar','isekai','koko','vwp'];
  newBadgeIds=new Set();
  members.forEach(m=>{
    const mv=[...videos].filter(v=>parseMembers(v).includes(m));
    mv.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    mv.slice(0,2).forEach(v=>newBadgeIds.add(v.id));
  });
}

// ===== アルバム棚ストリップ（メンバー1人選択時のみ・exportしない） =====
function shelfAlbums(){
  if(curAlbum!==null||curTag!=='all'||searchQ||curSort==='daily'||selectedMembers.length!==1) return [];
  return albums.filter(al=>al.member===selectedMembers[0]);
}
function buildAlbumShelf(list){
  const shelf=document.createElement('div');
  shelf.id='albumShelf';
  const title=document.createElement('div');
  title.className='al-shelf-title';
  title.textContent=`📀 ${t('albumShelfTitle')} (${list.length})`;
  shelf.appendChild(title);
  const row=document.createElement('div');
  row.className='al-shelf-row';
  list.forEach(al=>{
    const card=document.createElement('button');
    card.type='button';
    card.className='al-card';
    card.style.setProperty('--al-mc', getMemberColor(al.member));
    const th=albumThumb(al);
    const cnt=videos.filter(v=>v.album_id===al.id).length;
    const soldBadge=al.is_sold_out?'<span class="al-status-badge sold-out">SOLD OUT</span>':'';
    card.innerHTML=`<span class="al-card-disc" aria-hidden="true"></span>`
      +`<span class="al-card-jacket${th?'':' al-noimg'}">${th?`<img src="${esc(th)}" alt="" loading="lazy">`:'<span class="al-noimg-icon">📀</span>'}</span>`
      +`<span class="al-card-name">${esc(al.name)}</span>`
      +`<span class="al-card-meta"><span>${cnt} ${esc(t('shelfSongs'))}</span>${soldBadge}</span>`;
    card.addEventListener('click',()=>{
      curAlbum=al.id;
      _gtag('event','album_open',{album_title:al.name,member_name:al.member});
      buildSidebar();updateCounts();render();
    });
    row.appendChild(card);
  });
  shelf.appendChild(row);
  return shelf;
}

export function render(){
  updateNewBadgeIds();
  const ah=document.getElementById('albumHeader');
  if(ah){
    if(curAlbum!==null){
      const al=albums.find(a=>a.id===curAlbum);
      if(al){
        const th=albumThumb(al);
        ah.style.display='flex';
        const soldBadge=al.is_sold_out
          ? '<span class="al-status-badge sold-out">SOLD OUT</span>'
          : (al.purchase_url ? '<span class="al-status-badge on-sale">ON SALE</span>' : '');
        const updLabel=al.status_updated_at ? `<span class="al-updated-at">更新: ${al.status_updated_at}</span>` : '';
        ah.innerHTML=`
          <div class="al-thumb-wrap">${th?`<img src="${th}" alt="" class="al-thumb" loading="lazy">`:''}</div>
          <div class="al-info">
            <div class="al-name">${esc(al.name)}</div>
            <div class="al-member">${esc(mbr(al.member))}</div>
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">
              ${al.purchase_url?`<a class="al-buy-btn" href="${safeUrl(al.purchase_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">🛒 購入ページ</a>`:''}
              ${soldBadge}${updLabel}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:.4rem;align-items:flex-end;margin-left:auto;">
            ${isAdmin?`<button class="al-add-btn" id="alAddSongBtn">＋ 新規曲を追加</button>`:''}
            ${isAdmin?`<button class="al-add-btn" id="alLinkSongBtn" style="background:rgba(126,184,247,.15);color:#7eb8f7;border-color:rgba(126,184,247,.3);">🔗 既存曲を紐付け</button>`:''}
            ${isAdmin?`<button class="al-add-btn" id="alEditAlbumBtn" style="background:rgba(192,132,252,.12);color:#c084fc;border-color:rgba(192,132,252,.25);">⚙ アルバム編集</button>`:''}
          </div>`;
        if(isAdmin){
          document.getElementById('alAddSongBtn')?.addEventListener('click',()=>{
            editId=null;inputTags=[];renderTagChips();renderTagSuggest();
            document.querySelectorAll('#iMemberCb input[type=checkbox]').forEach(cb=>cb.checked=false);
            const cb=document.querySelector(`#iMemberCb input[value="${al.member}"]`);
            if(cb) cb.checked=true;
            const iAlbumSel=document.getElementById('iAlbum');
            if(iAlbumSel) iAlbumSel.value=al.id;
            document.querySelector('#mover .modal h2').textContent=`＋ ${al.name}`;
            document.getElementById('mSave').textContent=t('addBtn');
            document.getElementById('mover').classList.add('open');
          });
          document.getElementById('alLinkSongBtn')?.addEventListener('click',()=>openLinkSongModal(al));
          document.getElementById('alEditAlbumBtn')?.addEventListener('click',()=>openEditAlbumModal(al));
        }
      }
    } else {
      ah.style.display='none';
    }
  }
  if(curSort==='daily'){
    // Daily Pickも表示直前にカテゴリフィルタを適用（レビュー指摘対応）。
    // キャッシュ(localStorage vwp_daily_obs)はカテゴリ非依存で全picksのまま保持し、表示時のみ絞る
    filteredCache=getDailyPicksFromCache().filter(v=>matchesContentType(v));
  } else {
    filteredCache=filtered();
  }
  curPage=0;
  document.getElementById('rcnt').textContent=filteredCache.length+' 件';
  const c=document.getElementById('vc');
  const shelfList=shelfAlbums();
  if(!filteredCache.length && !shelfList.length){
    c.innerHTML=`<div class="empty"><div class="empty-i">🌙</div><h3>${t('notFound')}</h3></div><div id="io-sentinel" style="height:1px"></div>`;
    return;
  }
  c.innerHTML=`<div id="io-sentinel" style="height:1px"></div>`;
  if(shelfList.length) c.insertBefore(buildAlbumShelf(shelfList), c.firstChild);
  loadMoreItems();
  setupObserver();
}

// ===== tag input =====
export function renderTagSuggest(){
  const suggest=document.getElementById('tagSuggest');
  if(!suggest)return;
  const allT=allTagsOf(videos);
  if(!allT.length){suggest.style.display='none';return;}
  suggest.style.display='flex';
  suggest.innerHTML=allT.map(tag=>`<button onclick="addInputTag('${tag}');renderTagSuggest();" style="background:var(--surface2);border:1px solid var(--border);border-radius:3px;color:var(--dim);font-size:.65rem;padding:2px 8px;cursor:pointer;transition:all .2s;" onmouseover="this.style.color='#a0aaff'" onmouseout="this.style.color='var(--dim)'">#${tag}</button>`).join('');
}
export function renderTagChips(){
  const wrap=document.getElementById('tagInputWrap'),inp=document.getElementById('tagInput');
  wrap.querySelectorAll('.tag-chip').forEach(el=>el.remove());
  inputTags.forEach((tag,i)=>{
    const chip=document.createElement('span');chip.className='tag-chip';
    chip.innerHTML=`#${tag}<button onclick="removeInputTag(${i})">×</button>`;
    wrap.insertBefore(chip,inp);
  });
}
export function addInputTag(raw){const tag=raw.replace(/^#+/,'').trim();if(!tag||inputTags.includes(tag))return;inputTags.push(tag);renderTagChips();}
export function removeInputTag(i){inputTags.splice(i,1);renderTagChips();}

// ===== モーダル用メンバー選択（フォーム） =====
export function buildMemberSelect(){
  const wrap=document.getElementById('iMemberCb');
  if(!wrap)return;
  wrap.innerHTML='';
  MEMBERS.filter(m=>m.id!=='all').forEach(m=>{
    const lbl=document.createElement('label');
    lbl.style.cssText='display:inline-flex;align-items:center;gap:4px;background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:4px 10px;cursor:pointer;font-size:.76rem;transition:all .2s;';
    lbl.innerHTML=`<input type="checkbox" value="${m.id}" style="accent-color:#b0b8ff;"> ${m.emoji} ${mbr(m.id)}`;
    wrap.appendChild(lbl);
  });
}

export function refreshAlbumSelects(){
  const sel=document.getElementById('iAlbum');
  if(sel){
    sel.innerHTML='<option value="">なし</option>';
    albums.forEach(al=>{
      const opt=document.createElement('option');
      opt.value=al.id;opt.textContent=`📀 ${mbr(al.member)} - ${al.name}`;
      sel.appendChild(opt);
    });
  }
  refreshImportAlbumSelect();
}
export function refreshImportAlbumSelect(){
  const isel=document.getElementById('importAlbum');
  if(!isel) return;
  const member=document.getElementById('importMember')?.value||'';
  isel.innerHTML='<option value="">アルバムに紐付けない</option>';
  const VWP_MEMBERS=['kafu','rime','harusar','isekai','koko','vwp']; // 旧app.js L837 と同内容（未使用だが純粋移動のため維持）
  albums
    .filter(al=>{
      if(!member) return true;
      if(member==='vwp') return al.member==='vwp';
      return al.member===member || al.member==='vwp';
    })
    .forEach(al=>{
      const opt=document.createElement('option');
      opt.value=al.id;opt.textContent=`📀 ${mbr(al.member)} - ${al.name}`;
      isel.appendChild(opt);
    });
}
export function getSelectedMembersForm(){
  const cbs=document.querySelectorAll('#iMemberCb input[type=checkbox]:checked');
  const vals=[...cbs].map(cb=>cb.value);
  return vals.length?vals.join(' '):'kafu';
}
export function setSelectedMembersForm(memberStr){
  const ids=(memberStr||'').split(/[ ,]+/).filter(Boolean);
  document.querySelectorAll('#iMemberCb input[type=checkbox]').forEach(cb=>{
    cb.checked=ids.includes(cb.value);
  });
}

// ===== 既存曲紐付けモーダル =====
export function openLinkSongModal(al){
  const overlay=document.createElement('div');
  overlay.className='mover open';
  overlay.id='linkSongOverlay';
  const VWP_MEMBERS=['kafu','rime','harusar','isekai','koko','vwp'];
  const candidates=videos.filter(v=>{
    if(v.album_id) return false;
    const vMembers=(v.member||'').split(' ').map(s=>s.trim()).filter(Boolean);
    if(al.member==='vwp'){
      return vMembers.includes('vwp') && vMembers.length <= 3;
    }
    return vMembers.includes(al.member);
  }).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const linked=videos.filter(v=>v.album_id===al.id).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  overlay.innerHTML=`
    <div class="modal" style="max-width:520px;max-height:85vh;overflow-y:auto;">
      <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:1.3rem;letter-spacing:.12em;color:#7eb8f7;margin-bottom:1rem;">🔗 ${esc(al.name)} — 曲の管理</h2>
      <div style="margin-bottom:1.2rem;">
        <div style="font-size:.72rem;color:var(--dim);letter-spacing:.08em;margin-bottom:.5rem;">収録曲 (${linked.length}曲)</div>
        <div id="linkedList" style="display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto;">
          ${linked.length===0?'<div style="font-size:.78rem;color:var(--dim);padding:.3rem 0;">まだ収録曲がありません</div>':
            linked.map(v=>`
              <div style="display:flex;align-items:center;gap:.5rem;padding:.35rem .5rem;background:var(--surface2);border-radius:5px;font-size:.78rem;">
                <span style="flex:1;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(v.title)}</span>
                <span style="color:var(--dim);flex-shrink:0;">${esc(v.date||'')}</span>
                <button onclick="unlinkSong(${v.id},${al.id})" style="background:none;border:none;color:#fca5a5;cursor:pointer;font-size:.85rem;padding:0 4px;flex-shrink:0;" title="紐付けを解除">✕</button>
              </div>`).join('')}
        </div>
      </div>
      <div>
        <div style="font-size:.72rem;color:var(--dim);letter-spacing:.08em;margin-bottom:.5rem;">未収録の${al.member==='vwp'?'V.W.P':al.member}の曲 (${candidates.length}曲)</div>
        <input id="linkSongSearch" type="text" placeholder="タイトルで絞り込み…" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:.4rem .7rem;color:var(--text);font-size:.78rem;outline:none;margin-bottom:.5rem;">
        <div id="candidateList" style="display:flex;flex-direction:column;gap:4px;max-height:220px;overflow-y:auto;">
          ${candidates.length===0?'<div style="font-size:.78rem;color:var(--dim);">対象曲なし</div>':
            candidates.map(v=>`
              <div style="display:flex;align-items:center;gap:.5rem;padding:.35rem .5rem;background:var(--surface2);border-radius:5px;font-size:.78rem;" class="link-candidate">
                <span style="flex:1;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(v.title)}</span>
                <span style="color:var(--dim);flex-shrink:0;">${esc(v.date||'')}</span>
                <button onclick="linkSong(${v.id},${al.id})" style="background:rgba(126,184,247,.15);border:1px solid rgba(126,184,247,.3);color:#7eb8f7;cursor:pointer;font-size:.72rem;padding:2px 8px;border-radius:4px;flex-shrink:0;">紐付け</button>
              </div>`).join('')}
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:1rem;">
        <button onclick="document.getElementById('linkSongOverlay').remove()" class="btn btn-s">閉じる</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  document.getElementById('linkSongSearch')?.addEventListener('input',e=>{
    const q=e.target.value.toLowerCase();
    document.querySelectorAll('#candidateList .link-candidate').forEach(row=>{
      row.style.display=row.textContent.toLowerCase().includes(q)?'flex':'none';
    });
  });
}

export async function linkSong(videoId, albumId){
  try{
    await updateVideoApiFn(videoId,{album_id:albumId});
    _videosCacheTime=0;
    const v=videos.find(v=>v.id===videoId);
    if(v) v.album_id=albumId;
    document.getElementById('linkSongOverlay')?.remove();
    const al=albums.find(a=>a.id===albumId);
    if(al) openLinkSongModal(al);
    buildSidebar();updateCounts();render();
  }catch(e){alert('エラー: '+e.message);}
}

export async function unlinkSong(videoId, albumId){
  try{
    await updateVideoApiFn(videoId,{album_id:null});
    _videosCacheTime=0;
    const v=videos.find(v=>v.id===videoId);
    if(v) v.album_id=null;
    document.getElementById('linkSongOverlay')?.remove();
    const al=albums.find(a=>a.id===albumId);
    if(al) openLinkSongModal(al);
    buildSidebar();updateCounts();render();
  }catch(e){alert('エラー: '+e.message);}
}

// ===== アルバム編集モーダル =====
export function openEditAlbumModal(al){
  const overlay=document.createElement('div');
  overlay.className='mover open';
  overlay.id='editAlbumOverlay';
  const today=new Date().toISOString().slice(0,10);
  overlay.innerHTML=`
    <div class="modal" style="max-width:400px;">
      <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:1.3rem;letter-spacing:.12em;color:#c084fc;margin-bottom:1.2rem;">⚙ ${esc(al.name)} — 編集</h2>
      <div class="fg">
        <label>アルバム名</label>
        <input type="text" id="editAlName" value="${esc(al.name)}">
      </div>
      <div class="fg">
        <label>購入ページURL</label>
        <input type="text" id="editAlUrl" value="${esc(al.purchase_url||'')}">
      </div>
      <div class="fg" style="display:flex;align-items:center;gap:1rem;">
        <label style="margin:0;display:flex;align-items:center;gap:.5rem;cursor:pointer;">
          <input type="checkbox" id="editAlSoldOut" ${al.is_sold_out?'checked':''} style="width:auto;cursor:pointer;">
          <span>SOLD OUT</span>
        </label>
      </div>
      <div class="fg">
        <label>最終更新日 <span style="color:var(--dim);font-size:.65rem;">(在庫状況の更新日など)</span></label>
        <input type="date" id="editAlUpdatedAt" value="${al.status_updated_at||today}">
      </div>
      <div id="editAlStatus" style="font-size:.78rem;min-height:1.2rem;margin-bottom:.8rem;"></div>
      <div style="display:flex;gap:.6rem;justify-content:flex-end;">
        <button onclick="document.getElementById('editAlbumOverlay').remove()" class="btn btn-s">キャンセル</button>
        <button id="editAlSaveBtn" class="btn btn-p">保存する</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  document.getElementById('editAlSaveBtn')?.addEventListener('click',async()=>{
    const name=document.getElementById('editAlName').value.trim();
    const purchase_url=document.getElementById('editAlUrl').value.trim();
    const is_sold_out=document.getElementById('editAlSoldOut').checked;
    const status_updated_at=document.getElementById('editAlUpdatedAt').value||null;
    const st=document.getElementById('editAlStatus');
    if(!name){st.textContent='アルバム名を入力してください';st.style.color='#fca5a5';return;}
    st.textContent='保存中…';st.style.color='var(--dim)';
    try{
      const updated=await updateAlbumApiFn(al.id,{name,purchase_url,is_sold_out,status_updated_at});
      _albumsCacheTime=0;
      const idx=albums.findIndex(a=>a.id===al.id);
      if(idx!==-1) albums[idx]={...albums[idx],...updated};
      overlay.remove();
      buildSidebar();updateCounts();render();
    }catch(e){st.textContent='エラー: '+e.message;st.style.color='#fca5a5';}
  });
}

export function openAlbumModal(member){
  const sel=document.getElementById('albumMoverMember');
  if(sel) sel.value=member||'kafu';
  const memberRow=document.getElementById('albumMoverMemberRow');
  if(memberRow) memberRow.style.display=member?'none':'block';
  document.getElementById('albumName').value='';
  document.getElementById('albumPurchaseUrl').value='';
  document.getElementById('albumStatus').textContent='';
  document.getElementById('albumMover').classList.add('open');
  setTimeout(()=>document.getElementById('albumName').focus(),100);
}

export function setAdminMode(on){
  isAdmin=on;
  document.getElementById('fab').style.display=on?'flex':'none';
  document.getElementById('importBtn').style.display=on?'flex':'none';
  document.getElementById('albumAddBtn').style.display=on?'flex':'none';
  document.getElementById('loginBtn').style.display=on?'none':'flex';
  buildSidebar();updateCounts();render();
}

export async function verifyPw(pw){
  return verifyPwApi(pw);
}

// ===== initCore: イベント登録 + ブートストラップ =====
export function initCore(){
  // tag input events
  document.getElementById('tagInput').addEventListener('keydown',e=>{
    const val=e.target.value.trim();
    if(e.key==='Enter'||e.key===' '){e.preventDefault();if(val){addInputTag(val);e.target.value='';}}
    else if(e.key==='Backspace'&&!val&&inputTags.length){inputTags.pop();renderTagChips();}
  });
  document.getElementById('tagInput').addEventListener('blur',e=>{const val=e.target.value.trim();if(val){addInputTag(val);e.target.value='';}});
  document.getElementById('tagInputWrap').addEventListener('click',()=>document.getElementById('tagInput').focus());

  // search / view / sort events
  let _searchGa4Timer=null;
  document.getElementById('searchInput').addEventListener('input',e=>{searchQ=e.target.value.trim();render();clearTimeout(_searchGa4Timer);_searchGa4Timer=setTimeout(()=>{const q=searchQ;if(q.length>=2&&typeof window.gtag==='function'){window.gtag('event','search',{search_term:q,results_count:filteredCache.length});if(filteredCache.length===0)window.gtag('event','search_no_result',{search_term:q});}},500);});
  ['vGrid','vList','vTl'].forEach(id=>{
    document.getElementById(id).addEventListener('click',()=>{
      curView={vGrid:'grid',vList:'list',vTl:'timeline'}[id];
      document.querySelectorAll('.vbtn').forEach(b=>b.classList.remove('on'));
      document.getElementById(id).classList.add('on');render();
    });
  });
  document.getElementById('sNew').addEventListener('click',()=>{curSort='new';['sNew','sOld','sDailyPick','sDaily'].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.remove('on');});document.getElementById('sNew').classList.add('on');render();});
  document.getElementById('sOld').addEventListener('click',()=>{curSort='old';['sNew','sOld','sDailyPick','sDaily'].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.remove('on');});document.getElementById('sOld').classList.add('on');render();});
  document.getElementById('sDailyPick').addEventListener('click',()=>{curSort='daily';['sNew','sOld','sDailyPick','sDaily'].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.remove('on');});document.getElementById('sDailyPick').classList.add('on');render();});
  document.getElementById('sDaily').addEventListener('click',()=>{if(typeof window.openObserverLink==='function') window.openObserverLink();});

  document.querySelectorAll('.lbtn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      setLang(btn.dataset.lang);
      document.querySelectorAll('.lbtn').forEach(b=>b.classList.remove('on'));btn.classList.add('on');
      applyI18n();buildSidebar();updateCounts();render();
    });
  });

  document.getElementById('iUrl').addEventListener('input',e=>{
    const vid=ytId(e.target.value.trim());
    const prev=document.getElementById('thumbPreview');
    if(vid){document.getElementById('thumbImg').src=`https://img.youtube.com/vi/${vid}/mqdefault.jpg`;prev.style.display='block';}
    else prev.style.display='none';
  });
  document.getElementById('fetchBtn').addEventListener('click',async()=>{
    const url=document.getElementById('iUrl').value.trim();
    const status=document.getElementById('fetchStatus');
    if(!ytId(url)){status.textContent='有効なYouTube URLではありません';status.style.color='#fca5a5';return;}
    status.textContent=t('fetching');status.style.color='var(--dim)';
    try{
      const res=await fetch(`/api/youtube?id=${ytId(url)}`);const info=await res.json();
      if(info.error)throw new Error(info.error);
      if(info.title)document.getElementById('iTitle').value=info.title;
      if(info.date)document.getElementById('iDate').value=info.date;
      if(info.thumb){document.getElementById('thumbImg').src=info.thumb;document.getElementById('thumbPreview').style.display='block';}
      status.textContent=t('fetchOk');status.style.color='#6ee7b7';
    }catch(e){status.textContent='Error: '+e.message;status.style.color='#fca5a5';}
  });

  document.getElementById('fab').addEventListener('click',()=>{editId=null;inputTags=[];renderTagChips();renderTagSuggest();document.querySelectorAll('#iMemberCb input[type=checkbox]').forEach(cb=>cb.checked=false);document.querySelector('#mover .modal h2').textContent=t('addVideo');document.getElementById('mSave').textContent=t('addBtn');document.getElementById('mover').classList.add('open');});
  document.getElementById('mCancel').addEventListener('click',()=>{editId=null;document.querySelectorAll('#iMemberCb input[type=checkbox]').forEach(cb=>cb.checked=false);document.querySelector('#mover .modal h2').textContent=t('addVideo');document.getElementById('mSave').textContent=t('addBtn');document.getElementById('mover').classList.remove('open');});
  document.getElementById('mover').addEventListener('click',e=>{if(e.target===document.getElementById('mover'))document.getElementById('mover').classList.remove('open');});

  document.getElementById('mSave').addEventListener('click',async()=>{
    const url=document.getElementById('iUrl').value.trim();
    const title=document.getElementById('iTitle').value.trim();
    const member=getSelectedMembersForm();
    const date=document.getElementById('iDate').value;
    const spotify=document.getElementById('iSpotify').value.trim();
    const note=document.getElementById('iNote').value.trim();
    const albumSel=document.getElementById('iAlbum');const album_id=albumSel&&albumSel.value?parseInt(albumSel.value):null;
    const rawInput=document.getElementById('tagInput').value.trim();
    if(rawInput)addInputTag(rawInput);
    const tags=inputTags.join(' ');
    if(!url||!title){alert('URLとタイトルは必須です');return;}
    const saveBtn=document.getElementById('mSave');
    saveBtn.textContent=editId?'更新中…':t('adding');saveBtn.disabled=true;
    try{
      if(editId){
        const updated=await updateVideoApiFn(editId,{member,title,tags,date,url,note,spotify_url:spotify,album_id});
        _videosCacheTime=0;
        const idx=videos.findIndex(v=>v.id===editId);
        if(idx!==-1) videos[idx]={...videos[idx],...updated};
        editId=null;
      } else {
        const nv=await addVideoApiFn({member,title,tags,date,url,note,spotify_url:spotify,album_id});
        _videosCacheTime=0;
        videos.unshift(nv);
      }
      document.querySelector('#mover .modal h2').textContent=t('addVideo');
      document.getElementById('mover').classList.remove('open');
      ['iUrl','iTitle','iDate','iNote','iSpotify'].forEach(id=>document.getElementById(id).value='');
      document.getElementById('thumbPreview').style.display='none';
      inputTags=[];renderTagChips();
      buildSidebar();updateCounts();render();
    }catch(err){alert(err.message);}
    finally{saveBtn.textContent=t('addBtn');saveBtn.disabled=false;}
  });

  document.getElementById('albumMover')?.addEventListener('click',function(e){
    if(e.target===this) this.classList.remove('open');
  });
  document.getElementById('albumCancel')?.addEventListener('click',()=>{
    document.getElementById('albumMover').classList.remove('open');
  });
  document.getElementById('albumSave')?.addEventListener('click',async()=>{
    const member=document.getElementById('albumMoverMember').value;
    const name=document.getElementById('albumName').value.trim();
    const purchase_url=document.getElementById('albumPurchaseUrl').value.trim();
    const status=document.getElementById('albumStatus');
    if(!name){status.textContent='アルバム名を入力してください';status.style.color='#fca5a5';return;}
    status.textContent='追加中…';status.style.color='var(--dim)';
    try{
      const al=await addAlbumApiFn({member,name,purchase_url});
      _albumsCacheTime=0;
      await loadAlbums(true);
      refreshAlbumSelects();
      document.getElementById('albumMover').classList.remove('open');
      buildSidebar();updateCounts();
    }catch(e){status.textContent='エラー: '+e.message;status.style.color='#fca5a5';}
  });

  document.getElementById('loginBtn').addEventListener('click',()=>{
    document.getElementById('pwInput').value='';document.getElementById('pwStatus').textContent='';
    document.getElementById('loginMover').classList.add('open');
    setTimeout(()=>document.getElementById('pwInput').focus(),100);
  });
  document.getElementById('loginCancel').addEventListener('click',()=>document.getElementById('loginMover').classList.remove('open'));
  document.getElementById('loginMover').addEventListener('click',e=>{if(e.target===document.getElementById('loginMover'))document.getElementById('loginMover').classList.remove('open');});

  document.getElementById('albumAddBtn').addEventListener('click',()=>{
    openAlbumModal(null);
  });

  document.getElementById('loginSubmit').addEventListener('click',async()=>{
    const pw=document.getElementById('pwInput').value;
    const status=document.getElementById('pwStatus');
    status.textContent='確認中…';status.style.color='var(--dim)';
    try{
      const ok=await verifyPw(pw);
      if(!ok){status.textContent='パスワードが違います';status.style.color='#fca5a5';return;}
      storePw(pw);setAdminMode(true);document.getElementById('loginMover').classList.remove('open');
    }catch(e){status.textContent='Error: '+e.message;status.style.color='#fca5a5';}
  });
  document.getElementById('pwInput').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('loginSubmit').click();});

  document.getElementById('pageMover').addEventListener('click',function(e){if(e.target===this)closePage();});

  // テーマ切替
  const themeBtn = document.getElementById('themeBtn');
  const savedTheme = localStorage.getItem(THEME_SK);
  if(savedTheme === 'light'){ document.body.classList.add('light'); themeBtn.textContent='☀️'; }
  themeBtn.addEventListener('click', ()=>{
    const isLight = document.body.classList.toggle('light');
    themeBtn.textContent = isLight ? '☀️' : '🌙';
    localStorage.setItem(THEME_SK, isLight ? 'light' : 'dark');
  });

  // プレイリストインポート
  document.getElementById('importBtn').addEventListener('click',()=>{
    document.getElementById('importMover').classList.add('open');
    document.getElementById('importStatus').textContent='';
    document.getElementById('importPlaylistId').value='';
  });
  document.getElementById('importMember')?.addEventListener('change', ()=>{
    refreshImportAlbumSelect();
  });
  document.getElementById('importMover').addEventListener('click',function(e){
    if(e.target===this) this.classList.remove('open');
  });
  document.getElementById('importCancel').addEventListener('click',()=>{
    document.getElementById('importMover').classList.remove('open');
  });
  document.getElementById('importSubmit').addEventListener('click', async ()=>{
    const playlistId = document.getElementById('importPlaylistId').value.trim();
    const member = document.getElementById('importMember').value;
    const tags = document.getElementById('importTags').value.trim();
    const importAlbumSel=document.getElementById('importAlbum');const import_album_id=importAlbumSel&&importAlbumSel.value?parseInt(importAlbumSel.value):null;
    const status = document.getElementById('importStatus');
    if(!playlistId){ status.textContent='プレイリストIDを入力してください'; status.style.color='#fca5a5'; return; }
    const pw = getStoredPw();
    if(!pw){ status.textContent='ログインが必要です'; status.style.color='#fca5a5'; return; }
    status.textContent='取得中…'; status.style.color='var(--dim)';
    document.getElementById('importSubmit').disabled=true;
    try{
      const res = await fetch('/.netlify/functions/playlist-import',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ playlistId, member, tags, password: pw, album_id: import_album_id })
      });
      const data = await res.json();
      if(!res.ok){ status.textContent='エラー: '+(data.error||res.status); status.style.color='#fca5a5'; return; }
      status.textContent = `✅ ${data.message}`;
      status.style.color='#86efac';
      await loadVideos(true); buildSidebar(); updateCounts(); render();
    } catch(e){
      status.textContent='エラー: '+e.message; status.style.color='#fca5a5';
    } finally {
      document.getElementById('importSubmit').disabled=false;
    }
  });
}

// ===== bootstrap（async IIFE相当） =====
export async function bootstrapApp(){
  applyI18n();
  await loadVideos();
  await loadAlbums();
  refreshAlbumSelects();
  buildSidebar();buildMemberSelect();updateCounts();render();
  const savedPw=getStoredPw();
  if(savedPw){try{const ok=await verifyPw(savedPw);if(ok)setAdminMode(true);}catch{}}
}
