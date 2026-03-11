const I18N = {
  ja: { howtoMember:'メンバーで絞り込む', howtoTag:'タグで探す', howtoDaily:'今日の観測でランダムに発見', members:'メンバー', tags:'タグ', sort:'並び順:', newest:'新しい順', oldest:'古い順', addVideo:'動画を追加', fetch:'取得', titleLabel:'タイトル', memberLabel:'メンバー', tagsLabel:'タグ', tagHint:'（#をつけてEnterで追加）', pubdate:'公開日', note:'メモ', cancel:'キャンセル', addBtn:'追加する', adminLogin:'管理者ログイン', loginDesc:'パスワードを入力すると動画の追加・削除ができます。', password:'パスワード', login:'ログイン', notFound:'動画が見つかりません', fetching:'取得中…', fetchOk:'✓ タイトル・公開日・サムネイルを取得しました', delConfirm:'この動画を削除しますか？', adding:'追加中…', searchPh:'タイトルで検索…', spotify:'Spotify', allTag:'すべて', dailyObs:'✦ 今日の観測',
    mbr:{ all:'すべて', kafu:'花譜', rime:'理芽', harusar:'春猿火', isekai:'ヰ世界情緒', koko:'幸祜', vwp:'V.W.P' },
    tagMap:{} },
  en: { howtoMember:'Filter by member', howtoTag:'Search by tag', howtoDaily:'Discover randomly with Today\'s Observation', members:'Members', tags:'Tags', sort:'Sort:', newest:'Newest', oldest:'Oldest', addVideo:'Add Video', fetch:'Fetch', titleLabel:'Title', memberLabel:'Member', tagsLabel:'Tags', tagHint:'(type #tag + Enter)', pubdate:'Publish Date', note:'Notes', cancel:'Cancel', addBtn:'Add', adminLogin:'Admin Login', loginDesc:'Enter password to add/delete videos.', password:'Password', login:'Login', notFound:'No videos found', fetching:'Fetching…', fetchOk:'✓ Loaded title, date & thumbnail', delConfirm:'Delete this video?', adding:'Adding…', searchPh:'Search by title…', spotify:'Spotify', allTag:'All', dailyObs:'✦ Today\'s Observation',
    mbr:{ all:'All', kafu:'KAF', rime:'RIM', harusar:'HARUSARUHI', isekai:'ISEKAIJOUCHO', koko:'KOKO', vwp:'V.W.P' },
    tagMap:{ 'シングル':'Single', 'アニメ':'Anime', 'ゲーム':'Game', '映画':'Film', 'クインテット':'Quintet', 'デュエット':'Duet', 'トリオ':'Trio', '拡声曲':'Amplified', '系譜曲':'Lineage', 'Covered':'Covered', 'Remix':'Remix', 'sinka':'sinka', '社外コラボ':'Collab', 'ライブ':'Live', 'カバー':'Cover', 'コラボ':'Collab' } },
  zh: { howtoMember:'按成员筛选', howtoTag:'按标签搜索', howtoDaily:'用今日观测随机发现', members:'成员', tags:'标签', sort:'排序:', newest:'最新', oldest:'最旧', addVideo:'添加视频', fetch:'获取', titleLabel:'标题', memberLabel:'成员', tagsLabel:'标签', tagHint:'（输入#标签后按Enter）', pubdate:'发布日期', note:'备注', cancel:'取消', addBtn:'添加', adminLogin:'管理员登录', loginDesc:'输入密码以添加或删除视频。', password:'密码', login:'登录', notFound:'未找到视频', fetching:'获取中…', fetchOk:'✓ 已获取标题、日期和缩略图', delConfirm:'确认删除此视频？', adding:'添加中…', searchPh:'按标题搜索…', spotify:'Spotify', allTag:'全部', dailyObs:'✦ 今日的观测',
    mbr:{ all:'全部', kafu:'花谱', rime:'理芽', harusar:'春猿火', isekai:'异世界情绪', koko:'幸祜', vwp:'V.W.P' },
    tagMap:{ 'シングル':'单曲', 'アニメ':'动漫', 'ゲーム':'游戏', '映画':'电影', 'クインテット':'五重唱', 'デュエット':'二重唱', 'トリオ':'三重唱', '拡声曲':'扩声曲', '系譜曲':'系谱曲', 'Covered':'翻唱', 'Remix':'混音', 'sinka':'深化', '社外コラボ':'联动', 'ライブ':'现场', 'カバー':'翻唱', 'コラボ':'合作' } },
  ko: { howtoMember:'멤버로 필터링', howtoTag:'태그로 검색', howtoDaily:'오늘의 관측으로 랜덤 발견', members:'멤버', tags:'태그', sort:'정렬:', newest:'최신순', oldest:'오래된순', addVideo:'동영상 추가', fetch:'가져오기', titleLabel:'제목', memberLabel:'멤버', tagsLabel:'태그', tagHint:'(#태그 입력 후 Enter)', pubdate:'공개일', note:'메모', cancel:'취소', addBtn:'추가하기', adminLogin:'관리자 로그인', loginDesc:'비밀번호를 입력하면 동영상 추가·삭제가 가능합니다.', password:'비밀번호', login:'로그인', notFound:'동영상을 찾을 수 없습니다', fetching:'가져오는 중…', fetchOk:'✓ 제목·공개일·썸네일을 가져왔습니다', delConfirm:'이 동영상을 삭제하시겠습니까?', adding:'추가 중…', searchPh:'제목으로 검색…', spotify:'Spotify', allTag:'전체', dailyObs:'✦ 오늘의 관측',
    mbr:{ all:'전체', kafu:'카후', rime:'리메', harusar:'하루사루히', isekai:'이세카이죠초', koko:'코코', vwp:'V.W.P' },
    tagMap:{ 'シングル':'싱글', 'アニメ':'애니메이션', 'ゲーム':'게임', '映画':'영화', 'クインテット':'퀸텟', 'デュエット':'듀엣', 'トリオ':'트리오', '拡声曲':'확성곡', '系譜曲':'계보곡', 'Covered':'커버됨', 'Remix':'리믹스', 'sinka':'심화', '社外コラボ':'콜라보', 'ライブ':'라이브', 'カバー':'커버', 'コラボ':'콜라보' } }
};
let lang = 'ja';
function t(k){ return (I18N[lang]||I18N.ja)[k] || I18N.ja[k] || k; }
function mbr(id){ return (I18N[lang].mbr||I18N.ja.mbr)[id] || id; }
function applyI18n(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-sub]').forEach(el=>{ el.textContent = t(el.dataset.i18nSub); });
  document.getElementById('searchInput').placeholder = t('searchPh');
  const sd=document.getElementById('sDaily');if(sd) sd.textContent=t('dailyObs');
}

