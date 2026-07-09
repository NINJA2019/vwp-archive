// netlify/functions/_shared/client-hash.js
// SHA-256計算の単一実装（admin-auth発行 / admin-query検証 / exchange clientHash）
// 注意: 認証4方式そのものは統一しない（B3計画§3）。ここはハッシュ計算のみ。

const crypto = require('crypto');

/** SHA-256 hex */
function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** NetlifyのクライアントIPヘッダ → SHA-256（observer-link-exchangeの現行実装と同一） */
function getClientHash(event) {
  // Use Netlify's reliable client IP header, fall back to x-forwarded-for
  const ip = (event.headers['x-nf-client-connection-ip']
    || (event.headers['x-forwarded-for'] || '127.0.0.1').split(',')[0]).trim();
  return sha256Hex(ip);
}

module.exports = { sha256Hex, getClientHash };
