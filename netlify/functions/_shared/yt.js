// netlify/functions/_shared/yt.js
// YouTube関連の共通ヘルパー
// 対象外（B3計画§2）:
//   - 単発動画メタ取得（youtube.js と admin-query でサムネ優先順位等の外部差異があるため）
//   - result.js の extractYtId（別実装・挙動差があるため触らない）
//   - ingest-youtube の playlistItems 1ページ50件取得（意図的仕様のため使わない）

// URLからYouTube videoId（11文字）を抽出（null安全）
function ytId(url){ if(!url) return null; const m=String(url).match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/); return m?m[1]:null; }

/**
 * playlistItems.list の全ページ取得（kind==='youtube#video' のみ、最大 maxItems 件）。
 * YouTube APIエラー時は { error: <data.error> } を返す。
 * エラー文言の整形は呼び出し元の現行実装のまま
 * （admin-query: 'YouTube API: ' + (message || 'Unknown') / playlist-import: message のみ）。
 */
async function fetchAllPlaylistItems(playlistId, apiKey, { maxItems = 200 } = {}) {
  let allItems = [];
  let pageToken = '';
  while (true) {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(playlistId)}&key=${apiKey}${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) return { error: data.error };
    const items = (data.items || []).filter(i => i.snippet.resourceId.kind === 'youtube#video');
    allItems = allItems.concat(items);
    if (data.nextPageToken && allItems.length < maxItems) { pageToken = data.nextPageToken; } else break;
  }
  return { items: allItems };
}

module.exports = { ytId, fetchAllPlaylistItems };