const MEMBERS = [
  {id:'all',emoji:'✦'},{id:'vwp',emoji:'✦'},{id:'kafu',emoji:'🌸'},{id:'rime',emoji:'🌱'},
  {id:'harusar',emoji:'🔥'},{id:'isekai',emoji:'🌼'},{id:'koko',emoji:'⚡️'}
];
const MBR_CLS = {kafu:'mb-kafu',rime:'mb-rime',harusar:'mb-harusar',isekai:'mb-isekai',koko:'mb-koko',vwp:'mb-vwp'};

function openPage(page){
  document.getElementById('pageAbout').style.display=page==='about'?'block':'none';
  document.getElementById('pageContact').style.display=page==='contact'?'block':'none';
  document.getElementById('pageUpdate').style.display=page==='update'?'block':'none';
  document.getElementById('pageMover').style.display='block';
  document.body.style.overflow='hidden';
  return false;
}
function closePage(){
  document.getElementById('pageMover').style.display='none';
  document.getElementById('pageAbout').style.display='none';
  document.getElementById('pageContact').style.display='none';
  document.getElementById('pageUpdate').style.display='none';
  document.body.style.overflow='';
}

let videos=[],curMember='all',selectedMembers=[],curTag='all',curSort='new',curView='grid',searchQ='',isAdmin=false,editId=null;
let filteredCache=[],curPage=0;
const PAGE_SIZE=30;
let ioObserver=null;
const PW_SK='vwp_admin_pw';
function getStoredPw(){try{return localStorage.getItem(PW_SK)||'';}catch{return '';}}
function storePw(pw){try{localStorage.setItem(PW_SK,pw);}catch{}}


let albums=[];
let curAlbum=null; // 選択中のアルバムid (nullなら未選択)

