// netlify/functions/_shared/responses.js
// 定型レスポンス（完全同形のもののみ共通化 — B3計画§3）
// 対象外: JSON形式の405（admin-auth / admin-query / exchange）、admin-auth独自の
// 'PARSE ERROR — MALFORMED REQUEST'、CORS 3パターン、エラーレスポンス3系統 — すべてローカル維持。

/** 平文405（headersキーなし・現行10ファイル同形） */
function methodNotAllowed() {
  return { statusCode: 405, body: 'Method Not Allowed' };
}

/** JSONパース失敗の400（headersキーなし・同文のもののみ） */
function invalidJson() {
  return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
}

/** JSONレスポンス。headers省略時はheadersキー自体を含めない（現行形状の維持） */
function json(statusCode, bodyObj, headers) {
  return headers
    ? { statusCode, headers, body: JSON.stringify(bodyObj) }
    : { statusCode, body: JSON.stringify(bodyObj) };
}

/** event.body のJSONパース。現行の `JSON.parse(event.body || '{}')` と同値 */
function parseJsonBody(event) {
  try {
    return { ok: true, body: JSON.parse(event.body || '{}') };
  } catch {
    return { ok: false };
  }
}

module.exports = { methodNotAllowed, invalidJson, json, parseJsonBody };
