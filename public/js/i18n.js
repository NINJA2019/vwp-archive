// i18n.js — 言語状態・翻訳関数（app.js L15-24, 150 相当）

import { I18N } from './constants.js';

// 可変状態: lang
let lang = 'ja';

export function getLang(){ return lang; }
export function setLang(l){ lang = l; }

export function t(k){ return (I18N[lang]||I18N.ja)[k] || I18N.ja[k] || k; }
export function mbr(id){ return (I18N[lang].mbr||I18N.ja.mbr)[id] || id; }
export function applyI18n(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-sub]').forEach(el=>{ el.textContent = t(el.dataset.i18nSub); });
  document.getElementById('searchInput').placeholder = t('searchPh');
  const sd=document.getElementById('sDaily');if(sd) sd.textContent=t('dailyObs');
  const sdp=document.getElementById('sDailyPick');if(sdp) sdp.textContent=t('dailyPick');
}
export function tTag(tag){ return (I18N[lang].tagMap||{})[tag] || tag; }
