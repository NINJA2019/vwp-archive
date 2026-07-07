const crypto = require('crypto');

const DAILY_LIMIT = 10;
const VALID_MOODS = ['Morning', 'Night', 'Rain', 'Walk', 'Work', 'Chill'];
const ALLOWED_ORIGIN = 'https://vwp-archive.netlify.app';

function resp(status, body) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    },
    body: JSON.stringify(body),
  };
}

function getClientHash(event) {
  // Use Netlify's reliable client IP header, fall back to x-forwarded-for
  const ip = (event.headers['x-nf-client-connection-ip']
    || (event.headers['x-forwarded-for'] || '127.0.0.1').split(',')[0]).trim();
  return crypto.createHash('sha256').update(ip).digest('hex');
}

async function sbFetch(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
        'Access-Control-Allow-Methods': 'POST',
      },
    };
  }
  if (event.httpMethod !== 'POST') {
    return resp(405, { success: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const sbHeaders = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  try {
    const body = JSON.parse(event.body || '{}');
    const { video_id, mood_tags, message } = body;

    // Validate video_id is a finite integer (prevent PostgREST injection)
    const numericVideoId = parseInt(video_id, 10);
    if (!Number.isFinite(numericVideoId) || numericVideoId <= 0) {
      return resp(400, { success: false, error: 'INVALID_VIDEO_ID' });
    }

    const validMoods = Array.isArray(mood_tags)
      ? mood_tags.filter(m => VALID_MOODS.includes(m)).slice(0, 2)
      : [];
    const validMessage = typeof message === 'string' ? message.slice(0, 20) || null : null;
    const clientHash = getClientHash(event);

    // ── admin bypass ──
    const adminKey = event.headers['x-admin-key'] || '';
    const isAdmin = adminKey.length > 0 && adminKey === (process.env.ADMIN_PASSWORD || '');

    // Rate limit check (skip for admin)
    let dailyUsed = 0;
    if (!isAdmin) {
      const rateData = await sbFetch(
        `${url}/rest/v1/song_bottles?select=id&client_hash=eq.${clientHash}&created_at=gte.${new Date(Date.now() - 86400000).toISOString()}`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      );
      dailyUsed = Array.isArray(rateData) ? rateData.length : 0;
      if (dailyUsed >= DAILY_LIMIT) {
        return resp(429, { success: false, error: 'RATE_LIMIT_EXCEEDED', daily_used: dailyUsed, daily_limit: DAILY_LIMIT });
      }
    }

    // Validate video_id exists in videos table
    const videoData = await sbFetch(
      `${url}/rest/v1/videos?select=id,title,member,date,url&id=eq.${numericVideoId}&status=eq.published`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!Array.isArray(videoData) || videoData.length === 0) {
      return resp(400, { success: false, error: 'INVALID_VIDEO_ID' });
    }
    const sentVideo = videoData[0];

    // Insert bottle
    const insertData = await sbFetch(
      `${url}/rest/v1/song_bottles`,
      {
        method: 'POST',
        headers: sbHeaders,
        body: JSON.stringify({
          video_id: numericVideoId,
          mood_tags: validMoods,
          message: validMessage,
          client_hash: clientHash,
        }),
      }
    );
    if (!Array.isArray(insertData) || insertData.length === 0) {
      return resp(500, { success: false, error: 'INTERNAL_ERROR' });
    }
    const myBottle = insertData[0];

    // Try to match — fetch candidates and pick one randomly
    const candidates = await sbFetch(
      `${url}/rest/v1/song_bottles?select=*&status=eq.waiting&client_hash=neq.${clientHash}&id=neq.${myBottle.id}&limit=50`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );

    if (Array.isArray(candidates) && candidates.length > 0) {
      const matched = candidates[Math.floor(Math.random() * candidates.length)];

      // Atomic-ish match: only PATCH if still waiting (prevents race condition)
      const patchRes = await fetch(
        `${url}/rest/v1/song_bottles?id=eq.${matched.id}&status=eq.waiting`,
        {
          method: 'PATCH',
          headers: sbHeaders,
          body: JSON.stringify({ status: 'matched', matched_with: myBottle.id }),
        }
      );
      if (!patchRes.ok) throw new Error(`Match PATCH failed: ${patchRes.status}`);
      const patchData = await patchRes.json();

      // If 0 rows updated, someone else claimed this bottle — fall through to fallback
      if (!Array.isArray(patchData) || patchData.length === 0) {
        // Bottle was already claimed by another request
      } else {
        // Successfully claimed — update our bottle too
        await sbFetch(
          `${url}/rest/v1/song_bottles?id=eq.${myBottle.id}`,
          {
            method: 'PATCH',
            headers: sbHeaders,
            body: JSON.stringify({ status: 'matched', matched_with: matched.id }),
          }
        );

        // Get matched video info
        const matchedVideoData = await sbFetch(
          `${url}/rest/v1/videos?select=id,title,member,date,url&id=eq.${matched.video_id}&status=eq.published`,
          { headers: { apikey: key, Authorization: `Bearer ${key}` } }
        );
        const receivedVideo = (Array.isArray(matchedVideoData) && matchedVideoData.length > 0) ? matchedVideoData[0] : null;
        const timeAgoSeconds = Math.floor((Date.now() - new Date(matched.created_at).getTime()) / 1000);

        return resp(200, {
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
          daily_used: isAdmin ? 0 : dailyUsed + 1,
          daily_limit: isAdmin ? 999 : DAILY_LIMIT,
          is_admin: isAdmin || undefined,
        });
      }
    }

    // Fallback: no match available — recommend a random song
    const fallbackData = await sbFetch(
      `${url}/rest/v1/videos?select=id,title,member,date,url&status=eq.published&limit=50`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    const pool = Array.isArray(fallbackData) ? fallbackData.filter(v => v.id !== numericVideoId) : [];
    const recommended = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;

    // Save fallback recommendation to DB
    if (recommended) {
      await fetch(
        `${url}/rest/v1/song_bottles?id=eq.${myBottle.id}`,
        {
          method: 'PATCH',
          headers: sbHeaders,
          body: JSON.stringify({ status: 'fallback_matched', fallback_video_id: recommended.id }),
        }
      );
    }

    return resp(200, {
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
      daily_used: isAdmin ? 0 : dailyUsed + 1,
      daily_limit: isAdmin ? 999 : DAILY_LIMIT,
      is_admin: isAdmin || undefined,
    });
  } catch (e) {
    console.error('observer-link-exchange error:', e);
    return resp(500, { success: false, error: 'INTERNAL_ERROR' });
  }
};
