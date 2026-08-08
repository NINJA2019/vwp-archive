// ═══════════════════════════════════════════════════════════════
// ingest-youtube.js — YouTube自動取り込みFunction
// スケジュール: 6時間ごと (netlify.toml で設定)
// 手動起動: Authorization: Bearer <ADMIN_PASSWORD> が必要
// 取り込みは status='published' 着地（2026-07-14 Yuki決定・憲法10改訂済み）
// 前提: dedup全件fetchのページングループ（憲法5）が正しく動作していること
// ═══════════════════════════════════════════════════════════════

const { getSupabaseUrl, secretKey, sbHeaders: buildSbHeaders, sbFetch, fetchAllVideoRows } = require('./_shared/supabase');
// URLからYouTube videoId（11文字）を抽出（playlist-import.js / admin-query.jsと共通）
// 注: playlistItems.list の1ページ50件取得は意図的仕様のため fetchAllPlaylistItems は使わない
const { ytId } = require('./_shared/yt');

// ── キーワード定数辞書 ──
const SHORTS_KEYWORDS = ['#shorts'];
// 「Music Archive」シリーズはタイトルで判定（description誤爆リスクあり）
const MUSIC_ARCHIVE_KEYWORDS = ['music archive'];
const LIVE_KEYWORDS = [
  'ワンマン', 'ライブ映像', '不可解', '現象', '狂想'
];
// 英語 "live" は部分一致だと "deliver"/"believe" 等を誤爆するため単語境界で判定
const LIVE_WORD_RE = /\blive\b/i;
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

  // shorts: 60秒以下 OR タイトル/descriptionに #shorts OR タイトルにMusic Archiveキーワード
  if (
    (durationSec !== null && durationSec <= 60) ||
    SHORTS_KEYWORDS.some(k => text.includes(k.toLowerCase())) ||
    MUSIC_ARCHIVE_KEYWORDS.some(k => titleLower.includes(k))
  ) {
    return 'shorts';
  }

  // live: liveStreamingDetailsあり OR タイトルにライブ系キーワード
  // 英語 "live" のみ単語境界一致（誤爆防止）、日本語キーワードは部分一致
  if (
    hasLiveDetails ||
    LIVE_KEYWORDS.some(k => titleLower.includes(k.toLowerCase())) ||
    LIVE_WORD_RE.test(title)
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

// Supabase fetch ラッパーは _shared/supabase.js の sbFetch を errSlice:300 で使用（現行の切り詰め長を維持）

// ── メインハンドラ ──
exports.handler = async (event) => {
  const SUPABASE_URL = getSupabaseUrl();
  const SUPABASE_KEY = secretKey();
  const YT_KEY = process.env.YOUTUBE_API_KEY;
  const ADMIN_PW = process.env.ADMIN_PASSWORD;

  if (!SUPABASE_URL || !SUPABASE_KEY || !YT_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: '環境変数が不足しています' }) };
  }

  // ── 手動起動ガード ──
  // Netlifyスケジューラ起動のみ httpMethod が存在しない。
  // HTTP経由（httpMethodあり）の呼び出しはすべて ADMIN_PASSWORD トークン必須。
  // 本文スニッフィング（next_run等）による判定はバイパス可能なため行わない。
  const isScheduled = !event.httpMethod;

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

  const sbHeaders = buildSbHeaders(SUPABASE_KEY, {
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  });

  const results = [];

  try {
    // (a) ingest_channels から enabled=true を取得
    const channels = await sbFetch(
      `${SUPABASE_URL}/rest/v1/ingest_channels?select=*&enabled=eq.true`,
      { headers: sbHeaders },
      { errSlice: 300 }
    );
    if (!Array.isArray(channels) || channels.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: '有効なチャンネルがありません', results }) };
    }

    // (e) Supabase で既存videoId突合（チャンネル横断・ループ外で1回だけfetch）
    // pending含む全件 — status不問でないと重複取りこぼし
    // 憲法5: 1,000件超は fetchAllVideoRows でページング（limit=1000&offset=N&order=id.asc。単発limit=10000はMax Rowsで1,000にsilent drop）
    const { rows: existingRows, overflow } = await fetchAllVideoRows(
      SUPABASE_URL, SUPABASE_KEY, 'url', { throwOnHttpError: true, errSlice: 300 }
    );
    if (overflow) {
      console.error('videos件数が全件fetch安全上限(50,000)に到達。dedup不完全のため取り込み中止。テーブル異常膨張の可能性。');
      return { statusCode: 500, body: JSON.stringify({ error: 'videos件数が安全上限(50,000)に到達。dedup不完全のため安全のため中止。', count: existingRows.length }) };
    }
    const existingVideoIds = new Set(
      (Array.isArray(existingRows) ? existingRows : []).map(r => ytId(r.url)).filter(Boolean)
    );

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

        // playlistPubマップ: videoId → playlistItemのpublishedAt（詳細未取得時の公開日フォールバック用）
        const playlistPubMap = {};
        for (const item of newItems) {
          const vid = item.snippet?.resourceId?.videoId;
          const pub = item.snippet?.publishedAt;
          if (vid && pub) playlistPubMap[vid] = pub;
        }

        // (f) content_type分類 + member確定 + カバー検出
        const toInsert = [];
        const resolvedPubs = [];    // カーソル計算用（既存・新規問わず詳細取得済み）
        const missingPubs = [];     // details未取得動画のpublishedAt（playlistItem側）
        const seenInBatch = new Set(); // バッチ内重複videoId防止
        let existingCount = 0;

        for (const videoId of videoIds) {
          if (seenInBatch.has(videoId)) continue;
          seenInBatch.add(videoId);

          const playlistPub = playlistPubMap[videoId] || null;
          const detail = videoDetails[videoId];

          if (!detail) {
            // details未取得（削除/非公開/プレミア処理中等）
            if (existingVideoIds.has(videoId)) { existingCount++; continue; } // 既存はカーソル保護不要
            if (playlistPub) missingPubs.push(playlistPub);
            continue;
          }

          const snippet = detail.snippet || {};
          const contentDetails = detail.contentDetails || {};
          const liveDetails = detail.liveStreamingDetails;

          const title = snippet.title || '';
          const description = snippet.description || '';
          const publishedAt = snippet.publishedAt || playlistPub || null;
          const durationSec = parseDuration(contentDetails.duration);
          const hasLiveDetails = !!liveDetails;

          if (existingVideoIds.has(videoId)) {
            // 既存動画（pending含む）—— INSERTしないがカーソルには寄与
            if (publishedAt) resolvedPubs.push(publishedAt);
            existingCount++;
            continue;
          }

          const contentType = classifyContentType(title, description, durationSec, hasLiveDetails);
          const member = resolveMember(channel.member_id, title);
          const coverTag = detectCoverTag(title);

          // タグは 'Covered' のみ自動付与（他は空）
          const tags = coverTag || '';

          const date = publishedAt ? publishedAt.slice(0, 10) : null;

          toInsert.push({
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title,
            date,
            member,
            tags,
            note: '',
            spotify_url: null,
            album_id: null,
            status: 'published',      // 憲法10改訂: 自動取り込みはpublished着地（2026-07-14 Yuki決定）
            content_type: contentType,
            source: 'youtube_auto',
            ingested_at: new Date().toISOString()
          });

          if (publishedAt) resolvedPubs.push(publishedAt);
        }

        // (g) INSERT（status='published', source='youtube_auto', ingested_at=now()）
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

        // (h) M3 カーソルクランプ（7日ガード込み）
        // 7日以内のmissing（プレミア処理中等）のみクランプ対象。7日超は削除/非公開の居座りとみなし通過許可
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentMissingPubs = missingPubs.filter(p => new Date(p) > sevenDaysAgo);
        const minMissing = recentMissingPubs.length > 0
          ? recentMissingPubs.reduce((min, p) => p < min ? p : min)
          : null;

        let newCursor = cursor;
        for (const p of resolvedPubs) {
          const d = new Date(p);
          if (minMissing && d >= new Date(minMissing)) continue; // 未取得動画を追い越さない
          if (!newCursor || d > newCursor) newCursor = d;
        }

        // カーソル更新（last_checked_at + last_video_published_at）
        const cursorUpdate = { last_checked_at: new Date().toISOString() };
        if (newCursor) {
          cursorUpdate.last_video_published_at = newCursor instanceof Date
            ? newCursor.toISOString()
            : newCursor;
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
          existing: existingCount,
          no_detail_skipped: missingPubs.length
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
