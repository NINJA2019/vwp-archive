// supabase.js — Supabase/API fetch関数（app.js L93-141 相当）
// 注: albums/videos の可変状態はcore.jsに持つ。
// これらの関数はデータを返し、呼び出し元（core.js）がstateに格納する。

export async function loadAlbumsApi(){
  const res = await fetch('/api/albums-get');
  if(!res.ok) throw new Error('HTTP '+res.status);
  return res.json(); // 配列かどうかの判定はcore.js側で行う（旧app.jsと同じ分岐構造）
}

export async function loadVideosApi(){
  const res = await fetch('/api/videos-get');
  if(!res.ok) throw new Error('HTTP '+res.status);
  return res.json(); // 配列かどうかの判定はcore.js側で行う（旧app.jsと同じ分岐構造）
}

export async function addAlbumApi(payload, getStoredPw){
  const res=await fetch('/api/albums-add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:getStoredPw(),...payload})});
  const d=await res.json(); if(!res.ok) throw new Error(d.error||'failed'); return d;
}
export async function updateAlbumApi(id, fields, getStoredPw){
  const res=await fetch('/api/albums-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:getStoredPw(),id,...fields})});
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
export async function deleteAlbumApi(id, getStoredPw){
  const res=await fetch('/api/albums-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:getStoredPw(),id})});
  const d=await res.json(); if(!res.ok) throw new Error(d.error||'failed');
}
export async function addVideoApi(payload, getStoredPw){
  const res=await fetch('/api/videos-add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:getStoredPw(),...payload})});
  const d=await res.json(); if(!res.ok) throw new Error(d.error||'failed'); return d;
}
export async function deleteVideoApi(id, getStoredPw){
  const res=await fetch('/api/videos-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:getStoredPw(),id})});
  const d=await res.json(); if(!res.ok) throw new Error(d.error||'failed');
}
export async function updateVideoApi(id, payload, getStoredPw){
  const res=await fetch("/api/videos-update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:getStoredPw(),id,...payload})});
  const d=await res.json(); if(!res.ok) throw new Error(d.error||"failed"); return d;
}
export async function verifyPwApi(pw){
  const res=await fetch("/api/auth-check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:pw})});
  return res.ok;
}
