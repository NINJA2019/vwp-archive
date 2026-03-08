const I18N = {
  ja: { members:'メンバー', tags:'タグ', sort:'並び順:', newest:'新しい順', oldest:'古い順', addVideo:'動画を追加', fetch:'取得', titleLabel:'タイトル', memberLabel:'メンバー', tagsLabel:'タグ', tagHint:'（#をつけてEnterで追加）', pubdate:'公開日', note:'メモ', cancel:'キャンセル', addBtn:'追加する', adminLogin:'管理者ログイン', loginDesc:'パスワードを入力すると動画の追加・削除ができます。', password:'パスワード', login:'ログイン', notFound:'動画が見つかりません', fetching:'取得中…', fetchOk:'✓ タイトル・公開日・サムネイルを取得しました', delConfirm:'この動画を削除しますか？', adding:'追加中…', searchPh:'タイトルで検索…', spotify:'Spotify', allTag:'すべて',
    mbr:{ all:'すべて', kafu:'花譜', rime:'理芽', harusar:'春猿火', isekai:'ヰ世界情緒', koko:'幸祜', vwp:'V.W.P' } },
  en: { members:'Members', tags:'Tags', sort:'Sort:', newest:'Newest', oldest:'Oldest', addVideo:'Add Video', fetch:'Fetch', titleLabel:'Title', memberLabel:'Member', tagsLabel:'Tags', tagHint:'(type #tag + Enter)', pubdate:'Publish Date', note:'Notes', cancel:'Cancel', addBtn:'Add', adminLogin:'Admin Login', loginDesc:'Enter password to add/delete videos.', password:'Password', login:'Login', notFound:'No videos found', fetching:'Fetching…', fetchOk:'✓ Loaded title, date & thumbnail', delConfirm:'Delete this video?', adding:'Adding…', searchPh:'Search by title…', spotify:'Spotify', allTag:'All',
    mbr:{ all:'All', kafu:'KAF', rime:'RIM', harusar:'HARUSARUHI', isekai:'ISEKAIJOUCHO', koko:'KOKO', vwp:'V.W.P' } },
  zh: { members:'成员', tags:'标签', sort:'排序:', newest:'最新', oldest:'最旧', addVideo:'添加视频', fetch:'获取', titleLabel:'标题', memberLabel:'成员', tagsLabel:'标签', tagHint:'（输入#标签后按Enter）', pubdate:'发布日期', note:'备注', cancel:'取消', addBtn:'添加', adminLogin:'管理员登录', loginDesc:'输入密码以添加或删除视频。', password:'密码', login:'登录', notFound:'未找到视频', fetching:'获取中…', fetchOk:'✓ 已获取标题、日期和缩略图', delConfirm:'确认删除此视频？', adding:'添加中…', searchPh:'按标题搜索…', spotify:'Spotify', allTag:'全部',
    mbr:{ all:'全部', kafu:'花谱', rime:'理芽', harusar:'春猿火', isekai:'异世界情绪', koko:'幸祜', vwp:'V.W.P' } }
};
let lang = 'ja';
function t(k){ return (I18N[lang]||I18N.ja)[k] || I18N.ja[k] || k; }
function mbr(id){ return (I18N[lang].mbr||I18N.ja.mbr)[id] || id; }
function applyI18n(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-sub]').forEach(el=>{ el.textContent = t(el.dataset.i18nSub); });
  document.getElementById('searchInput').placeholder = t('searchPh');
}

const MEMBERS = [
  {id:'all',emoji:'✦'},{id:'vwp',emoji:'✦'},{id:'kafu',emoji:'🌸'},{id:'rime',emoji:'🌱'},
  {id:'harusar',emoji:'🔥'},{id:'isekai',emoji:'🌼'},{id:'koko',emoji:'⚡️'}
];
const MBR_CLS = {kafu:'mb-kafu',rime:'mb-rime',harusar:'mb-harusar',isekai:'mb-isekai',koko:'mb-koko',vwp:'mb-vwp'};

function openPage(page){
  document.getElementById('pageAbout').style.display=page==='about'?'block':'none';
  document.getElementById('pageContact').style.display=page==='contact'?'block':'none';
  document.getElementById('pageMover').style.display='block';
  document.body.style.overflow='hidden';
  return false;
}
function closePage(){
  document.getElementById('pageMover').style.display='none';
  document.body.style.overflow='';
}

let videos=[],curMember='all',selectedMembers=[],curTag='all',curSort='new',curView='grid',searchQ='',isAdmin=false,editId=null;
const PW_SK='vwp_admin_pw';
function getStoredPw(){try{return localStorage.getItem(PW_SK)||'';}catch{return '';}}
function storePw(pw){try{localStorage.setItem(PW_SK,pw);}catch{}}

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
function tagPills(v){return parseTags(v).map(tag=>`<span class="pill">#${tag}</span>`).join('');}
function mbPill(mid){return `<span class="pill ${MBR_CLS[mid]||''}">${mbr(mid)}</span>`;}
function spotifyBtn(v){if(!v.spotify_url)return '';return `<a class="spotify-btn" href="${v.spotify_url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">♫ ${t('spotify')}</a>`;}

