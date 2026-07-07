// ═══════════════════════════════════════════════════════════════
// ingest-youtube.js — YouTube自動取り込みFunction
// スケジュール: 6時間ごと (netlify.toml で設定)
// 手動起動: Authorization: Bearer <ADMIN_PASSWORD> が必要
// 自動publish禁止 — 取り込みは常に status='pending' 止まり
// ═══════════════════════════════════════════════════════════════

// ── キーワード定数辞書 ──
const SHORTS_KEYWORDS = ['#shorts'];
const LIVE_KEYWORDS = [
  'ワンマン', 'ライブ映像', 'LIVE', '不可解', '現象', '狂想'
];
const ANNOUNCEMENT_KEYWORDS = [
  '告知', 'トレーラー', 'Teaser', 'XFD', 'クロスフェード', '予告',
  '開催決定', '発売決定', '情報解禁'
];
const COVER_KEYWORDS = ['Covered', '歌ってみた'];

// メンバー名表記（タイトル中の他メンバー検出用）
const MEMBER_TITLE_PATTERNS = {
  kafu:    ['花譜', 'KAF', 'かふ'],
  rime:    ['理芽', 'RIM', 'りめ'],
  harusar: ['春猿火', 'HARUSARU', 'HARU'],
  isekai:  ['ヰ世界情緒', 'JOUCHO', 'ヰよ'],
  koko:    ['幸祜', 'KOKO', 'こうこ']
};

// ── ユーティリティ ──

/**
 * ISO 8601 duration (PT1M30S, PT45S 等) を秒数に変換
 */
