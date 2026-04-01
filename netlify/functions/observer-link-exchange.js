const crypto = require('crypto');

const DAILY_LIMIT = 10;
const VALID_MOODS = ['Morning', 'Night', 'Rain', 'Walk', 'Work', 'Chill'];

function headers(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

function getClientHash(event) {
  const ip = (event.headers['x-forwarded-for'] || '127.0.0.1').split(',')[0].trim();
  const ua = event.headers['user-agent'] || '';
  return crypto.createHash('sha256').update(ip + ua).digest('hex');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST' } };
  }
  if (event.httpMethod !== 'POST') {
    return headers(405, { success: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const sbHeaders = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };

  try {
    const body = JSON.parse(event.body || '{}');
    const { video_id, mood_tags, message } = body;

    if (!video_id) return headers(400, { success: false, error: 'INVALID_VIDEO_ID' });

    // Validate mood_tags
    const validMoods = Array.isArray(mood_tags)
      ? mood_tags.filter(m => VALID_MOODS.includes(m)).slice(0, 2)
      : [];

    // Validate message
    const validMessage = typeof message === 'string' ? message.slice(0, 20) || null : null;

    const clientHash = getClientHash(event);

    // Rate limit check
    const rateRes = await fetch(
      `${url}/rest/v1/rpc/`,
      { method: 'POST', headers: sbHeaders, body: JSON.stringify({}) }
    );
    // Use direct query for rate limit
    const rateCheckRes = await fetch(
      `${url}/rest/v1/song_bottles?select=id&client_hash=eq.${clientHash}&created_at=gte.${new Date(Date.now() - 86400000).toISOString()}`,
      { headers: sbHeaders }
    );
    const rateData = await rateCheckRes.json();
    const dailyUsed = Array.isArray(rateData) ? rateData.length : 0;

    if (dailyUsed >= DAILY_LIMIT) {
      return headers(429, { success: false, error: 'RATE_LIMIT_EXCEEDED', daily_used: dailyUsed, daily_limit: DAILY_LIMIT });
    }

    // Validate video_id exists
    const videoRes = await fetch(
      `${url}/rest/v1/videos?select=id,title,member,date,url&id=eq.${video_id}`,
      { headers: sbHeaders }
    );
    const videoData = await videoRes.json();
    if (!Array.isArray(videoData) || videoData.length === 0) {
      return headers(400, { success: false, error: 'INVALID_VIDEO_ID' });
    }
    const sentVideo = videoData[0];

    // Insert bottle
    const insertRes = await fetch(
      `${url}/rest/v1/song_bottles`,
      {
        method: 'POST',
        headers: sbHeaders,
        body: JSON.stringify({
          video_id: Number(video_id),
          mood_tags: validMoods,
          message: validMessage,
          client_hash: clientHash,
        }),
      }
    );
    const insertData = await insertRes.json();
    if (!Array.isArray(insertData) || insertData.length === 0) {
      return headers(500, { success: false, error: 'INTERNAL_ERROR' });
    }
    const myBottle = insertData[0];

    // Try to match
    const matchRes = await fetch(
      `${url}/rest/v1/song_bottles?select=*&status=eq.waiting&client_hash=neq.${clientHash}&id=neq.${myBottle.id}&limit=1`,
      { headers: { ...sbHeaders, 'Range': '0-0' } }
    );
    // PostgREST doesn't support ORDER BY random(), so we fetch candidates and pick one
    const matchCandidatesRes = await fetch(
      `${url}/rest/v1/song_bottles?select=*&status=eq.waiting&client_hash=neq.${clientHash}&id=neq.${myBottle.id}&limit=50`,
      { headers: sbHeaders }
    );
    const candidates = await matchCandidatesRes.json();

    if (Array.isArray(candidates) && candidates.length > 0) {
      // Random pick
      const matched = candidates[Math.floor(Math.random() * candidates.length)];

      // Update both to matched
      await Promise.all([
        fetch(`${url}/rest/v1/song_bottles?id=eq.${myBottle.id}`, {
          method: 'PATCH',
          headers: sbHeaders,
          body: JSON.stringify({ status: 'matched', matched_with: matched.id }),
        }),
        fetch(`${url}/rest/v1/song_bottles?id=eq.${matched.id}`, {
          method: 'PATCH',
          headers: sbHeaders,
          body: JSON.stringify({ status: 'matched', matched_with: myBottle.id }),
        }),
      ]);

      // Get matched video info
      const matchedVideoRes = await fetch(
        `${url}/rest/v1/videos?select=id,title,member,date,url&id=eq.${matched.video_id}`,
        { headers: sbHeaders }
      );
      const matchedVideoData = await matchedVideoRes.json();
      const receivedVideo = (Array.isArray(matchedVideoData) && matchedVideoData.length > 0) ? matchedVideoData[0] : null;

      const timeAgoSeconds = Math.floor((Date.now() - new Date(matched.created_at).getTime()) / 1000);

      return headers(200, {
        success: true,
        is_fallback: false,
        exchange_id: myBottle.id,
        sent: {
          video_id: sentVideo.id,
          title: sentVideo.title,
          member: sentVideo.member,
          date: sentVideo.date,
          url: sentVideo.url,
          mood_tags: validMoods,
          message: validMessage,
        },
        received: {
          video_id: receivedVideo ? receivedVideo.id : matched.video_id,
          title: receivedVideo ? receivedVideo.title : '',
          member: receivedVideo ? receivedVideo.member : '',
          date: receivedVideo ? receivedVideo.date : '',
          url: receivedVideo ? receivedVideo.url : '',
          mood_tags: matched.mood_tags || [],
          message: matched.message || null,
          time_ago_seconds: timeAgoSeconds,
        },
        daily_used: dailyUsed + 1,
        daily_limit: DAILY_LIMIT,
      });
    }

    // Fallback: no match available — recommend a random song
    const fallbackRes = await fetch(
      `${url}/rest/v1/videos?select=id,title,member,date,url&limit=50`,
      { headers: sbHeaders }
    );
    const fallbackData = await fallbackRes.json();
    const pool = Array.isArray(fallbackData) ? fallbackData.filter(v => v.id !== Number(video_id)) : [];
    const recommended = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;

    return headers(200, {
      success: true,
      is_fallback: true,
      exchange_id: myBottle.id,
      sent: {
        video_id: sentVideo.id,
        title: sentVideo.title,
        member: sentVideo.member,
        date: sentVideo.date,
        url: sentVideo.url,
        mood_tags: validMoods,
        message: validMessage,
      },
      received: recommended ? {
        video_id: recommended.id,
        title: recommended.title,
        member: recommended.member,
        date: recommended.date,
        url: recommended.url,
        mood_tags: [],
        message: null,
        time_ago_seconds: null,
      } : null,
      daily_used: dailyUsed + 1,
      daily_limit: DAILY_LIMIT,
    });
  } catch (e) {
    console.error('observer-link-exchange error:', e);
    return headers(500, { success: false, error: 'INTERNAL_ERROR' });
  }
};