async function loadAlbums(){
  try{ const res=await fetch('/api/albums-get'); const d=await res.json(); if(Array.isArray(d)) albums=d; }catch(e){console.error(e);}
}
async function addAlbumApi(payload){
  const res=await fetch('/api/albums-add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:getStoredPw(),...payload})});
  const d=await res.json(); if(!res.ok) throw new Error(d.error||'failed'); return d;
}
async function deleteAlbumApi(id){
  const res=await fetch('/api/albums-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:getStoredPw(),id})});
  const d=await res.json(); if(!res.ok) throw new Error(d.error||'failed');
}

// アルバムの1曲目サムネイル
function albumThumb(album){
  const first=videos.find(v=>v.album_id===album.id);
  return first?thumb(first):'';
}
async function loadVideos(){
  try{ const res=await fetch('/api/videos-get'); const d=await res.json(); if(Array.isArray(d)) videos=d; }catch(e){console.error(e);}
}
async function addVideoApi(payload){
  const res=await fetch('/api/videos-add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:getStoredPw(),...payload})});
  const d=await res.json(); if(!res.ok) throw new Error(d.error||'failed'); return d;
}
async function deleteVideoApi(id){
  const res=await fetch('/api/videos-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:getStoredPw(),id})});
  const d=await res.json(); if(!res.ok) throw new Error(d.error||'failed');
}
async function updateVideoApi(id,payload){
  const res=await fetch("/api/videos-update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:getStoredPw(),id,...payload})});
  const d=await res.json(); if(!res.ok) throw new Error(d.error||"failed"); return d;
}

function ytId(url){const m=url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);return m?m[1]:null;}
function thumb(v){const id=ytId(v.url);return id?`https://img.youtube.com/vi/${id}/mqdefault.jpg`:'';}
function fmtDate(d){if(!d)return '';const dt=new Date(d+'T00:00:00');return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')}`;}
function parseTags(v){const raw=v.tags||v.tag||'';return raw.split(/[ ,]+/).map(s=>s.replace(/^#/,'')).filter(Boolean);}
function parseMembers(v){return (v.member||'').split(/[ ,]+/).filter(Boolean);}
function tTag(tag){ return (I18N[lang].tagMap||{})[tag] || tag; }
function tagPills(v){return parseTags(v).map(tag=>`<span class="pill">#${tTag(tag)}</span>`).join('');}
function mbPill(mid){return `<span class="pill ${MBR_CLS[mid]||''}">${mbr(mid)}</span>`;}
function spotifyBtn(v){if(!v.spotify_url)return '';return `<a class="spotify-btn" href="${v.spotify_url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">♫ ${t('spotify')}</a>`;}


// ===== 今日の観測 =====
const DAILY_MEMBERS = ['kafu','rime','harusar','isekai','koko'];
const DAILY_SK = 'vwp_daily_obs';

function seededRand(seed){
  let s = seed;
  return function(){
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function getTodayJST(){
  const now = new Date();
  // JST = UTC+9
  const jst = new Date(now.getTime() + 9*60*60*1000);
  return jst.toISOString().slice(0,10); // "YYYY-MM-DD"
}

function getDailyPicks(){
  const today = getTodayJST();
  try {
    const stored = JSON.parse(localStorage.getItem(DAILY_SK)||'null');
    if(stored && stored.date === today) return stored.picks;
  } catch(e){}

  // シード = 日付文字列をハッシュ化
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

function getDailyPicksFromCache(){
  const today = getTodayJST();
  try {
    const stored = JSON.parse(localStorage.getItem(DAILY_SK)||'null');
    if(stored && stored.date === today){
      return stored.picks.map(id=>videos.find(v=>v.id===id)).filter(Boolean);
    }
  } catch(e){}
  return getDailyPicks();
}

function filtered(){
  let list=videos.slice();
  // アルバム選択時はそのアルバム曲のみ、未選択時はアルバム曲を除外
  if(curAlbum!==null){
    list=list.filter(v=>v.album_id===curAlbum);
  } else {
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
function allTagsOf(src){const s=new Set();src.forEach(v=>parseTags(v).forEach(t=>s.add(t)));return [...s].sort();}

function updateCounts(){
  const srcM=curTag==='all'?videos:videos.filter(v=>parseTags(v).includes(curTag));
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
  const srcT=selectedMembers.length===0?videos:videos.filter(v=>selectedMembers.every(m=>parseMembers(v).includes(m)));
  const el0=document.getElementById('tc-all');if(el0)el0.textContent=srcT.length;
  allTagsOf(srcT).forEach(tag=>{const el=document.getElementById('tc-'+tag);if(el)el.textContent=srcT.filter(v=>parseTags(v).includes(tag)).length;});
}

function buildSidebar(){
  const mp=document.getElementById('memberPills');
  mp.innerHTML='';
  // 選択数表示
  const selCount=document.getElementById('memberSelCount');
  if(selCount) selCount.textContent=selectedMembers.length>0?`(${selectedMembers.length}/3選択中)`:'';
  // リセットボタン（複数選択時のみ表示）
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

    // 組み合わせ可能かどうか判定（1人以上選択済みで未選択・非allのメンバー）
    let dimmed=false;
    if(selectedMembers.length>0 && !isAll && !isSelected && selectedMembers.length<3){
      const testSel=[...selectedMembers,m.id];
      const comboCount=videos.filter(v=>testSel.every(sm=>parseMembers(v).includes(sm))).length;
      if(comboCount===0) dimmed=true;
    }
    // 3人選択済みで未選択のメンバーは追加不可
    if(selectedMembers.length>=3 && !isSelected && !isAll) dimmed=true;

    btn.className='mpill'+(isAll&&selectedMembers.length===0?' on':(isSelected?' on':''));
    if(dimmed){ btn.style.opacity='0.3'; btn.style.cursor='not-allowed'; }
    btn.dataset.m=m.id;
    btn.innerHTML=`<span class="mpill-icon">${m.emoji}</span><span class="mpill-name">${mbr(m.id)}</span><span class="mpill-cnt" id="mc-${m.id}">0</span>`;
    btn.addEventListener('click',()=>{
      if(dimmed) return; // 組み合わせなし・上限時はクリック無効
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
    // 選択中メンバーに対応するアルバムを絞り込み
    const memberAlbums=albums.filter(al=>{
      if(selectedMembers.length===0) return false; // メンバー未選択時は非表示
      // 単一メンバー選択時のみアルバム表示（コラボ曲はアルバムに入れる想定なし）
      if(selectedMembers.length===1) return al.member===selectedMembers[0];
      return false;
    });
    const albumSec=document.getElementById('albumSection');
    if(albumSec) albumSec.style.display=memberAlbums.length>0?'block':'none';
    memberAlbums.forEach(al=>{
      const btn=document.createElement('button');
      const isOn=curAlbum===al.id;
      btn.className='cfilt album-filt'+(isOn?' on':'');
      btn.innerHTML=`<span class="cfilt-label">📀 ${al.name}</span>`;
      if(isAdmin){
        const del=document.createElement('span');
        del.textContent=' ✕';
        del.style.cssText='font-size:.6rem;opacity:.5;margin-left:2px;cursor:pointer;';
        del.addEventListener('click',async(e)=>{
          e.stopPropagation();
          if(!confirm(`アルバム「${al.name}」を削除しますか？（収録曲のアルバム紐付けも解除されます）`)) return;
          await deleteAlbumApi(al.id);
          if(curAlbum===al.id){curAlbum=null;}
          await loadAlbums();
          buildSidebar();updateCounts();render();
        });
        btn.appendChild(del);
      }
      btn.addEventListener('click',()=>{
        curAlbum=isOn?null:al.id;
        buildSidebar();updateCounts();render();
      });
      af.appendChild(btn);
    });
    // 管理者：アルバム追加ボタン
    if(isAdmin && selectedMembers.length===1){
      const addBtn=document.createElement('button');
      addBtn.className='cfilt';
      addBtn.style.cssText='border-style:dashed;opacity:.6;';
      addBtn.textContent='＋ アルバムを追加';
      addBtn.addEventListener('click',()=>openAlbumModal(selectedMembers[0]));
      af.appendChild(addBtn);
    }
  }

  const tf=document.getElementById('tagFilters');
  tf.innerHTML='';
  const src=selectedMembers.length===0?videos:videos.filter(v=>selectedMembers.every(m=>parseMembers(v).includes(m)));
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

function buildMobFilters(){
  // メンバーチップ
  const mm=document.getElementById('mobMembers');
  if(!mm)return;
  mm.innerHTML='';
  // リセットボタン（複数選択時のみ）
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
  // タグチップ
  const mt=document.getElementById('mobTags');
  mt.innerHTML='';
  const src=selectedMembers.length===0?videos:videos.filter(v=>selectedMembers.every(m=>parseMembers(v).includes(m)));
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

async function del(id,e){
  e.stopPropagation();e.preventDefault();
  if(!confirm(t('delConfirm')))return;
  try{await deleteVideoApi(id);videos=videos.filter(v=>v.id!==id);buildSidebar();updateCounts();render();}
  catch(err){alert(err.message);}
}

function edit(id,e){
  e.stopPropagation();e.preventDefault();
  const v=videos.find(x=>x.id===id);if(!v)return;
  editId=id;
  inputTags=parseTags(v);
  document.getElementById("iUrl").value=v.url||"";
  document.getElementById("iTitle").value=v.title||"";
  setSelectedMembers(v.member||"kafu");
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

function showMb(v){return curMember==='all'?parseMembers(v).map(m=>mbPill(m)).join(''):'';}

function renderGrid(list){
  if(!list.length)return `<div class="empty"><div class="empty-i">🌙</div><h3>${t('notFound')}</h3></div>`;
  return `<div class="vgrid">`+list.map((v,i)=>`
    <div class="vcard" style="animation-delay:${i*.022}s" onclick="window.open('${v.url}','_blank')">
      <div class="tw"><img src="${thumb(v)}" alt="" loading="lazy"><div class="tov"><div class="pico">▶</div></div></div>
      <div class="cbody">
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:.38rem">${tagPills(v)}${showMb(v)}</div>
        <div class="ctitle">${newBadgeIds.has(v.id)?'<span class="new-badge">NEW</span>':''} ${v.title}</div>
        <div class="cmeta"><span>${fmtDate(v.date)}</span>${spotifyBtn(v)}${v.note?`<span>${v.note}</span>`:''}${isAdmin?`<button class="dbtn" onclick="edit(${v.id},event)" style="color:var(--dim);">✎</button><button class="dbtn" onclick="del(${v.id},event)">✕</button>`:""}</div>
      </div>
    </div>`).join('')+`</div>`;
}
function renderList(list){
  if(!list.length)return `<div class="empty"><div class="empty-i">🌙</div><h3>${t('notFound')}</h3></div>`;
  return `<div class="vlist">`+list.map((v,i)=>`
    <a class="litem" style="animation-delay:${i*.022}s" href="${v.url}" target="_blank" rel="noopener">
      <div class="lthumb"><img src="${thumb(v)}" alt="" loading="lazy"></div>
      <div class="linfo"><div class="ltitle">${newBadgeIds.has(v.id)?'<span class="new-badge">NEW</span>':''} ${v.title}</div><div class="lmeta">${tagPills(v)}${showMb(v)}<span>${fmtDate(v.date)}</span>${spotifyBtn(v)}${v.note?`<span>${v.note}</span>`:''}</div></div>
      ${isAdmin?`<button class="dbtn" onclick="edit(${v.id},event)" style="color:var(--dim);">✎</button><button class="dbtn" onclick="del(${v.id},event)">✕</button>`:""}
    </a>`).join('')+`</div>`;
}
function renderTimeline(list){
  if(!list.length)return `<div class="empty"><div class="empty-i">🌙</div><h3>${t('notFound')}</h3></div>`;
  let html=`<div class="tl"><div class="tl-line"></div>`,yr='';
  list.forEach((v,i)=>{
    const y=v.date?v.date.slice(0,4):'?';
    if(y!==yr){yr=y;html+=`<div class="tl-yr">${y}</div>`;}
    html+=`<div class="tl-row" style="animation-delay:${i*.022}s" onclick="window.open('${v.url}','_blank')">
      <div class="tl-dot"></div>
      <div class="tl-th"><img src="${thumb(v)}" alt="" loading="lazy"></div>
      <div style="flex:1;min-width:0"><div class="tl-dt">${fmtDate(v.date)}</div><div class="tl-ti">${newBadgeIds.has(v.id)?'<span class="new-badge">NEW</span>':''} ${v.title}</div>
      <div style="margin-top:5px;display:flex;gap:4px;flex-wrap:wrap">${tagPills(v)}${showMb(v)}${spotifyBtn(v)}${v.note?`<span style="font-size:.62rem;color:var(--dim)">${v.note}</span>`:''}</div></div>
      ${isAdmin?`<button class="dbtn" onclick="edit(${v.id},event)" style="color:var(--dim);">✎</button><button class="dbtn" onclick="del(${v.id},event)">✕</button>`:""}
    </div>`;
  });
  return html+'</div>';
}
function setupObserver(){
  if(ioObserver) ioObserver.disconnect();
  const sentinel=document.getElementById('io-sentinel');
  if(!sentinel) return;
  ioObserver=new IntersectionObserver(entries=>{
    if(entries[0].isIntersecting) loadMoreItems();
  },{rootMargin:'200px'});
  ioObserver.observe(sentinel);
}

function loadMoreItems(){
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
      div.className='vcard';div.style.animationDelay=((start+i)*.022)+'s';
      div.onclick=()=>window.open(v.url,'_blank');
      div.innerHTML=`<div class="tw"><img src="${thumb(v)}" alt="" loading="lazy"><div class="tov"><div class="pico">▶</div></div></div><div class="cbody"><div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:.38rem">${tagPills(v)}${showMb(v)}</div><div class="ctitle">${newBadgeIds.has(v.id)?'<span class="new-badge">NEW</span>':''} ${v.title}</div><div class="cmeta"><span>${fmtDate(v.date)}</span>${spotifyBtn(v)}${v.note?`<span>${v.note}</span>`:''}${isAdmin?`<button class="dbtn" onclick="edit(${v.id},event)" style="color:var(--dim);">✎</button><button class="dbtn" onclick="del(${v.id},event)">✕</button>`:""}</div></div>`;
      wrap.appendChild(div);
    });
  } else if(curView==='list'){
    const wrap=c.querySelector('.vlist')||(() => {const d=document.createElement('div');d.className='vlist';if(sentinel) c.insertBefore(d,sentinel);else c.appendChild(d);return d;})();
    chunk.forEach((v,i)=>{
      const a=document.createElement('a');
      a.className='litem';a.style.animationDelay=((start+i)*.022)+'s';
      a.href=v.url;a.target='_blank';a.rel='noopener';
      a.innerHTML=`<div class="lthumb"><img src="${thumb(v)}" alt="" loading="lazy"></div><div class="linfo"><div class="ltitle">${newBadgeIds.has(v.id)?'<span class="new-badge">NEW</span>':''} ${v.title}</div><div class="lmeta">${tagPills(v)}${showMb(v)}<span>${fmtDate(v.date)}</span>${spotifyBtn(v)}${v.note?`<span>${v.note}</span>`:''}</div></div>${isAdmin?`<button class="dbtn" onclick="edit(${v.id},event)" style="color:var(--dim);">✎</button><button class="dbtn" onclick="del(${v.id},event)">✕</button>`:""}`;
      wrap.appendChild(a);
    });
  } else {
    // タイムライン：既存のtl divに追記 or 新規作成
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
      row.className='tl-row';row.style.animationDelay=((start+i)*.022)+'s';
      row.onclick=()=>window.open(v.url,'_blank');
      row.innerHTML=`<div class="tl-dot"></div><div class="tl-th"><img src="${thumb(v)}" alt="" loading="lazy"></div><div style="flex:1;min-width:0"><div class="tl-dt">${fmtDate(v.date)}</div><div class="tl-ti">${newBadgeIds.has(v.id)?'<span class="new-badge">NEW</span>':''} ${v.title}</div><div style="margin-top:5px;display:flex;gap:4px;flex-wrap:wrap">${tagPills(v)}${showMb(v)}${spotifyBtn(v)}${v.note?`<span style="font-size:.62rem;color:var(--dim)">${v.note}</span>`:''}</div></div>${isAdmin?`<button class="dbtn" onclick="edit(${v.id},event)" style="color:var(--dim);">✎</button><button class="dbtn" onclick="del(${v.id},event)">✕</button>`:""}`;
      tl.appendChild(row);
    });
  }
  // 全件描画済みならsentinelを隠す
  if(curPage*PAGE_SIZE>=filteredCache.length){
    if(sentinel) sentinel.style.display='none';
    if(ioObserver) ioObserver.disconnect();
  } else {
    if(sentinel) sentinel.style.display='block';
  }
}


// 全動画のcreated_atで新しい順に並べ、上位2件のidをNewバッジ対象とする
let newBadgeIds=new Set();
function updateNewBadgeIds(){
  const sorted=[...videos].sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
  newBadgeIds=new Set(sorted.slice(0,2).map(v=>v.id));
}
function render(){
  updateNewBadgeIds();
  // アルバムヘッダー表示
  const ah=document.getElementById('albumHeader');
  if(ah){
    if(curAlbum!==null){
      const al=albums.find(a=>a.id===curAlbum);
      if(al){
        const th=albumThumb(al);
        ah.style.display='flex';
        ah.innerHTML=`
          <div class="al-thumb-wrap">${th?`<img src="${th}" alt="" class="al-thumb">`:''}</div>
          <div class="al-info">
            <div class="al-name">${al.name}</div>
            <div class="al-member">${mbr(al.member)}</div>
            ${al.purchase_url?`<a class="al-buy-btn" href="${al.purchase_url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">🛒 購入ページ</a>`:''}
          </div>
          ${isAdmin?`<button class="al-add-btn" id="alAddSongBtn">＋ 曲を追加</button>`:''}`;
        if(isAdmin){
          document.getElementById('alAddSongBtn')?.addEventListener('click',()=>{
            // 動画追加モーダルをこのアルバムにプリセットして開く
            editId=null;inputTags=[];renderTagChips();renderTagSuggest();
            document.querySelectorAll('#iMemberCb input[type=checkbox]').forEach(cb=>cb.checked=false);
            // アルバムのメンバーを自動選択
            const cb=document.querySelector(`#iMemberCb input[value="${al.member}"]`);
            if(cb) cb.checked=true;
            // アルバムを自動セット
            const iAlbumSel=document.getElementById('iAlbum');
            if(iAlbumSel) iAlbumSel.value=al.id;
            document.querySelector('#mover .modal h2').textContent=`＋ ${al.name}`;
            document.getElementById('mSave').textContent=t('addBtn');
            document.getElementById('mover').classList.add('open');
          });
        }
      }
    } else {
      ah.style.display='none';
    }
  }
  if(curSort==='daily'){
    filteredCache=getDailyPicksFromCache();
  } else {
    filteredCache=filtered();
  }
  curPage=0;
  document.getElementById('rcnt').textContent=filteredCache.length+' 件';
  const c=document.getElementById('vc');
  if(!filteredCache.length){
    c.innerHTML=`<div class="empty"><div class="empty-i">🌙</div><h3>${t('notFound')}</h3></div><div id="io-sentinel" style="height:1px"></div>`;
    return;
  }
  c.innerHTML=`<div id="io-sentinel" style="height:1px"></div>`;
  // sentinelを末尾に移動するためにプレースホルダー挿入後すぐloadMore
  loadMoreItems();
  setupObserver();
}

// tag input
let inputTags=[];
function renderTagSuggest(){
  const suggest=document.getElementById('tagSuggest');
  if(!suggest)return;
  const allT=allTagsOf(videos);
  if(!allT.length){suggest.style.display='none';return;}
  suggest.style.display='flex';
  suggest.innerHTML=allT.map(tag=>`<button onclick="addInputTag('${tag}');renderTagSuggest();" style="background:var(--surface2);border:1px solid var(--border);border-radius:3px;color:var(--dim);font-size:.65rem;padding:2px 8px;cursor:pointer;transition:all .2s;" onmouseover="this.style.color='#a0aaff'" onmouseout="this.style.color='var(--dim)'">#${tag}</button>`).join('');
}
function renderTagChips(){
  const wrap=document.getElementById('tagInputWrap'),inp=document.getElementById('tagInput');
  wrap.querySelectorAll('.tag-chip').forEach(el=>el.remove());
  inputTags.forEach((tag,i)=>{
    const chip=document.createElement('span');chip.className='tag-chip';
    chip.innerHTML=`#${tag}<button onclick="removeInputTag(${i})">×</button>`;
    wrap.insertBefore(chip,inp);
  });
}
function addInputTag(raw){const tag=raw.replace(/^#+/,'').trim();if(!tag||inputTags.includes(tag))return;inputTags.push(tag);renderTagChips();}
function removeInputTag(i){inputTags.splice(i,1);renderTagChips();}
document.getElementById('tagInput').addEventListener('keydown',e=>{
  const val=e.target.value.trim();
  if(e.key==='Enter'||e.key===' '){e.preventDefault();if(val){addInputTag(val);e.target.value='';}}
  else if(e.key==='Backspace'&&!val&&inputTags.length){inputTags.pop();renderTagChips();}
});
document.getElementById('tagInput').addEventListener('blur',e=>{const val=e.target.value.trim();if(val){addInputTag(val);e.target.value='';}});
document.getElementById('tagInputWrap').addEventListener('click',()=>document.getElementById('tagInput').focus());

// events
document.getElementById('searchInput').addEventListener('input',e=>{searchQ=e.target.value.trim();render();});
['vGrid','vList','vTl'].forEach(id=>{
  document.getElementById(id).addEventListener('click',()=>{
    curView={vGrid:'grid',vList:'list',vTl:'timeline'}[id];
    document.querySelectorAll('.vbtn').forEach(b=>b.classList.remove('on'));
    document.getElementById(id).classList.add('on');render();
  });
});
document.getElementById('sNew').addEventListener('click',()=>{curSort='new';['sNew','sOld','sDaily'].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.remove('on');});document.getElementById('sNew').classList.add('on');render();});
document.getElementById('sOld').addEventListener('click',()=>{curSort='old';['sNew','sOld','sDaily'].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.remove('on');});document.getElementById('sOld').classList.add('on');render();});
document.getElementById('sDaily').addEventListener('click',()=>{curSort='daily';['sNew','sOld','sDaily'].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.remove('on');});document.getElementById('sDaily').classList.add('on');render();});

document.querySelectorAll('.lbtn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    lang=btn.dataset.lang;
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
  const member=getSelectedMembers();
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
      const updated=await updateVideoApi(editId,{member,title,tags,date,url,note,spotify_url:spotify,album_id});
      const idx=videos.findIndex(v=>v.id===editId);
      if(idx!==-1) videos[idx]={...videos[idx],...updated};
      editId=null;
    } else {
      const nv=await addVideoApi({member,title,tags,date,url,note,spotify_url:spotify,album_id});
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

function buildMemberSelect(){
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

function refreshAlbumSelects(){
  // 動画追加モーダルのアルバム選択を更新
  const sel=document.getElementById('iAlbum');
  if(sel){
    sel.innerHTML='<option value="">なし</option>';
    albums.forEach(al=>{
      const opt=document.createElement('option');
      opt.value=al.id;opt.textContent=`📀 ${mbr(al.member)} - ${al.name}`;
      sel.appendChild(opt);
    });
  }
  // インポートモーダルのアルバム選択を更新
  const isel=document.getElementById('importAlbum');
  if(isel){
    isel.innerHTML='<option value="">アルバムに紐付けない</option>';
    albums.forEach(al=>{
      const opt=document.createElement('option');
      opt.value=al.id;opt.textContent=`📀 ${mbr(al.member)} - ${al.name}`;
      isel.appendChild(opt);
    });
  }
}
function getSelectedMembers(){
  const cbs=document.querySelectorAll('#iMemberCb input[type=checkbox]:checked');
  const vals=[...cbs].map(cb=>cb.value);
  return vals.length?vals.join(' '):'kafu';
}
function setSelectedMembers(memberStr){
  const ids=(memberStr||'').split(/[ ,]+/).filter(Boolean);
  document.querySelectorAll('#iMemberCb input[type=checkbox]').forEach(cb=>{
    cb.checked=ids.includes(cb.value);
  });
}


function openAlbumModal(member){
  // memberが指定されていれば選択状態にする、なければ先頭メンバーを選択
  const sel=document.getElementById('albumMoverMember');
  if(sel) sel.value=member||'kafu';
  // セレクトボックスの表示制御：memberが指定済みなら非表示（サイドバー経由）
  const memberRow=document.getElementById('albumMoverMemberRow');
  if(memberRow) memberRow.style.display=member?'none':'block';
  document.getElementById('albumName').value='';
  document.getElementById('albumPurchaseUrl').value='';
  document.getElementById('albumStatus').textContent='';
  document.getElementById('albumMover').classList.add('open');
  setTimeout(()=>document.getElementById('albumName').focus(),100);
}

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
    const al=await addAlbumApi({member,name,purchase_url});
    albums.push(al);
    refreshAlbumSelects();
    document.getElementById('albumMover').classList.remove('open');
    buildSidebar();updateCounts();
  }catch(e){status.textContent='エラー: '+e.message;status.style.color='#fca5a5';}
});

function setAdminMode(on){
  isAdmin=on;
  document.getElementById('fab').style.display=on?'flex':'none';
  document.getElementById('importBtn').style.display=on?'flex':'none';
  document.getElementById('albumAddBtn').style.display=on?'flex':'none';
  document.getElementById('loginBtn').style.display=on?'none':'flex';
  buildSidebar();updateCounts();render();
}

document.getElementById('loginBtn').addEventListener('click',()=>{
  document.getElementById('pwInput').value='';document.getElementById('pwStatus').textContent='';
  document.getElementById('loginMover').classList.add('open');
  setTimeout(()=>document.getElementById('pwInput').focus(),100);
});
document.getElementById('loginCancel').addEventListener('click',()=>document.getElementById('loginMover').classList.remove('open'));
document.getElementById('loginMover').addEventListener('click',e=>{if(e.target===document.getElementById('loginMover'))document.getElementById('loginMover').classList.remove('open');});

// アルバム追加FAB（管理者ならどこからでも）
document.getElementById('albumAddBtn').addEventListener('click',()=>{
  // メンバー選択行を表示してモーダルを開く（メンバー未指定）
  openAlbumModal(null);
});

async function verifyPw(pw){
  const res=await fetch("/api/auth-check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:pw})});
  return res.ok;
}
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

(async()=>{
  applyI18n();
  await loadVideos();
  await loadAlbums();
  refreshAlbumSelects();
  buildSidebar();buildMemberSelect();updateCounts();render();
  const savedPw=getStoredPw();
  if(savedPw){try{const ok=await verifyPw(savedPw);if(ok)setAdminMode(true);}catch{}}
})();

document.getElementById('pageMover').addEventListener('click',function(e){if(e.target===this)closePage();});

// テーマ切替
const themeBtn = document.getElementById('themeBtn');
const savedTheme = localStorage.getItem('vwp_theme');
if(savedTheme === 'light'){ document.body.classList.add('light'); themeBtn.textContent='☀️'; }
themeBtn.addEventListener('click', ()=>{
  const isLight = document.body.classList.toggle('light');
  themeBtn.textContent = isLight ? '☀️' : '🌙';
  localStorage.setItem('vwp_theme', isLight ? 'light' : 'dark');
});

// プレイリストインポート
document.getElementById('importBtn').addEventListener('click',()=>{
  document.getElementById('importMover').classList.add('open');
  document.getElementById('importStatus').textContent='';
  document.getElementById('importPlaylistId').value='';
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
    await loadVideos(); buildSidebar(); updateCounts(); render();
  } catch(e){
    status.textContent='エラー: '+e.message; status.style.color='#fca5a5';
  } finally {
    document.getElementById('importSubmit').disabled=false;
  }
});