function parseDuration(iso) {
  if (!iso) return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

/**
 * タイトル + description からcontent_typeを判定
 * 優先順: shorts → live → announcement → song
 */
function classifyContentType(title, description, durationSec, hasLiveDetails) {
  const text = (title + ' ' + (description || '')).toLowerCase();
  const titleLower = title.toLowerCase();

  // shorts: 60秒以下 OR タイトル/descriptionに #shorts
  if (
    (durationSec !== null && durationSec <= 60) ||
    SHORTS_KEYWORDS.some(k => text.includes(k.toLowerCase()))
  ) {
    return 'shorts';
  }

  // live: liveStreamingDetailsあり OR タイトルにライブ系キーワード
  if (
    hasLiveDetails ||
    LIVE_KEYWORDS.some(k => titleLower.includes(k.toLowerCase()))
  ) {
    return 'live';
  }

  // announcement: タイトルに告知系キーワード
  if (ANNOUNCEMENT_KEYWORDS.some(k => titleLower.includes(k.toLowerCase()))) {
    return 'announcement';
  }

  return 'song';
}

/**
 * タイトルに他メンバー名が含まれていれば追加
 * 既存 "kafu rime" 形式で返す
 */
function resolveMember(primaryMemberId, title) {
  const members = [primaryMemberId];
  const titleStr = title || '';
  for (const [memberId, patterns] of Object.entries(MEMBER_TITLE_PATTERNS)) {
    if (memberId === primaryMemberId) continue;
    if (patterns.some(p => titleStr.includes(p))) {
      members.push(memberId);
    }
  }
  // 重複除去 + ソート（一貫性のため）
  return [...new Set(members)].sort().join(' ');
}

/**
 * タイトルにカバー系キーワードが含まれていれば 'Covered' タグを返す
 */
function detectCoverTag(title) {
  const t = title || '';
  return COVER_KEYWORDS.some(k => t.includes(k)) ? 'Covered' : null;
}

/**
 * Supabase fetch ラッパー（エラーはそのままthrow）
 */
async function sbFetch(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// ── メインハンドラ ──
exports.handler = async (event) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
  const YT_KEY = process.env.YOUTUBE_API_KEY;
  const ADMIN_PW = process.env.ADMIN_PASSWORD;

  if (!SUPABASE_URL || !SUPABASE_KEY || !YT_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: '環境変数が不足しています' }) };
  }

  // ── 手動起動ガード ──
  // Netlifyスケジュール実行: event.httpMethod が undefined または 'POST' で
  // event.body に {"next_run":...} が含まれる。
  // それ以外（HTTP直叩き）の場合は ADMIN_PASSWORD トークンを要求する。
  const isScheduled = (
    !event.httpMethod ||
    (event.httpMethod === 'POST' && event.body && event.body.includes('next_run'))
  );

  if (!isScheduled) {
    const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!ADMIN_PW || token !== ADMIN_PW) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: '手動起動には Authorization: Bearer <ADMIN_PASSWORD> が必要です' })
      };
    }
  }

  const sbHeaders = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };

  const results = [];

  try {
    // (a) ingest_channels から enabled=true を取得
    const channels = await sbFetch(
      `${SUPABASE_URL}/rest/v1/ingest_channels?select=*&enabled=eq.true`,
      { headers: sbHeaders }
    );
    if (!Array.isArray(channels) || channels.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: '有効なチャンネルがありません', results }) };
    }

    for (const channel of channels) {
      try {
        let uploadsPlaylistId = channel.uploads_playlist_id;

        // (b) uploads_playlist_id 未解決なら YouTube channels.list で取得してキャッシュ
        if (!uploadsPlaylistId) {
          const chRes = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channel.channel_id}&key=${YT_KEY}`
          );
          const chData = await chRes.json();
          uploadsPlaylistId = chData?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
          if (!uploadsPlaylistId) {
            results.push({ channel_id: channel.channel_id, error: 'uploads_playlist_id を取得できませんでした' });
            continue;
          }
          // PATCHでキャッシュ
          await fetch(
            `${SUPABASE_URL}/rest/v1/ingest_channels?id=eq.${channel.id}`,
            {
              method: 'PATCH',
              headers: sbHeaders,
              body: JSON.stringify({ uploads_playlist_id: uploadsPlaylistId })
            }
          );
        }

        // (c) playlistItems.list で新着取得（最大50件）
        const plRes = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${uploadsPlaylistId}&key=${YT_KEY}`
        );
        const plData = await plRes.json();
        if (plData.error) {
          results.push({ channel_id: channel.channel_id, error: `YouTube API: ${plData.error.message}` });
          continue;
        }

        const playlistItems = plData.items || [];

        // last_video_published_at より新しいものだけ抽出
        const cursor = channel.last_video_published_at ? new Date(channel.last_video_published_at) : null;
        const newItems = playlistItems.filter(item => {
          const pub = item.snippet?.publishedAt;
          if (!pub) return false;
          if (cursor && new Date(pub) <= cursor) return false;
          return true;
        });

        if (newItems.length === 0) {
          // カーソル更新のみ
          await fetch(
            `${SUPABASE_URL}/rest/v1/ingest_channels?id=eq.${channel.id}`,
            {
              method: 'PATCH',
              headers: sbHeaders,
              body: JSON.stringify({ last_checked_at: new Date().toISOString() })
            }
          );
          results.push({ channel_id: channel.channel_id, new_items: 0, inserted: 0 });
          continue;
        }

        // videoId リスト
        const videoIds = newItems
          .map(item => item.snippet?.resourceId?.videoId)
          .filter(Boolean);

        // (d) videos.list で duration / live 情報取得
        const vtRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,liveStreamingDetails&id=${videoIds.join(',')}&key=${YT_KEY}`
        );
        const vtData = await vtRes.json();
        const videoDetails = {};
        (vtData.items || []).forEach(v => { videoDetails[v.id] = v; });

        // (e) Supabase で既存URL突合（全件fetch禁止 — urlリストで絞り込み）
        // 生成するURLは https://www.youtube.com/watch?v=VIDEOID 形式で & を含まないため安全
        const candidateUrls = videoIds.map(id => `https://www.youtube.com/watch?v=${id}`);
        const inFilter = candidateUrls.map(u => `"${u}"`).join(',');
        const existingRes = await sbFetch(
          `${SUPABASE_URL}/rest/v1/videos?select=url&url=in.(${inFilter})`,
          { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        );
        const existingUrls = new Set(
          Array.isArray(existingRes) ? existingRes.map(v => v.url) : []
        );

        // (f) content_type分類 + member確定 + カバー検出
        const toInsert = [];
        let latestPublishedAt = cursor;

        for (const videoId of videoIds) {
          const url = `https://www.youtube.com/watch?v=${videoId}`;
          if (existingUrls.has(url)) continue;

          const detail = videoDetails[videoId];
          if (!detail) continue;

          const snippet = detail.snippet || {};
          const contentDetails = detail.contentDetails || {};
          const liveDetails = detail.liveStreamingDetails;

          const title = snippet.title || '';
          const description = snippet.description || '';
          const publishedAt = snippet.publishedAt || null;
          const durationSec = parseDuration(contentDetails.duration);
          const hasLiveDetails = !!liveDetails;

          const contentType = classifyContentType(title, description, durationSec, hasLiveDetails);
          const member = resolveMember(channel.member_id, title);
          const coverTag = detectCoverTag(title);

          // タグは 'Covered' のみ自動付与（他は空）
          const tags = coverTag || '';

          const date = publishedAt ? publishedAt.slice(0, 10) : null;

          toInsert.push({
            url,
            title,
            date,
            member,
            tags,
            note: '',
            spotify_url: null,
            album_id: null,
            status: 'pending',        // 自動publishは絶対禁止
            content_type: contentType,
            source: 'youtube_auto',
            ingested_at: new Date().toISOString()
          });

          // カーソル更新候補
          if (publishedAt) {
            const pubDate = new Date(publishedAt);
            if (!latestPublishedAt || pubDate > latestPublishedAt) {
              latestPublishedAt = pubDate;
            }
          }
        }

        // (g) INSERT（status='pending', source='youtube_auto', ingested_at=now()）
        let inserted = 0;
        if (toInsert.length > 0) {
          const insRes = await fetch(
            `${SUPABASE_URL}/rest/v1/videos`,
            {
              method: 'POST',
              headers: { ...sbHeaders, Prefer: 'return=minimal' },
              body: JSON.stringify(toInsert)
            }
          );
          if (insRes.ok) {
            inserted = toInsert.length;
          } else {
            const errText = await insRes.text().catch(() => '');
            throw new Error(`INSERT失敗: ${insRes.status} ${errText.slice(0, 200)}`);
          }
        }

        // (h) カーソル更新（last_checked_at + last_video_published_at）
        const cursorUpdate = { last_checked_at: new Date().toISOString() };
        if (latestPublishedAt) {
          cursorUpdate.last_video_published_at = latestPublishedAt instanceof Date
            ? latestPublishedAt.toISOString()
            : latestPublishedAt;
        }
        await fetch(
          `${SUPABASE_URL}/rest/v1/ingest_channels?id=eq.${channel.id}`,
          {
            method: 'PATCH',
            headers: sbHeaders,
            body: JSON.stringify(cursorUpdate)
          }
        );

        results.push({
          channel_id: channel.channel_id,
          member_id: channel.member_id,
          new_items: newItems.length,
          inserted,
          skipped: newItems.length - toInsert.length - (toInsert.length - inserted)
        });

      } catch (channelErr) {
        // チャンネル単位のエラー: カーソル据え置き（次回自動リトライ）
        console.error(`チャンネル ${channel.channel_id} でエラー:`, channelErr);
        results.push({ channel_id: channel.channel_id, error: channelErr.message });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, processed: channels.length, results })
    };

  } catch (e) {
    console.error('ingest-youtube fatal error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