function filtered(){
  let list=videos.slice();
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
  list.sort((a,b)=>curSort==='new'?(b.date>a.date?1:-1):(a.date>b.date?1:-1));
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
    reset.addEventListener('click',()=>{selectedMembers=[];curMember='all';curTag='all';buildSidebar();updateCounts();render();});
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
      curTag='all';buildSidebar();updateCounts();render();
    });
    mp.appendChild(btn);
  });
  const tf=document.getElementById('tagFilters');
  tf.innerHTML='';
  const src=selectedMembers.length===0?videos:videos.filter(v=>selectedMembers.every(m=>parseMembers(v).includes(m)));
  const tags=allTagsOf(src);
  const allB=document.createElement('button');
  allB.className='cfilt'+(curTag==='all'?' on':'');
  allB.innerHTML=`<span class="cfilt-label">${t('allTag')}</span><span class="ccnt" id="tc-all">0</span>`;
  allB.addEventListener('click',()=>{curTag='all';tf.querySelectorAll('.cfilt').forEach(b=>b.classList.remove('on'));allB.classList.add('on');updateCounts();render();});
  tf.appendChild(allB);
  tags.forEach(tag=>{
    const b=document.createElement('button');
    b.className='cfilt'+(curTag===tag?' on':'');
    b.innerHTML=`<span class="cfilt-label">#${tag}</span><span class="ccnt" id="tc-${tag}">0</span>`;
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
    reset.addEventListener('click',()=>{selectedMembers=[];curMember='all';curTag='all';buildSidebar();updateCounts();render();});
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
      curTag='all';buildSidebar();updateCounts();render();
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
    b.textContent='#'+tag;
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
        <div class="ctitle">${v.title}</div>
        <div class="cmeta"><span>${fmtDate(v.date)}</span>${spotifyBtn(v)}${v.note?`<span>${v.note}</span>`:''}${isAdmin?`<button class="dbtn" onclick="edit(${v.id},event)" style="color:var(--dim);">✎</button><button class="dbtn" onclick="del(${v.id},event)">✕</button>`:""}</div>
      </div>
    </div>`).join('')+`</div>`;
}
function renderList(list){
  if(!list.length)return `<div class="empty"><div class="empty-i">🌙</div><h3>${t('notFound')}</h3></div>`;
  return `<div class="vlist">`+list.map((v,i)=>`
    <a class="litem" style="animation-delay:${i*.022}s" href="${v.url}" target="_blank" rel="noopener">
      <div class="lthumb"><img src="${thumb(v)}" alt="" loading="lazy"></div>
      <div class="linfo"><div class="ltitle">${v.title}</div><div class="lmeta">${tagPills(v)}${showMb(v)}<span>${fmtDate(v.date)}</span>${spotifyBtn(v)}${v.note?`<span>${v.note}</span>`:''}</div></div>
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
      <div style="flex:1;min-width:0"><div class="tl-dt">${fmtDate(v.date)}</div><div class="tl-ti">${v.title}</div>
      <div style="margin-top:5px;display:flex;gap:4px;flex-wrap:wrap">${tagPills(v)}${showMb(v)}${spotifyBtn(v)}${v.note?`<span style="font-size:.62rem;color:var(--dim)">${v.note}</span>`:''}</div></div>
      ${isAdmin?`<button class="dbtn" onclick="edit(${v.id},event)" style="color:var(--dim);">✎</button><button class="dbtn" onclick="del(${v.id},event)">✕</button>`:""}
    </div>`;
  });
  return html+'</div>';
}
function render(){
  const list=filtered();
  document.getElementById('rcnt').textContent=list.length+' 件';
  const c=document.getElementById('vc');
  if(curView==='grid') c.innerHTML=renderGrid(list);
  else if(curView==='list') c.innerHTML=renderList(list);
  else c.innerHTML=renderTimeline(list);
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
document.getElementById('sNew').addEventListener('click',()=>{curSort='new';document.getElementById('sNew').classList.add('on');document.getElementById('sOld').classList.remove('on');render();});
document.getElementById('sOld').addEventListener('click',()=>{curSort='old';document.getElementById('sOld').classList.add('on');document.getElementById('sNew').classList.remove('on');render();});

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
  const rawInput=document.getElementById('tagInput').value.trim();
  if(rawInput)addInputTag(rawInput);
  const tags=inputTags.join(' ');
  if(!url||!title){alert('URLとタイトルは必須です');return;}
  const saveBtn=document.getElementById('mSave');
  saveBtn.textContent=editId?'更新中…':t('adding');saveBtn.disabled=true;
  try{
    if(editId){
      const updated=await updateVideoApi(editId,{member,title,tags,date,url,note,spotify_url:spotify});
      const idx=videos.findIndex(v=>v.id===editId);
      if(idx!==-1) videos[idx]={...videos[idx],...updated};
      editId=null;
    } else {
      const nv=await addVideoApi({member,title,tags,date,url,note,spotify_url:spotify});
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

function setAdminMode(on){
  isAdmin=on;
  document.getElementById('fab').style.display=on?'flex':'none';
  document.getElementById('importBtn').style.display=on?'flex':'none';
  document.getElementById('loginBtn').style.display=on?'none':'flex';
  render();
}

document.getElementById('loginBtn').addEventListener('click',()=>{
  document.getElementById('pwInput').value='';document.getElementById('pwStatus').textContent='';
  document.getElementById('loginMover').classList.add('open');
  setTimeout(()=>document.getElementById('pwInput').focus(),100);
});
document.getElementById('loginCancel').addEventListener('click',()=>document.getElementById('loginMover').classList.remove('open'));
document.getElementById('loginMover').addEventListener('click',e=>{if(e.target===document.getElementById('loginMover'))document.getElementById('loginMover').classList.remove('open');});

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
      body: JSON.stringify({ playlistId, member, tags, password: pw })
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