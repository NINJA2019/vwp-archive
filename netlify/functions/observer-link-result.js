exports.handler = async (event) => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const sbHeaders = { apikey: key, Authorization: `Bearer ${key}` };
  const siteUrl = 'https://vwp-archive.netlify.app';

  const id = event.queryStringParameters?.id;

  // UUID format check
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || !uuidRegex.test(id)) {
    return expiredPage(siteUrl);
  }

  try {
    // Get the bottle
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

    const memberDisplay = getMemberDisplay(receivedVideo?.member || sentVideo?.member || '');
    const receivedTitle = receivedVideo?.title || sentVideo?.title || 'Observer-Link';
    const ogTitle = `#ObserverLink で ${memberDisplay} - ${receivedTitle} を受け取りました！`;
    const ogDesc = bottle.message || 'Send one record, receive one from another observer';
    const ogUrl = `${siteUrl}/result/?id=${id}`;
    const ogImage = `${siteUrl}/ogp-observer-link.png`;

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
<script>window.location.replace('${siteUrl}/?ol_result=${id}');</script>
</head>
<body>
<p>Redirecting to <a href="${siteUrl}/?ol_result=${id}">V.W.P ARCHIVE — Observer-Link</a>...</p>
</body>
</html>`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
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
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#07090e;color:#e8ecf8;font-family:'Noto Sans JP',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center}
.wrap{max-width:400px}
h1{font-family:'Cinzel',serif;font-size:1.2rem;letter-spacing:.2em;margin-bottom:1rem;color:#c4b5fd}
p{font-size:.9rem;color:rgba(232,236,248,.5);line-height:1.8;margin-bottom:1.5rem}
a{display:inline-block;padding:.6rem 1.5rem;border:1px solid rgba(196,181,253,.3);border-radius:20px;color:#c4b5fd;text-decoration:none;font-size:.85rem;letter-spacing:.1em;transition:all .3s}
a:hover{background:rgba(196,181,253,.1)}
</style>
</head>
<body>
<div class="wrap">
<h1>Observer-Link</h1>
<p>This exchange has expired or does not exist.</p>
<a href="${siteUrl}">Back to V.W.P ARCHIVE</a>
</div>
</body>
</html>`;
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  };
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getMemberDisplay(member) {
  const map = {
    kafu: 'KAF', rime: 'RIM', harusar: 'HARU',
    isekai: 'JOUCHO', koko: 'KOKO', vwp: 'V.W.P',
  };
  return map[member] || member || 'Observer';
}
