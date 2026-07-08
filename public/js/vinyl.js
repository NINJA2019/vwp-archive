// vinyl.js — メンバーカラー定義 + Canvas LPディスク描画（app.js L2035-2133 相当）

export const MEMBER_COLORS = {
  kafu:'#ffb7c5', rime:'#7eb8f7', harusar:'#ff7070',
  isekai:'#d8d8d8', koko:'#c084fc', vwp:'#c4b5fd'
};

export function getMemberColor(memberStr){
  if(!memberStr) return '#b0b8ff';
  for(const [id, color] of Object.entries(MEMBER_COLORS)){
    if(memberStr.includes(id)) return color;
  }
  return '#b0b8ff';
}

export function drawVinylDisc(canvas, memberColor, size){
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);

  // Base: member color
  const VINYL_BASE_ALPHA = 0.55;
  ctx.beginPath();
  ctx.arc(c, c, c - 1, 0, Math.PI * 2);
  ctx.fillStyle = memberColor;
  ctx.globalAlpha = VINYL_BASE_ALPHA;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Dark overlay for depth
  ctx.beginPath();
  ctx.arc(c, c, c - 1, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();

  // Grooves
  for(var r = c * 0.35; r < c * 0.9; r += 3.5){
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  // Gloss
  var grad = ctx.createRadialGradient(c * 0.7, c * 0.7, 0, c, c, c);
  grad.addColorStop(0, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(c, c, c - 1, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Label center
  ctx.beginPath();
  ctx.arc(c, c, c * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = '#121420';
  ctx.fill();

  // Label ring (member color)
  ctx.beginPath();
  ctx.arc(c, c, c * 0.22, 0, Math.PI * 2);
  ctx.strokeStyle = memberColor;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Label inner
  ctx.beginPath();
  ctx.arc(c, c, c * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = '#0d0f1c';
  ctx.fill();

  // Spindle
  ctx.beginPath();
  ctx.arc(c, c, c * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = '#252848';
  ctx.fill();

  // Spindle center (member color)
  ctx.beginPath();
  ctx.arc(c, c, c * 0.03, 0, Math.PI * 2);
  ctx.fillStyle = memberColor;
  ctx.globalAlpha = 0.6;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Outer ring
  ctx.beginPath();
  ctx.arc(c, c, c - 1, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
}
