exports.handler = async (event) => {
  const siteUrl = 'https://vwp-archive.netlify.app';

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: { 'Content-Type': 'text/plain' }, body: 'Method Not Allowed' };
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const sbHeaders = { apikey: key, Authorization: `Bearer ${key}` };

  const id = event.queryStringParameters?.id;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || !uuidRegex.test(id)) {
    return expiredPage(siteUrl);
  }

  try {
    // Get the bottle (the one who shared this link)
    const bottleRes = await fetch(
      `${url}/rest/v1/song_bottles?select=*&id=eq.${id}`,
      { headers: sbHeaders }
    );
    const bottles = await bottleRes.json();
    if (!Array.isArray(bottles) || bottles.length === 0) {
      return expiredPage(siteUrl);
    }

    const bottle = bottles[0];

    // Get sent video info
    const sentVideoRes = await fetch(
      `${url}/rest/v1/videos?select=id,title,member,date,url&id=eq.${bottle.video_id}`,
      { headers: sbHeaders }
    );
    const sentVideos = await sentVideoRes.json();
    const sentVideo = Array.isArray(sentVideos) && sentVideos.length > 0 ? sentVideos[0] : null;

    // Get received video info (from matched_with)
    let receivedVideo = null;
    let receivedBottle = null;
    if (bottle.matched_with) {
      const matchedRes = await fetch(
        `${url}/rest/v1/song_bottles?select=*&id=eq.${bottle.matched_with}`,
        { headers: sbHeaders }
      );
      const matchedBottles = await matchedRes.json();
      if (Array.isArray(matchedBottles) && matchedBottles.length > 0) {
        receivedBottle = matchedBottles[0];
        const recVideoRes = await fetch(
          `${url}/rest/v1/videos?select=id,title,member,date,url&id=eq.${receivedBottle.video_id}`,
          { headers: sbHeaders }
        );
        const recVideos = await recVideoRes.json();
        receivedVideo = Array.isArray(recVideos) && recVideos.length > 0 ? recVideos[0] : null;
      }
    }

    // Unmatched bottles should not render a success page
    if (bottle.status !== 'matched' || !receivedBottle) {
      return expiredPage(siteUrl);
    }

    const receivedTitle = receivedVideo?.title || sentVideo?.title || 'Observer-Link';
    const ogTitle = `#ObserverLink で「${receivedTitle}」を受け取りました！`;
    const ogDesc = bottle.message || 'Send one record, receive one from another observer';
    const ogUrl = `${siteUrl}/result/?id=${id}`;
    const ogImage = `${siteUrl}/ogp-observer-link.png`;

    // Build cards
    const sentYtId = sentVideo ? extractYtId(sentVideo.url) : '';
    const sentThumb = sentYtId ? `https://img.youtube.com/vi/${sentYtId}/mqdefault.jpg` : '';
    const sentMemberName = getMemberDisplay(sentVideo?.member || '');
    const sentColor = getMemberColor(sentVideo?.member || '');

    const recYtId = receivedVideo ? extractYtId(receivedVideo.url) : '';
    const recThumb = recYtId ? `https://img.youtube.com/vi/${recYtId}/mqdefault.jpg` : '';
    const recMemberName = getMemberDisplay(receivedVideo?.member || '');
    const recColor = getMemberColor(receivedVideo?.member || '');

    // Compute time_ago from the matched bottle's created_at (when the other observer sent it)
    const timeAgoText = receivedBottle.created_at
      ? timeAgoFromDate(receivedBottle.created_at)
      : 'some time';

    // Build received card HTML
    let receivedCardHtml = '';
    if (receivedVideo) {
      receivedCardHtml = `
    <div class="card">
      <div class="card-label received">RECEIVED RECORD</div>
      <div class="card-content">
        ${recThumb ? `<img class="card-thumb" src="${escHtml(recThumb)}" alt="">` : ''}
        <div>
          <div class="card-member" style="color:${recColor}">${escHtml(recMemberName)}</div>
          <div class="card-title">${escHtml(receivedVideo.title || '')}</div>
        </div>
      </div>
      ${receivedBottle?.message ? `<div class="card-msg">${escHtml(receivedBottle.message)}</div>` : ''}
      ${recYtId ? `<a class="yt-btn" href="https://www.youtube.com/watch?v=${escHtml(recYtId)}" target="_blank" rel="noopener">&#9654; YouTubeで聴く</a>` : ''}
    </div>`;
    }

    // Build sent card HTML
    let sentCardHtml = '';
    if (sentVideo) {
      sentCardHtml = `
    <div class="card">
      <div class="card-label yours">YOUR RECORD</div>
      <div class="card-content">
        ${sentThumb ? `<img class="card-thumb" src="${escHtml(sentThumb)}" alt="">` : ''}
        <div>
          <div class="card-member" style="color:${sentColor}">${escHtml(sentMemberName)}</div>
          <div class="card-title">${escHtml(sentVideo.title || '')}</div>
        </div>
      </div>
      ${bottle.message ? `<div class="card-msg">${escHtml(bottle.message)}</div>` : ''}
    </div>`;
    }

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(ogTitle)}</title>
<meta property="og:title" content="${escHtml(ogTitle)}">
<meta property="og:description" content="${escHtml(ogDesc)}">
<meta property="og:url" content="${escHtml(ogUrl)}">
<meta property="og:image" content="${escHtml(ogImage)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escHtml(ogTitle)}">
<meta name="twitter:description" content="${escHtml(ogDesc)}">
<meta name="twitter:image" content="${escHtml(ogImage)}">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Shippori+Mincho:wght@400;600&family=Barlow+Condensed:wght@300;400;600;700&family=Noto+Sans+JP:wght@300;400;500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#07090e;color:#e8ecf8;font-family:'Noto Sans JP','Barlow Condensed',sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center}
.container{max-width:430px;width:100%;padding:20px}
.header{text-align:center;padding:20px 0}
.logo{font-family:'Cinzel',serif;font-size:10px;letter-spacing:2.5px;color:rgba(232,236,248,.45);text-transform:uppercase}
.logo span{font-size:7px;letter-spacing:1.5px;display:block;margin-top:2px;color:rgba(232,236,248,.22)}
.check-wrap{text-align:center;margin:24px 0 8px}
.check-ring{display:inline-flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:50%;background:rgba(34,197,94,.12);animation:ring-in .5s cubic-bezier(.34,1.56,.64,1) both}
.check-circle{width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#10b981);display:flex;align-items:center;justify-content:center;animation:circle-in .4s .15s cubic-bezier(.34,1.56,.64,1) both;box-shadow:0 4px 20px rgba(16,185,129,.35)}
.check-svg{width:24px;height:24px}
.check-svg polyline{stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none;stroke-dasharray:30;stroke-dashoffset:30;animation:check-draw .35s .45s ease forwards}
@keyframes ring-in{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes circle-in{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes check-draw{to{stroke-dashoffset:0}}
.intro{text-align:center;margin:20px 0}
.intro-title{font-family:'Shippori Mincho',serif;font-size:18px;font-weight:600;background:linear-gradient(135deg,#e8ecf8,#6c5ce7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;color:transparent}
.intro-sub{font-size:12px;color:rgba(232,236,248,.45);margin-top:6px}
.card{background:#0c0f18;border:1px solid rgba(255,255,255,.10);border-radius:16px;overflow:hidden;margin-bottom:14px}
.card-label{font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;padding:12px 16px 0}
.card-label.yours{color:#c4b5fd}
.card-label.received{color:#5dc9a8}
.card-content{display:flex;align-items:center;gap:14px;padding:10px 16px 14px}
.card-thumb{width:64px;height:64px;border-radius:10px;object-fit:cover;flex-shrink:0}
.card-member{font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase}
.card-title{font-family:'Shippori Mincho',serif;font-size:15px;margin-top:2px}
.card-msg{padding:0 16px 14px;font-size:12px;color:rgba(232,236,248,.45);font-style:italic}
.card-msg::before{content:'\\300C'}
.card-msg::after{content:'\\300D'}
.yt-btn{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 16px 14px;padding:10px;border:1px solid rgba(255,255,255,.10);border-radius:10px;color:rgba(232,236,248,.45);font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none}
.yt-btn:hover{border-color:rgba(255,255,255,.2);color:#e8ecf8}
.cta{display:block;text-align:center;padding:16px;background:linear-gradient(135deg,#4a3a8a,#6c5ce7);color:#fff;border-radius:16px;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:600;letter-spacing:2px;text-transform:uppercase;text-decoration:none;margin-top:20px}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">V.W.P ARCHIVE<span>UNOFFICIAL &mdash; OBSERVER-LINK</span></div>
  </div>
  <div class="check-wrap">
    <div class="check-ring">
      <div class="check-circle">
        <svg class="check-svg" viewBox="0 0 24 24"><polyline points="4 12 10 18 20 6"/></svg>
      </div>
    </div>
  </div>
  <div class="intro">
    <div class="intro-title">Link established</div>
    <div class="intro-sub">From an observer ${escHtml(timeAgoText)} ago</div>
  </div>
  ${sentCardHtml}
  ${receivedCardHtml}
  <a class="cta" href="${siteUrl}">Try Observer-Link</a>
</div>
</body>
</html>`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      body: html,
    };
  } catch (e) {
    console.error('observer-link-result error:', e);
    return expiredPage(siteUrl);
  }
};

