// tests/fn-snapshot/run.mjs — Netlify Functions 入出力スナップショットハーネス（B3計画§6層1）
//
// 使い方:
//   node tests/fn-snapshot/run.mjs --fn-dir netlify/functions --out /tmp/after.json
//   node tests/fn-snapshot/run.mjs --fn-dir /tmp/vwp-b3-base/netlify/functions --out /tmp/base.json
//   diff /tmp/base.json /tmp/after.json   # 空 = 同値性の機械保証
//
// 仕組み:
//   - global.fetch をシナリオごとのルートテーブルでスタブ（PostgREST / YouTube応答をfixture化）
//   - Date.now / new Date（引数なし）/ Math.random / env をダミー固定
//   - 各handlerを require してモックeventで直接呼び、戻り値全体
//     （statusCode / headers / body — headersキーの有無まで）をJSONシリアライズ保存
//   - 送信した外向きfetch（url / method / headers / body）も記録 → DB書き込み等の副作用も比較対象
//
// 注意: スナップショットは前後比較専用（絶対値の正しさは層2のデプロイプレビューcurlで担保）。

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { dirname } from 'node:path';

// ── 引数 ──
const args = process.argv.slice(2);
function arg(name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; }
const fnDir = path.resolve(arg('--fn-dir') || 'netlify/functions');
const out = arg('--out');
if (!out) { console.error('usage: node run.mjs --fn-dir <functions dir> --out <snapshot file>'); process.exit(1); }

// ── 決定論化: Date ──
const RealDate = Date;
const FIXED_NOW = new RealDate('2026-01-15T12:00:00.000Z').getTime();
class FixedDate extends RealDate {
  constructor(...a) { if (a.length === 0) { super(FIXED_NOW); } else { super(...a); } }
  static now() { return FIXED_NOW; }
}
globalThis.Date = FixedDate;

// ── 決定論化: Math.random（固定シーケンス、シナリオごとにリセット） ──
const RAND_SEQ = [0.42, 0.17, 0.83, 0.05, 0.61, 0.29, 0.94, 0.50];
let randIdx = 0;
Math.random = () => RAND_SEQ[(randIdx++) % RAND_SEQ.length];

// ── 決定論化: env（ダミー固定。シナリオ単位で上書き/削除可） ──
const BASE_ENV = {
  SUPABASE_URL: 'https://sb.example.test',
  SUPABASE_SECRET_KEY: 'sk_secret_dummy',
  SUPABASE_ANON_KEY: 'sk_anon_dummy',
  SUPABASE_SERVICE_ROLE_KEY: 'sk_service_dummy',
  YOUTUBE_API_KEY: 'yt_key_dummy',
  ADMIN_PASSWORD: 'admin_pw_dummy',
};
function applyEnv(overrides = {}) {
  const merged = { ...BASE_ENV, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === null) delete process.env[k]; else process.env[k] = v;
  }
}

// ── fetchスタブ ──
// route: { method?: 'GET'|'POST'|..., match: string | (url, opts) => bool, status?: number, body: any | (url, opts) => any, networkError?: string, resHeaders?: {lowercase-name: value} }
function makeFetchStub(routes, calls) {
  return async (url, opts = {}) => {
    const u = String(url);
    const method = opts.method || 'GET';
    calls.push({
      method,
      url: u,
      headers: opts.headers,
      body: typeof opts.body === 'string' ? opts.body : opts.body === undefined ? undefined : String(opts.body),
    });
    for (const r of routes) {
      if (r.method && r.method !== method) continue;
      const hit = typeof r.match === 'function' ? r.match(u, opts) : u.includes(r.match);
      if (!hit) continue;
      if (r.networkError) throw new Error(r.networkError);
      const status = r.status ?? 200;
      const raw = typeof r.body === 'function' ? r.body(u, opts) : r.body;
      const bodyText = typeof raw === 'string' ? raw : JSON.stringify(raw);
      return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (name) => (r.resHeaders || {})[String(name).toLowerCase()] ?? null },
        text: async () => bodyText,
        json: async () => JSON.parse(bodyText),
      };
    }
    // fixture不足はここで顕在化する（決定論的なので前後比較は成立するが、原則fixtureを足すこと）
    throw new Error(`UNMATCHED_FETCH: ${method} ${u}`);
  };
}

// ── 正規化シリアライズ（オブジェクトのキー順のみ正規化。bodyは文字列のままバイト比較） ──
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) {
      if (v[k] !== undefined) o[k] = canon(v[k]);
    }
    return o;
  }
  return v;
}

// ── 実行 ──
const require_ = createRequire(import.meta.url);
const { scenarios } = await import('./scenarios.mjs');

const results = [];
for (const sc of scenarios) {
  randIdx = 0;
  applyEnv(sc.env);
  const calls = [];
  globalThis.fetch = makeFetchStub(sc.routes || [], calls);

  let entry = { name: sc.name, fn: sc.fn };
  try {
    const mod = require_(path.join(fnDir, sc.fn + '.js'));
    const ret = await mod.handler(sc.event, {});
    entry.result = canon(ret);
  } catch (e) {
    entry.threw = String(e && e.message);
  }
  entry.calls = canon(calls);
  results.push(entry);
}
applyEnv({});

mkdirSync(dirname(path.resolve(out)), { recursive: true });
writeFileSync(out, JSON.stringify(results, null, 2) + '\n');
console.error(`wrote ${results.length} scenarios -> ${out}`);
