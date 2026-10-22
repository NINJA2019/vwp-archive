// search.js — 検索の正規化・検索キー構築・段階的フォールバック（純粋関数のみ）
// window には露出しない（憲法8: 既存の露出テーブルを変えない。pageview.js と同方針）
import { I18N, MEMBER_ALIASES } from './constants.js';

// 記号除去: 空白に置換せず削除する（"V.W.P" → "vwp" を成立させるため）。長音「ー」も両辺同処理で削除
const SYMBOL_RE = /["'「」『』【】（）()\[\]{}<>《》〈〉・/|:;,.!?~\-—–ー#&*+=_｜`]/g;

export function normalizeText(s){
  if(s==null) return '';
  return String(s)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60)) // ひらがな→カタカナ（ゐ→ヰ 含む）
    .replace(SYMBOL_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(q){
  if(!q) return [];
  return String(q).normalize('NFKC').split(/\s+/).map(normalizeText).filter(Boolean);
}

// 1動画あたり1文字列の検索キー（言語非依存: 全言語の表示名を含める）
export function buildSearchKey(v, members, tags, albumName){
  const parts = [v.title || '', v.note || ''];
  const langs = Object.keys(I18N);
  (members || []).forEach(id => {
    parts.push(id);
    langs.forEach(l => { const n = I18N[l].mbr && I18N[l].mbr[id]; if(n) parts.push(n); });
    (MEMBER_ALIASES[id] || []).forEach(a => parts.push(a));
  });
  (tags || []).forEach(tag => {
    parts.push(tag);
    langs.forEach(l => { const m = I18N[l].tagMap && I18N[l].tagMap[tag]; if(m) parts.push(m); });
  });
  if(albumName) parts.push(albumName);
  return normalizeText(parts.join(' '));
}

export function bigrams(s){
  const t = String(s || '').replace(/\s+/g, '');
  const set = new Set();
  for(let i = 0; i + 1 < t.length; i++) set.add(t.slice(i, i + 2));
  return set;
}

export function matchAll(key, tokens){ return tokens.every(t => key.includes(t)); }
export function matchAny(key, tokens){ return tokens.some(t => key.includes(t)); }

// 段階的フォールバック
//  level 0: scoped（現在の絞り込み）に対し全語AND
//  level 1: all（絞り込み全解除）に対し全語AND
//  level 2: all に対し いずれかの語OR（トークン>=2のとき）
//  level 3: all に対し bigram 近似一致（正規化クエリ長>=2）、共通bigram数 >= max(1, floor(n/2))、上位 limit 件
//  level 4: 0件
export function searchWithFallback({ tokens, scoped, all, keyOf, bigramsOf, limit = 30 }){
  if(!tokens || !tokens.length) return { level: 0, list: scoped.slice(), strictCount: scoped.length };
  const strict = scoped.filter(v => matchAll(keyOf(v), tokens));
  if(strict.length) return { level: 0, list: strict, strictCount: strict.length };
  const l1 = all.filter(v => matchAll(keyOf(v), tokens));
  if(l1.length) return { level: 1, list: l1, strictCount: 0 };
  if(tokens.length >= 2){
    const l2 = all.filter(v => matchAny(keyOf(v), tokens));
    if(l2.length) return { level: 2, list: l2, strictCount: 0 };
  }
  const q = tokens.join('');
  if(q.length >= 2){
    const qb = bigrams(q);
    const need = Math.max(1, Math.floor(qb.size / 2));
    const scored = [];
    all.forEach(v => {
      const vb = bigramsOf(v);
      let n = 0;
      qb.forEach(g => { if(vb.has(g)) n++; });
      if(n >= need) scored.push({ v, n });
    });
    if(scored.length){
      scored.sort((a, b) => b.n - a.n);
      return { level: 3, list: scored.slice(0, limit).map(s => s.v), strictCount: 0 };
    }
  }
  return { level: 4, list: [], strictCount: 0 };
}