function expiredPage(siteUrl) {
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Observer-Link — V.W.P ARCHIVE</title>
<meta property="og:title" content="Observer-Link — V.W.P ARCHIVE">
<meta property="og:description" content="Send one record, receive one from another observer">
<meta property="og:image" content="${siteUrl}/ogp-observer-link.png">
<meta name="twitter:card" content="summary">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Shippori+Mincho:wght@400;600&family=Barlow+Condensed:wght@300;400;600;700&family=Noto+Sans+JP:wght@300;400;500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#07090e;color:#e8ecf8;font-family:'Noto Sans JP',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center}
.wrap{max-width:400px}
.logo{font-family:'Cinzel',serif;font-size:10px;letter-spacing:2.5px;color:rgba(232,236,248,.45);text-transform:uppercase;margin-bottom:24px}
.logo span{font-size:7px;letter-spacing:1.5px;display:block;margin-top:2px;color:rgba(232,236,248,.22)}
h1{font-family:'Shippori Mincho',serif;font-size:1.2rem;margin-bottom:1rem;background:linear-gradient(135deg,#e8ecf8,#6c5ce7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;color:transparent}
p{font-size:.9rem;color:rgba(232,236,248,.5);line-height:1.8;margin-bottom:1.5rem}
a{display:inline-block;padding:.6rem 1.5rem;border:1px solid rgba(196,181,253,.3);border-radius:20px;color:#c4b5fd;text-decoration:none;font-size:.85rem;letter-spacing:.1em;transition:all .3s}
a:hover{background:rgba(196,181,253,.1)}
</style>
</head>
<body>
<div class="wrap">
<div class="logo">V.W.P ARCHIVE<span>UNOFFICIAL &mdash; OBSERVER-LINK</span></div>
<h1>This exchange has expired</h1>
<p>Observer-Link exchanges are kept for 7 days</p>
<a href="${siteUrl}">Try Observer-Link</a>
</div>
</body>
</html>`;
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  };
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getMemberDisplay(member) {
  const map = {
    kafu: 'KAF', rime: 'RIM', harusar: 'HARU',
    isekai: 'JOUCHO', koko: 'KOKO', vwp: 'V.W.P',
  };
  return map[member] || member || 'Observer';
}

function getMemberColor(member) {
  const map = {
    kafu: '#ffb7c5', rime: '#7eb8f7', harusar: '#ff7070',
    isekai: '#d8d8d8', koko: '#c084fc', vwp: '#c4b5fd',
  };
  return map[member] || '#c4b5fd';
}

function extractYtId(url) {
  if (!url) return '';
  const m = url.match(/(?:youtu\.be\/|v=)([^&?#]+)/);
  return m ? m[1] : '';
}

function timeAgo(seconds) {
  if (!seconds || seconds < 0) return 'some time';
  if (seconds < 60) return seconds + ' seconds';
  if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes';
  if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours';
  return Math.floor(seconds / 86400) + ' days';
}

function timeAgoFromDate(dateStr) {
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    return timeAgo(diff);
  } catch (e) {
    return 'some time';
  }
}
