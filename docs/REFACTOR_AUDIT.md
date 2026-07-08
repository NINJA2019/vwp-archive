# vwp-archive リファクタリング監査レポート（PR-B0）

> 作成日: 2026/07/08
> 対象: main d4c1a05
> 企画書: VWP_kaishu_kikakusho_2026-07.md 柱B Phase 0
> 実測コミット: 本レポート作成時点（2026/07/08）の HEAD と一致

---

## 1. ファイルサイズ・行数棚卸し

### フロントエンド（public/）

| ファイル | 行数 | 備考 |
|---|---|---|
| app.js | 3,484 | メインアプリ全体（後述のブロックマップ参照） |
| admin.js | 1,208 | 管理者パネル専用。独立した世界観（MU-TH-UR 6000） |
| style.css | 1,031 | 全スタイル（L1 が巨大1行: 後述） |
| admin.css | 507 | 管理者パネル専用スタイル |
| index.html | 661 | 公開サイトメイン |
| mobile-cards.html | 736 | モバイルカードビュー（デッド候補、後述） |
| mobile-shelf.html | 215 | モバイル棚（デッド候補） |
| mobile-welcome.html | 508 | モバイルウェルカム（デッド候補） |
| vwp_mobile_card_view.html | 735 | プロトタイプ原本（デッド候補・XSS修正前の脆弱版） |
| vwp_mobile_shelf.html | 209 | プロトタイプ原本（デッド候補・XSS修正前の脆弱版） |
| vwp_welcome_scurve.html | 508 | プロトタイプ原本（mobile-welcome.htmlとバイト完全同一） |

### Netlify Functions（netlify/functions/）— 全16ファイル 計1,888行

| ファイル | 行数 | ファイル | 行数 |
|---|---|---|---|
| admin-auth.js | 58 | observer-link-exchange.js | 260 |
| admin-query.js | 160 | observer-link-result.js | 503 |
| albums-add.js | 30 | playlist-import.js | 96 |
| albums-delete.js | 42 | videos-add.js | 58 |
| albums-get.js | 23 | videos-delete.js | 44 |
| albums-update.js | 38 | videos-get.js | 61 |
| auth-check.js | 14 | videos-update.js | 43 |
| ingest-youtube.js | 402 | youtube.js | 56 |

---

## 2. app.js 機能ブロックマップ

全3,484行。トップレベル（L1–1185）+ 大型IIFE 2つ（イントロ演出 L1186–1994 / MY SHELF + OL L1996–3484）で構成。**モバイルUIはイントロIIFEの内側にネストし、OLはSHELF IIFEの内側にネストしている**点がモジュール分割の最大の構造的制約。

### i18n（多言語）

| 行範囲 | 内容 | 主要関数・変数 |
|---|---|---|
| 1–14 | I18N辞書（ja/en/zh/ko、mbr名・tagMap含む） | `I18N` |
| 15–24 | 言語状態・翻訳関数・DOM適用 | `lang`, `t()`, `mbr()`, `applyI18n()` |
| 150 | タグ翻訳 | `tTag()` |

依存: なし（最下層）。逆にほぼ全ブロックが `t()/mbr()` に依存。言語切替イベントは L773–779。

### core（初期化・データ取得・カード描画）

| 行範囲 | 内容 | 主要関数・変数 |
|---|---|---|
| 26–30 | メンバー定義 | `MEMBERS`, `MBR_CLS` |
| 32–46, 1130 | 静的ページ開閉 | `openPage()`, `closePage()` |
| 48–61 | fetchエラートースト | `showFetchError()` |
| 63–67 | グローバル状態 | `videos`, `curMember`, `selectedMembers`, `curTag`, `curSort`, `curView`, `searchQ`, `isAdmin`, `editId`, `filteredCache`, `curPage`, `PAGE_SIZE=30`, `PW_SK` |
| 69–88 | GA4ヘルパー | `_gtag()`, `trackSongClick()`, `trackExternalLink()` |
| 89–90 | 管理者PW保存（sessionStorage） | `getStoredPw()`, `storePw()` |
| 93–124 | アルバム状態・API・キャッシュTTL | `albums`, `curAlbum`, `loadAlbums()`, `addAlbumApi()`, `updateAlbumApi()`, `deleteAlbumApi()`, `albumThumb()` |
| 125–141 | 動画API | `loadVideos()`, `addVideoApi()`, `deleteVideoApi()`, `updateVideoApi()` |
| 143–157 | ユーティリティ | `ytId()`, `thumb()`, `fmtDate()`, `parseTags()`, `parseMembers()`, `esc()`, `safeUrl()`, `tagPills()`, `mbPill()`, `spotifyBtn()` |
| 160–208 | 今日の観測（Daily Pick） | `DAILY_MEMBERS`, `DAILY_SK='vwp_daily_obs'`, `seededRand()`, `getTodayJST()`, `getDailyPicks()`, `getDailyPicksFromCache()` |
| 210–251 | フィルタリング・件数 | `filtered()`, `allTagsOf()`, `updateCounts()` |
| 253–454 | サイドバー構築（メンバー複数選択・アルバムグループ折りたたみ・管理UI混在） | `buildSidebar()` |
| 518–542 | 動画削除・編集起動 | `del()`, `edit()` |
| 544–582 | カード描画3種（デッド候補: 後述） | `showMb()`, `renderGrid()`, `renderList()`, `renderTimeline()` |
| 583–648 | 無限スクロール | `setupObserver()`, `loadMoreItems()` |
| 651–661 | NEWバッジ（メンバー別新着2件） | `newBadgeIds`, `updateNewBadgeIds()` |
| 662–727 | メイン描画（アルバムヘッダー含む） | `render()` |
| 729–756 | タグ入力チップ | `inputTags`, `renderTagSuggest()`, `renderTagChips()`, `addInputTag()`, `removeInputTag()` |
| 758–779 | 検索・ビュー切替・ソートのイベント | （無名リスナー） |
| 781–897 | 動画追加/編集モーダル | fetchBtn, `mSave`リスナー, `buildMemberSelect()`, `refreshAlbumSelects()`, `refreshImportAlbumSelect()`, `getSelectedMembers()`, `setSelectedMembers()` |
| 901–987 | 既存曲紐付けモーダル | `openLinkSongModal()`, `linkSong()`, `unlinkSong()` |
| 989–1079 | アルバム編集/追加モーダル | `openEditAlbumModal()`, `openAlbumModal()` |
| 1081–1118 | 管理者認証 | `setAdminMode()`, `verifyPw()` |
| 1120–1128 | ブートストラップ（即時async IIFE） | loadVideos → loadAlbums → buildSidebar → render → PW自動再ログイン |
| 1142–1185 | プレイリストインポート | importSubmitリスナー |

依存: shelf（`shelfPinHtml`）と OL（`olQuickSendHtml`, `openObserverLink`）を `typeof` ガード付きで参照（L554, 564, 578, 606, 616, 637, 771）。renderGrid/renderList/renderTimeline/loadMoreItems の4箇所にほぼ同一のカードHTMLテンプレートが重複。

### theme（テーマ切替）

| 行範囲 | 内容 |
|---|---|
| 1132–1140 | ライト/ダーク切替、`localStorage('vwp_theme')` |

メンバーカラー定義自体は shelf ブロック内（L2069–2079）にある。

### intro（ターンテーブル・イントロ演出）— IIFE L1186–1994

| 行範囲 | 内容 | 主要関数・変数 |
|---|---|---|
| 1190–1198 | イントロ専用メンバー定義（**トップレベルMEMBERSをシャドーイング**、OL疑似メンバー含む） | ローカル `MEMBERS` |
| 1211–1256 | 画面サイズ別スケーリング（baseSize 560等） | — |
| 1258–1283 | LP円形配置 | — |
| 1285–1347 | LP選択演出（アーム・プラッター） | `doSelect()` |
| 1349–1413 | 入場処理（黒幕フェード → フィルタ適用） | `enterArchive()` |
| 1415–1420 | ENTERボタン・Enterキー | — |

依存: core（`selectedMembers`, `curMember`, `buildSidebar`, `render`, `_gtag`）、OL（`openObserverLink`）。

### mobile（モバイル分岐）— intro IIFE内のネストIIFE L1422–1992

`window.innerWidth > 700` なら即return（L1424）。

| 行範囲 | 内容 | 主要関数・変数 |
|---|---|---|
| 1436–1446 | S字ホイール用メンバー定義・レイアウト定数 | `MW_MEMBERS`, `MW_CENTER=110`, `MW_SMALL=56`, `MW_TINY=38`, `MW_VSPACE=120`, `MW_AMP=70` |
| 1457–1548 | S字ホイール描画 | `mwRender()`, `mwDrawPath()` |
| 1550–1590 | タッチ/マウス・慣性 | `mwDecel()` |
| 1592–1619 | 入場ボタン・トランジション | `mwTransition()` |
| 1625–1887 | モバイルカードビュー（スワイプ式） | `mcInit()`, `mcFilter()`, `mcRenderChips()`, `mcRenderCards()`, `mcCreateCard()`, `mcApplyDrag()`, `mcSwipeEnd()`, `mcAttachSwipe()`, `mcUpdateMeta()` |
| 1889–1990 | モバイル棚（カルーセル） | `msInit()`, `msRender()`, `msSetAct()`, `msUpdateGlow()`, `msShowDet()` |

依存: core（`videos`, `parseTags`, `parseMembers`, `ytId`, `fmtDate`, `esc`, `safeUrl`, `getDailyPicks`）、shelf（`window.getMemberColor`, `window.drawVinylDisc`, `window.isOnShelf`, `window.addToShelf`, `window.removeFromShelf`, `window.getShelf`）、OL（`window.olQuickSend`, `openObserverLink`）。**window.* 経由でしか shelf/OL に触れない**（IIFE分断のため）。

### shelf（MY SHELF）— IIFE L1996–2495

| 行範囲 | 内容 | 主要関数・変数 |
|---|---|---|
| 2000–2031 | localStorage読み書き | `SHELF_KEY='vwp_shelf'`, `SHELF_MAX=10`, `getShelf()`, `setShelf()`, `isOnShelf()`, `addToShelf()`, `removeFromShelf()`, `updateShelfNavCnt()` |
| 2033–2066 | Chrome拡張連携（postMessage） | `_extractVideoId()`, `notifyExtension()` |
| 2069–2079 | メンバーカラー定義 | `MEMBER_COLORS`, `getMemberColor()` |
| 2082–2166 | Canvas LPディスク描画 | `drawVinylDisc()` |
| 2169–2223 | 棚UI構築（5枚/段・傾き配列） | `buildShelfUI()` |
| 2226–2330 | 詳細パネル（ジャケット+ビニール演出） | `window.shelfOpenPanel`, `shelfClosePanel()`, `shelfResetVinyl()`, `shelfPlaySong()` |
| 2333–2366 | オーバーレイ開閉・i18n | `window.openShelf`, `updateShelfI18n()`, `closeShelfOverlay()` |
| 2369–2393 | ピンボタン | `window.toggleShelfPin`, `window.shelfPinHtml` |
| 2396–2418 | イベント（閉じる・ESC） | — |
| 2421–2487 | 受信レコード棚（OL連携） | `getReceivedRecords()`, `buildReceivedShelfUI()`, `window.shelfRcvTap`（`window._rcvSongs` 使用） |
| 2490–2495 | window露出（憲法8対象） | `getMemberColor`, `drawVinylDisc`, `addToShelf`, `removeFromShelf`, `isOnShelf`, `getShelf` |

依存: core（`videos`, `ytId`, `parseTags`, `parseMembers`, `t`, `esc`, `safeUrl`, `_gtag`）、i18n。

### observer-link（OL）— shelf IIFE内 L2497–3482

| 行範囲 | 内容 | 主要関数・変数 |
|---|---|---|
| 2500–2514 | 定数・状態 | `OL_MOODS`, `OL_DAILY_LIMIT=10`, `OL_RECEIVED_KEY='vwp_received'`, `OL_MEMBER_DISPLAY`, `OL_TAG_MAP`, `OL_TAG_LABELS`, `olSelectedSong` 等 |
| 2516–2573 | 初期化・deep-link処理 | `olInit()`（`?ol_result=` パース含む） |
| 2575–2589 | 共有リンクからの結果画面 | `olOpenFromResult()` |
| 2591–2666 | ヒーローオシロスコープCanvas | `startOlHeroCanvas()`, `stopOlHeroCanvas()` |
| 2668–2726 | 画面開閉・遷移 | `olOpen()`（= `window.openObserverLink`）, `olClose()`, `olShowScreen()` |
| 2728–2761 | ムード選択・曲選択 | `olToggleMood()`, `olUpdateSendBtn()`, `olSelectSong()` |
| 2763–2891 | ピッカー（shelf/allタブ・メンバードリルダウン） | `olOpenPicker()`, `olBuildPickerContent()`, `olBuildShelfPicker()`, `olBuildAllPicker()`, `olCreatePickerItem()` |
| 2893–2951 | 送信中パーティクル | `olSendingParticles` |
| 2953–3076 | 送信処理（exchange Function呼び出し） | `olSendRecord()`, `olShowSendingCard()`, `olResetSendingView()` |
| 3078–3092 | 表示ヘルパー | `olFormatTimeAgo()`, `olGetMemberDisplay()` |
| 3094–3160 | 結果パーティクル | `olParticles` |
| 3162–3271 | 結果画面構築 | `olShowResult()` |
| 3273–3334 | 共有（Web Share / X / Discord / copy） | `olSetShareData()`, `window.olShareResult`, `window.openShareDialog`, `window.closeShareDialog`, `window.olShareToDiscord`, `window.olCopyShareUrl`, `window.olTrackXShare` |
| 3336–3373 | リセット・受信保存・トースト | `window.olResetCompose`, `olSaveReceivedRecord()`, `olShowToast()` |
| 3375–3475 | クイック送信（カード上の⚡ボタン） | `OL_QS_SVG`, `window.olQuickSendHtml`, `window.olQuickSend` |
| 3477–3482 | DOMContentLoaded初期化 | `olInit` 起動 |

依存: shelf（同一IIFE内の `getShelf`, `getMemberColor`）、core（`videos`, `isAdmin`, `getStoredPw`, `ytId`, `esc`, `safeUrl`, `_gtag`, `parseMembers`, `parseTags`）。

---

## 3. style.css セクションマップ

全1,031行。**L1 が巨大な1行**（ミニファイ状に基本スタイルの大半を含む）である点が最大の可読性問題。CSS分割のPhase 2では、L1 を物理的に展開・分離する前処理が必要。

| 行範囲 | 対象機能 | 使用プレフィックス/セレクタ |
|---|---|---|
| 1 | テーマ変数（:root / body.light）、ヘッダー、検索、ビュー/言語切替、サイドバー、メンバーピル+色、ソートバー、グリッド/リスト/タイムラインカード、モーダル、タグ入力、FAB、モバイル@media(700px)基礎、new-badge、アルバムヘッダー | `.mpill[data-m=]`, `.cfilt`, `.mb-*`, `.vcard/.litem/.tl-*`, `.mover/.modal/.fg/.btn`, `.mob-filters/.mob-chip`, `.al-*`, `#albumHeader` |
| 2–38 | アルバム「曲を追加」ボタン・在庫バッジ（`.al-add-btn` が **L3とL31で二重定義**） | `al-` |
| 40–218 | MOBILE OPTIMIZATION（2026-03-22追記、`!important` 多用）: タッチターゲット46–71 / 2カラム強制74–87 / ソートバー90–101 / チップ104–117 / リスト・TL縮小120–146 / アルバム149–167 / モーダル170–184 / safe-area 187–196 / reduced-motion 199–218 | 既存クラスへの上書き |
| 220–599 | MY SHELF: navボタン225–241 / ピン244–271 / オーバーレイ274–306 / コンクリ+ウォルナット309–376 / ジャケット379–397 / パネル411–553 / 空状態556–563 / ライトテーマ565–578 / モバイルでは非表示581–587 / reduced-motion 590–599 | `shelf-`, `.sj`, `.wood-*`, `.dp-*`, `#my-shelf-overlay` |
| 601–636 | MOBILE S-CURVE WELCOME | `mw-`, `.mob-nav-btn` |
| 638–698 | MOBILE CARD VIEW | `mc-`（`--mc-active` 変数） |
| 700–741 | MOBILE SHELF | `ms-` |
| 743–746 | reduced-motion（mw/mc/ms） | — |
| 748–959 | OBSERVER-LINK本体: 画面骨格751–768 / compose 769–799 / LPアイコングロー800–802 / sending 803–832 / result 833–863 / レコードカード864–903 / ピッカー904–930 / トースト931–934 / OLモバイル935–958 / reduced-motion 959 | `ol-`, `#observer-link-screen`（`--ol-accent`, `--ol-received`） |
| 961–971 | RECEIVED RECORDS棚 | `shelf-rcv-`, `.wood-board-dark`, `#my-shelf-overlay` |
| 972–988 | PCヘッダー/ソートバーのOLボタン | `.observer-link-nav-btn`, `.ol-sort-btn` |
| 989–1015 | OL共有ダイアログ（ライトテーマ対応含む） | `ol-share-` |
| 1017–1031 | OLクイック送信ボタン（PC 1017–1026 / モバイルカード 1027–1031） | `.ol-quick-send-btn`, `.mc-card-ol` |

---

## 4. グローバル変数一覧（Chrome拡張参照リスク別）

### 前提: app.js の内部構造

| 範囲 | 内容 | スコープ |
|---|---|---|
| L1–1185 | i18n / フィルタ / レンダリング / 管理UI | 真のトップレベル（function/var は暗黙的に window に載る） |
| L1187–1994 | `(function(){...})()` — TURNTABLE INTRO + モバイル | IIFE内。windowに載らない（明示露出もゼロ） |
| L1999–3484 | `(function(){...})()` — MY SHELF + OBSERVER-LINK | IIFE内。**明示的 `window.xxx =` のみが外部露出** |

### A. window明示露出 24件（憲法8の直接対象）

すべて MY SHELF / OL の IIFE内から露出。**IIFE間通信にも使用されており、拡張以前にサイト自身が壊れるため削除絶対禁止。**

| 名前 | 行 | 種別 |
|---|---|---|
| `window.shelfOpenPanel` | 2226 | 関数（無名関数式） |
| `window.openShelf` | 2333 | 関数 |
| `window.toggleShelfPin` | 2369 | 関数 |
| `window.shelfPinHtml` | 2388 | 関数（HTML文字列生成） |
| `window._rcvSongs` | 2478 | 変数（配列データ）— `buildReceivedShelfUI()` 実行時に代入 |
| `window.shelfRcvTap` | 2481 | 関数 |
| `window.getMemberColor` | 2490 | 関数（内部関数への参照代入） |
| `window.drawVinylDisc` | 2491 | 関数（同上） |
| `window.addToShelf` | 2492 | 関数（同上） |
| `window.removeFromShelf` | 2493 | 関数（同上） |
| `window.isOnShelf` | 2494 | 関数（同上） |
| `window.getShelf` | 2495 | 関数（同上） |
| `window.openObserverLink` | 2705 | 関数（`olOpen` への参照代入） |
| `window.olClose` | 2716 | 関数 |
| `window.olClickYoutube` | 3273 | 関数 |
| `window.olShareResult` | 3288 | 関数 |
| `window.openShareDialog` | 3300 | 関数 |
| `window.closeShareDialog` | 3311 | 関数 |
| `window.olShareToDiscord` | 3316 | 関数 |
| `window.olCopyShareUrl` | 3324 | 関数 |
| `window.olTrackXShare` | 3332 | 関数 |
| `window.olResetCompose` | 3336 | 関数 |
| `window.olQuickSendHtml` | 3378 | 関数（HTML文字列生成） |
| `window.olQuickSend` | 3382 | 関数 |

### B. インラインハンドラ参照のトップレベル関数 11件（ES Modules化時に明示window露出への切替が必要）

現在は classic script の暗黙グローバルとして機能しているが、ES Modules化すると自動的に window に載らなくなるため、`window.xxx = xxx` への切替が必須。

| 関数名 | 用途 |
|---|---|
| `openPage` | index.html:200 の onclick |
| `closePage` | index.html:371 の onclick |
| `trackSongClick` | app.js生成カードテンプレ（L549, 573） |
| `trackExternalLink` | `spotifyBtn()`（L157）生成HTML |
| `edit` | app.js生成カードテンプレ（admin時のみ） |
| `del` | 同上 |
| `addInputTag` | app.js L737 生成HTML |
| `renderTagSuggest` | 同上 |
| `removeInputTag` | app.js L744 生成HTML |
| `linkSong` | app.js L944 生成HTML |
| `unlinkSong` | app.js L931 生成HTML |

### C. スクリプト間契約（不変）

| 名前 | 定義箇所 | 参照箇所 |
|---|---|---|
| `gtag` | index.html:22 インライン | app.js L70, L760 が `typeof gtag==='function'` で参照 |
| `window.dataLayer` | index.html:21 | GA4ライブラリが参照 |
| postMessage型 `VWP_SHELF_UPDATE` | app.js:2060 | Chrome拡張が受信 |
| postMessage型 `VWP_SHELF_REQUEST` | app.js:2065 （受信） | Chrome拡張が送信 |

### D. 要確認（暗黙グローバル 55件 + var 1件）

app.js トップレベルの `function` 宣言 55件と `var _searchGa4Timer`（L759）は、明示露出・インラインハンドラ参照はないが、Chrome拡張「VWP New Tab」が `Object.defineProperty` で監視している可能性がある。**ES Modules化の前に、拡張の content script が実際に監視しているプロパティ名リストを取得すること**（Section 11参照）。取得できない場合は55件全露出が最安全策。

<details>
<summary>55件の完全リスト</summary>

`t`, `mbr`, `applyI18n`, `showFetchError`, `_gtag`, `getStoredPw`, `storePw`, `loadAlbums`, `addAlbumApi`, `updateAlbumApi`, `deleteAlbumApi`, `albumThumb`, `loadVideos`, `addVideoApi`, `deleteVideoApi`, `updateVideoApi`, `ytId`, `thumb`, `fmtDate`, `parseTags`, `parseMembers`, `tTag`, `esc`, `safeUrl`, `tagPills`, `mbPill`, `spotifyBtn`, `seededRand`, `getTodayJST`, `getDailyPicks`, `getDailyPicksFromCache`, `filtered`, `allTagsOf`, `updateCounts`, `buildSidebar`, `buildMobFilters`, `showMb`, `renderGrid`, `renderList`, `renderTimeline`, `setupObserver`, `loadMoreItems`, `updateNewBadgeIds`, `render`, `renderTagChips`, `buildMemberSelect`, `refreshAlbumSelects`, `refreshImportAlbumSelect`, `getSelectedMembers`, `setSelectedMembers`, `openLinkSongModal`, `openEditAlbumModal`, `openAlbumModal`, `setAdminMode`, `verifyPw`

</details>

### script読み込み方式（変更不可の前提）

| ファイル | 方式 | 備考 |
|---|---|---|
| index.html:19 | gtag.js async、非module | — |
| index.html:20–25 | インライン、非module | gtag関数定義 |
| index.html:366 | `/app.js?v=1.7.0` defer、非module（classic script） | **type="module" は公開サイトに一切存在しない** |
| mobile-*.html | インライン、属性なし、非module | — |

---

## 5. 重複コード検出

### 5-1. メンバーカラー定義 — 7ファイル・約145箇所に散在（単一ソースなし）

正規値（CLAUDE.md準拠: all=#b0b8ff, vwp=#c4b5fd, kafu=#ffb7c5, rime=#7eb8f7, harusar=#ff7070, isekai=#d8d8d8, koko=#c084fc）のhexリテラル出現数（実測）:

| ファイル | 出現数 | 定義サイト数 |
|---|---|---|
| public/app.js | 40 | 定義オブジェクト4つ: ①1192–1197（TURNTABLE INTRO用 `mc:`）②1437–1443（`MW_MEMBERS` `color:`）③2069–2072（`MEMBER_COLORS` — 事実上の正規マップ）④2802–2807（OLピッカー用配列） |
| public/style.css | 49 | ほぼ全て行1: `.mpill[data-m=…]`×7、`.mb-*`×6、`.mob-chip[data-m=…].on`×6 の CSS側3系統 |
| public/index.html | 6 | 全て#c4b5fdのインラインstyle |
| public/mobile-cards.html | 14 | 443–449 `MEMBERS`配列 |
| public/mobile-shelf.html | 8 | 118 `MC`マップ / 119 `ML`ラベルマップ |
| public/mobile-welcome.html | 22 | メンバー配列+CSS（vwp_welcome_scurve.htmlに同一の22箇所） |
| public/admin.css | 6 | 30–31 `--c-vwp`等 — リポジトリ内で唯一CSS変数化されている |

**1メンバー追加に最低14箇所前後の修正が必要な状態。**

色ブレ検出（Phase 1での修正候補ではあるが、意図的調整の可能性があるため要確認）:
- isekaiの正規値 #d8d8d8 に対し、style.css行1では `.mpill[data-m="isekai"]`=**#f0f0f0**、`.mb-isekai`=**#e8e8e8**、`.mob-chip[data-m="isekai"].on`=**#e8e8e8**。暗背景での視認性調整の可能性あり。

### 5-2. Canvas レコード描画 — 本番1実装 + プロトタイプ同一コピー×2

- **app.js `drawVinylDisc()` L2082–2167** — 唯一の本番実装。PC SHELF詳細パネル（L2258–2259）とモバイルカードのLPピーク（L1763–1766、`window.drawVinylDisc`経由）の両方で共用。**本番コードは正しく1実装に統合済み**。
- **mobile-cards.html `drawLP()` L489–512** と **vwp_mobile_card_view.html `drawLP()` L488–511** — 同一コードのコピー同士。drawVinylDiscとの差分: グルーヴ間隔3px（本番3.5px）、レーベルがメンバー色塗り半径`r*.17`（本番はダーク#121420+メンバー色リング`c*.22`）。デッド候補ファイルのため削除で解消される。

### 5-3. YouTubeサムネイルURL組み立て — app.jsだけで14箇所が手組み

ヘルパー `thumb(v)`（app.js:144）が存在するのに、`'https://img.youtube.com/vi/'+vid+'/mqdefault.jpg'` の直書きが app.js 538, 784, 1728, 1925, 1951, 2209, 2253, 2462, 2750, 2884, 2960, 3168, 3206 に散在。他: admin.js:294（`default.jpg`と解像度も別）、mobile-shelf.html 151・172、mobile-cards.html 587、vwp_*ペアも同様。

### 5-4. その他の主要な重複

| 重複内容 | 箇所 | 備考 |
|---|---|---|
| videoID抽出 | app.js `ytId()`(L143) / `_extractVideoId()`(L2034–2045、URL API併用の堅牢版) / admin.js 292・710・735（3種の正規表現） | 4実装が混在 |
| `esc()` | app.js:152（正規表現置換・null安全）/ admin.js:44（DOM方式）/ mobile-cards.html:452（DOM）/ mobile-shelf.html:136（DOM） | 4実装 |
| `fmtDate` | app.js:145（`YYYY.MM.DD`）と admin.js:43（`YYYY/MM/DD`） | 出力形式が異なる（意図差の可能性） |
| API fetchラッパー | app.js L106–141: addAlbumApi/updateAlbumApi/deleteAlbumApi/addVideoApi/deleteVideoApi/updateVideoApi がほぼ同型 | updateAlbumApiのみ `await res.text()` でエラー処理が非統一 |
| カードHTMLテンプレート | renderGrid/renderList/renderTimeline（L546–582）と loadMoreItems（L593–651）がほぼ同一文字列で二重保持 | 前者はデッド候補 |
| OLパーティクル実装 | `olSendingParticles`（L2894–2953）と `olParticles`（L3093–3161）がinit/resize/animate/destroyの骨格が同型 | 挙動は異なる（浮遊dot vs バーストのため統合は慎重に） |

---

## 6. デッドコード候補

### 6-1. モバイルHTML 6ファイル — リポジトリ全体で参照ゼロ

根拠: netlify.tomlリダイレクトなし / index.html・app.jsからの遷移なし / 6ファイル間の相互リンクもなし。docs/*.mdからの参照は「履歴文書」として残るのみ。実際に配信されるページは index.html（`/`）と admin.html（`/admin`）の2枚のみ。

| ファイル | 性質 | 削除優先度 |
|---|---|---|
| vwp_mobile_card_view.html | プロトタイプ原本。mobile-cards.htmlにXSS修正が入った後の脆弱版が直URLで配信可能な状態 | 高（セキュリティリスク） |
| vwp_mobile_shelf.html | 同上。XSS修正前の脆弱版 | 高（セキュリティリスク） |
| vwp_welcome_scurve.html | mobile-welcome.htmlとバイト単位で完全同一。冗長コピー | 高 |
| mobile-cards.html | S字UI・カードビューはapp.js(L1422–1992)に統合済み。ハードコードのサンプルデータあり（本番データ未接続） | 中 |
| mobile-shelf.html | モバイル棚はapp.jsに統合済み | 中 |
| mobile-welcome.html | S字ウェルカムはapp.jsに統合済み | 中 |

削除する場合: netlify.tomlで旧URLを `/` にリダイレクトすること（直URLブックマーク・外部共有の対応）。

### 6-2. app.js `renderGrid` / `renderList` / `renderTimeline`（L546–582）

根拠: 呼び出し箇所ゼロ（`renderGrid`はL2387のコメント内言及のみ）。`render()` → `loadMoreItems()` がIntersectionObserverページングで置き換えた際の残骸。純関数・副作用なしのため削除リスクは低いが、残存するとテンプレート二重管理の事故リスクになる。

### 6-3. style.css `.frow` / `.frow .fg`（行1内）

根拠: index.html / app.js / admin.* に `frow` の出現ゼロ。フォーム行レイアウトの残骸と推定。style.cssの未使用セレクタはこの1件のみ（他の349クラス・全IDセレクタは参照確認済み）。

---

## 7. マジックナンバー・定数散在

### app.js

| 値 | 意味 | 行番号 |
|---|---|---|
| `PAGE_SIZE=30` | 無限スクロール1ページ件数（定数化済） | 65 |
| `5*60*1000` / `2*60*1000` | videos/albumsキャッシュTTL | 98, 99 |
| `5000` | fetchエラートースト表示時間ms | 60 |
| `1664525`, `1013904223` | LCG乱数係数（今日の観測シード） | 167 |
| `.022` | カードアニメ遅延係数（**6箇所重複**） | 549, 561, 573, 604, 613, 635 |
| `'200px'` | IntersectionObserver rootMargin | 589 |
| `slice(0,2)` | NEWバッジ = メンバー別新着2件 | 659 |
| `3` | メンバー複数選択の上限（**4箇所以上に即値**） | 241, 274, 280, 298, 475, 480, 491 |
| `2.2` | アルバムグループ開閉の1行あたりrem | 384, 419 |
| `500` | 検索GA4デバウンスms | 760 |
| `560` / `150`, `200` / `0.4` | イントロ基準サイズ / 予約高さ / 最小スケール | 1213, 1218, 1220 |
| `230`, `182`, `96`, `110`, `218`, `280`, `55` | ターンテーブル・LP寸法群 | 1227–1229, 1253–1254, 1260 |
| `250/350/900` | イントロ演出タイミングms | 1303, 1326–1344 |
| `600`, `550ms`(css文字列) | 黒幕フェード | 1355, 1363, 1388, 1410, 1412 |
| `700` | モバイル判定ブレークポイント（CSSと二重管理） | 1424, 1623 |
| `MW_CENTER=110` 等5定数 | S字ホイールレイアウト（定数化済） | 1446 |
| `0.88` / `0.7` / `0.005` / `0.01` | 慣性減衰・停止閾値 | 1583–1587 |
| `800` | mwトランジションms | 1603, 1618 |
| `15` | タップ/ドラッグ判定閾値px | 1761 |
| `70` | カードスワイプ確定閾値px | 1814 |
| `/800`, `/400`, `-0.02` | ドラッグ中scale/opacity/rotate係数 | 1805–1806 |
| `300` | スワイプアウト後の待機ms | 1822 |
| `80` | モバイル棚スクロールsnapデバウンスms | 1967 |
| `'/ 10'` | モバイル棚上限表示の即値（SHELF_MAX非参照） | 1919, 1921 |
| `ROW_SIZE=5` | 棚1段の枚数（**2箇所に重複定義**） | 2192, 2445 |
| tilts配列10要素 | ジャケット傾き（2箇所で別値） | 2194, 2447 |
| `0.55` | drawVinylDisc globalAlpha（ベース色） | 2097 |
| `0.45`, `3.5`, `0.6`, `0.22`, `0.3`, `0.16`, `0.06`, `0.03` | ビニール描画の透過・溝間隔・半径比群 | 2104, 2108, 2112, 2127, 2133–2156 |
| `200`, `0.18`, `0.5` | 詳細パネルのジャケット最大px・幅比・スライド比 | 2244, 2246 |
| `120/300/320` | パネル演出タイミングms | 2292–2297, 2314 |
| `OL_DAILY_LIMIT=10` | OL日次上限（定数化済、エラーメッセージ内 `'(10/day)'` `'(10/10)'` は即値: L3016, 3414） | 2501 |
| `'/20'`, `20` | OLメッセージ文字数上限（**3箇所**） | 2531, 2685, 3348 |
| `2` | ムードタグ上限 | 2733 |
| `0.016` | OLヒーローCanvasの時間増分 | 2656 |
| `40` / `60` / `30`, `0.15` | 送信パーティクル数 / バースト数 / 常時上限・出現率 | 2904, 3130, 3136 |
| `1400` | 結果バースト遅延ms | 3105 |
| `1300` / `800` | マッチ演出→結果遷移ms（**2箇所重複**） | 3066, 3468–3469 |
| `2200` | OLトーストms | 3372 |
| `10` | 受信レコード保存上限（SHELF_MAXと別に即値） | 3362 |

### style.css

| 値 | 意味 | 行番号 |
|---|---|---|
| `700px` | モバイルブレークポイント（**10箇所以上**） | 1（2箇所）, 33, 46, 90, 104, 120, 149, 170, 191, 581, 936 |
| `390px` / `400px` / `380px` | 狭幅端末の追加分岐 | 64, 74, 951 |
| `54px` | ヘッダー高（sticky top等で連鎖） | 1（複数） |
| `z-index: 90/100/200/300/500/9999/10000/10100/99999` | 層管理が散在（JS内toastの9999含む: app.js L54, 1355） | 1, 274, 905, 932, 990 |
| `144px`, `72px`, `40%` | モバイル棚ジャケット寸法・スライド | 713–715, 724, 684 |
| `max-height:400px` / `240px` / `70vh` | パネル展開上限 | 419, 722, 907 |
| `430px` | OLアプリ最大幅 | 752, 755 |

### 定数散在の構造的問題（メンバー定義）

JSだけで11箇所超にメンバー定義が散在:

| 箇所 | 行 | 内容 |
|---|---|---|
| `MEMBERS` | 26–29 | id+emoji |
| `MBR_CLS` | 30 | CSSクラスマップ |
| `I18N.*.mbr` | 3, 6, 9, 12 | 表示名×4言語 |
| `DAILY_MEMBERS` | 161 | ソロ5人 |
| `updateNewBadgeIds`内配列 | 654 | 6メンバー列挙 |
| `VWP_MEMBERS`（重複） | 873, 908 | **同名ローカル定数が2箇所に重複定義** |
| intro `MEMBERS`（シャドーイング） | 1190–1198 | id+icon+img+ja/en+色+グロー+回転速度 |
| `MW_MEMBERS` | 1436–1444 | id+label+img+色+グロー |
| `MEMBER_COLORS` | 2069–2072 | 色マップ（正: 憲法のカラー表と一致） |
| `OL_MEMBER_DISPLAY` | 2503 | 英語表示名 |
| OLピッカー `members` 配列 | 2801–2808 | id+label+色 |

### SHELF上限「10」の5系統

| 箇所 | 値 | 形式 |
|---|---|---|
| `SHELF_MAX=10`（L2001） | 棚最大枚数 | 定数（正） |
| モバイル棚表示 `'/ 10'`（L1919, 1921） | 同上（mobile IIFEからSHELF_MAXが見えないため即値） | 直書き |
| I18N文言「10曲まで」（L4, 7, 10, 13） | 同上 | i18n文字列内 |
| OL受信保存上限 `10`（L3362） | 受信レコード上限（意味が異なる） | 直書き |
| `OL_DAILY_LIMIT=10`（L2501） + エラー文言（L3016, 3414） | OL日次送信上限（意味が異なる） | 一部即値 |

---

## 8. Netlify Functions 横断監査

全16ファイルとも `exports.handler` のCommonJS形式。Supabaseアクセスは全ファイルとも `@supabase/supabase-js` 不使用で、PostgREST REST APIへの生 `fetch`。

### 8-1. Supabase初期化: キー選択が3変種

| 変種 | キー | 該当（ファイル:行） |
|---|---|---|
| A: SECRET_KEYのみ | `SUPABASE_SECRET_KEY` | admin-query.js:30–31, albums-add.js:13–14, albums-delete.js:13–14, albums-update.js:15–16, ingest-youtube.js:120–121, playlist-import.js:16–17, videos-add.js:17–18, videos-delete.js:24–25, videos-update.js:16–17（9ファイル） |
| B: anon優先 | `SUPABASE_ANON_KEY \|\| SUPABASE_SECRET_KEY` | albums-get.js:5, videos-get.js:5（公開読み取り系） |
| C: service_role優先 | `SUPABASE_SERVICE_ROLE_KEY \|\| SUPABASE_SECRET_KEY` | observer-link-exchange.js:66, observer-link-result.js:24 |

- `{apikey, Authorization: Bearer}` ヘッダ組み立ては上記13ファイルでインライン重複（Content-Type/Preferの有無が場所ごとに揺れる）
- env欠落チェックあり: admin-query.js:32, albums-update.js:17, ingest-youtube.js:125–127, videos-add.js:20–22, videos-update.js:18–20 / チェックなし: 残り11ファイル
- `sbFetch`（非OKでthrowするラッパー）がほぼ同一実装で2重複: ingest-youtube.js:109–116（slice 300）/ observer-link-exchange.js:25–32（slice 200）

### 8-2. 42703リトライ付き videos取得: 3変種で重複

| 変種 | ファイル | 挙動差 |
|---|---|---|
| `sbFetchVideos` | observer-link-exchange.js:38–48 | 失敗時throw |
| `fetchVideoRows` | observer-link-result.js:6–14 | パース失敗時null返し |
| `fetchPage` | videos-get.js:12–29 | ページング内蔵+throw |

**共通化時は throw vs null の挙動差に要注意。**

### 8-3. CORS / エラーレスポンス

| パターン | 内容 | 該当 |
|---|---|---|
| P1: ワイルドカード + OPTIONS 204 | `Access-Control-Allow-Origin: *` | admin-auth.js:9–18, admin-query.js:15–23 |
| P2: 固定オリジン + OPTIONS 204 | `ALLOWED_ORIGIN='https://vwp-archive.netlify.app'` | observer-link-exchange.js:5,7–16,51–60 |
| P3: CORSヘッダなし（同一オリジン前提） | 素の `{statusCode, body}` | 残り13ファイル |

- P1内でもAllow-Headersが `Content-Type`（admin-auth:11）と `Content-Type, Authorization`（admin-query:17）で不一致
- 405ガード: 平文body `'Method Not Allowed'` が10ファイル、JSON形式が3ファイル
- `JSON.parse` → 400 `Invalid JSON` ガードがほぼ同文で8ファイル重複
- **catch→500のエラー形式が3系統: `{error: e.message}`（大半）/ `{ok:false, msg}`（admin-auth）/ `{success:false, error:'コード'}`（exchange）**。Phase 3でエラー形式を統一するとフロント側が壊れるため「入出力不変」の検証必須

### 8-4. 認証チェック: 4方式が併存

| 方式 | 実装 | 該当 |
|---|---|---|
| A: body平文password照合 | `password !== process.env.ADMIN_PASSWORD` | albums-add.js:8, albums-delete.js:8, albums-update.js:6, auth-check.js:10, playlist-import.js:9, videos-add.js:13, videos-delete.js:16, videos-update.js:10（8ファイル） |
| B: SHA-256セッショントークン | 発行=admin-auth.js:39–41 / 検証=admin-query.js:26–28 | 2ファイル |
| C: Bearer平文ADMIN_PASSWORD | header照合 + スケジュール起動判定 | ingest-youtube.js:133–144 |
| D: x-admin-keyヘッダ平文 | レート制限バイパス用 | observer-link-exchange.js:91–92 |

方式Bのトークンは `sha256(ADMIN_PASSWORD)` の固定値（ソルト・有効期限なし）。

### 8-5. YouTube API呼び出し重複

- 単発動画メタ取得（videos.list）が2重複: youtube.js:20–22 と admin-query.js:91–93。サムネ優先順位が異なる（youtube.js: medium→default / admin-query.js: maxres→high→default）
- playlistItemsページングループが3変種: playlist-import.js:22–30（上限200件キャップ、seen Set適用済）/ **admin-query.js:113–135（キャップなし・seen Setなし・旧ロジックの生き残り）** / ingest-youtube.js:207–209（1ページ50件、意図的）
- `ytId()` が文字単位で同一: ingest-youtube.js:45 と playlist-import.js:2。observer-link-result.js:482–486 の `extractYtId` は別実装（緩い正規表現）

### 8-6. .range / LIMIT 監査結果

#### 憲法5違反（全件fetch意図なのに件数上限未指定）

| 箇所 | 内容 |
|---|---|
| **admin-query.js:138** | `videos?select=url`（playlist-import action内の既存URL突合用）。limit/offset未指定→デフォルトLIMIT 1000。**videosは現在1,286件のため約286件がsilent dropし、既存曲を重複INSERTし得る**。playlist-import.js:34では同型バグを修正済み（limit=10000+上限ガード）だが、admin-query.js内のコピーには未適用。憲法5違反の実害あり。 |

準違反（呼び出し側依存）:
- **admin-query.js:43–48**（汎用query action）— limitはクライアント任せでサーバ側強制なし。現状 admin.js はlimit:'9999'を明示しており実害なしだが、呼び出し側がlimitを省略すると1000件でsilent dropする構造

#### 上限指定済み（全件fetch意図）

| 箇所 | 内容 |
|---|---|
| ingest-youtube.js:169 | `videos?select=url&limit=10000&offset=0` + 10000到達時の中止ガード（L172–175） |
| playlist-import.js:34 | `videos?select=id,url&limit=10000&offset=0` + 中止ガード（L39–41） |
| videos-get.js:36–42 | `limit=1000&offset=` のwhileループで正攻法のページング |
| observer-link-exchange.js:138 | song_bottles waiting候補 `limit=50`（意図的サンプリング） |
| observer-link-exchange.js:211 | published videos `limit=50`（フォールバック候補、意図的。order未指定のため常に同じ先頭50件からの抽選になりランダム性が偏る点は観察事項として記録） |

### 8-7. published フィルタ監査結果

#### 公開系Function（フィルタ必須）— 全て適合

| 箇所 | クエリ | 判定 |
|---|---|---|
| videos-get.js:37 | `status=eq.published&order=date.desc` | 適合（42703時のみフィルタ外し再試行 — migration適用済みの現在は発動しない設計コメントあり） |
| observer-link-exchange.js:109 | 送信video検証 `id=eq.X&status=eq.published` | 適合 |
| observer-link-exchange.js:173 | matched受信video `status=eq.published` | 適合 |
| observer-link-exchange.js:211 | フォールバック候補 `status=eq.published` | 適合 |
| observer-link-result.js:49 / :66 / :76 | sent/received/fallback video、いずれも `status=eq.published` | 適合（非publishedはカード非表示にフェイルセーフ） |

song_bottles自体はstatus不問で読むが、videos情報は必ずpublishedフィルタ経由のためpending楽曲のタイトル等は漏洩しない。

---

## 9. Phase 2 モジュール分割提案（依存方向つき）

### 9-1. 依存方向図

```
[i18n/constants]
      |
      v
   [utils]
      |
      v
    [core]
    /  |  \
   /   |   \
[intro][shelf][mobile]
   \   |   /
    \  |  /
    [OL(observer-link)]
         |
         v
      [main]
        ↑
  [ingest-queue] (admin専用)
```

ルール: **上位から下位への参照のみ許可。逆方向・横方向の参照は循環依存となるため禁止。**

ただし `intro` → `shelf` および `mobile` → `shelf` は現在 **window.* 経由の実行時参照** であり、Phase 2 でも同様にwindow経由を維持することで循環禁止を守る。

### 9-2. JS モジュール分割案（各モジュールと対応行範囲）

| モジュール | 対応ブロック | app.js行範囲 | 主な責務 |
|---|---|---|---|
| `js/constants.js` | i18n + core先頭 + shelf定数 | L1–14, 26–30, 63–67, 160–162, 2000–2002, 2500–2502 | I18N辞書、MEMBERS、MBR_CLS、PAGE_SIZE、SHELF_MAX、OL_DAILY_LIMIT、localStorage/sessionStorageキー定数、メンバーカラー（散在を一元化） |
| `js/supabase.js` | core中のAPI関数 | L93–141 | Supabase fetch ラッパー、loadAlbums、loadVideos、全CRUDのApiXxx関数 |
| `js/i18n.js` | i18nブロック | L15–24, 150 | `lang`, `t()`, `mbr()`, `tTag()`, `applyI18n()` |
| `js/vinyl.js` | shelf Canvas描画 | L2082–2166 | `drawVinylDisc()` — window露出維持必須（mobile IIFEがwindow経由で呼ぶ） |
| `js/core.js` | core全体 | L26–1185（constants/supabase/i18nから移転した部分を除く） | `render()`, `buildSidebar()`, `loadMoreItems()`, フィルタ系、モーダル群、管理者認証、デイリーピック、ブートストラップ |
| `js/intro.js` | IIFE L1186–1421 | L1186–1421 | ターンテーブル演出、LP配置・選択、入場処理（モバイルIIFEを内包しているため単純な行切り出しでは分割不可能：詳細は9-3参照） |
| `js/mobile.js` | ネストIIFE L1422–1992 | L1422–1992 | S字ホイール（mw*）、モバイルカードビュー（mc*）、モバイル棚（ms*） — intro IIFEの**内側**にネストしているため、intro.jsからの分離には構造的なリファクタが必要 |
| `js/shelf.js` | MY SHELF IIFE L1996–2495 | L1996–2495 | 棚localStorage、Chrome拡張postMessage、UI構築、詳細パネル、受信レコード棚、window露出群（L2490–2495） |
| `js/observer-link.js` | OL部分 L2497–3482 | L2497–3482 | OL全体 — shelf IIFEの**内側**にネストしているため、shelf.jsからの分離には構造的なリファクタが必要（詳細は9-3参照） |
| `js/ingest-queue.js` | （PR-A1で追加予定） | — | Admin「INCOMING TRANSMISSION」キュー（柱A完了後に整理対象） |
| `js/main.js` | エントリポイント | — | 各モジュールimport、DOMContentLoaded起点 |

CSS分割（物理移動のみ、セレクタ・宣言は1文字も変えない）:

| ファイル | style.css行範囲 | 備考 |
|---|---|---|
| `css/base.css` | L1（展開後の基本スタイル部分）, L2–38 | style.css L1 の巨大1行を展開する前処理が必要 |
| `css/layout.css` | L40–218（MOBILE OPTIMIZATION） | — |
| `css/shelf.css` | L220–599, L961–971 | MY SHELF + RECEIVED RECORDS |
| `css/observer-link.css` | L748–959, L972–988, L989–1031 | OL全体 + OLナビボタン + 共有ダイアログ + クイック送信 |
| `css/mobile.css` | L601–741, L743–746 | S-CURVE + MOBILE CARD VIEW + MOBILE SHELF + reduced-motion |

読み込み順は現カスケード順を厳守。

### 9-3. 重要な設計上の発見（Phase 2着手前に必ず読むこと）

**発見1: mobile は intro IIFE の内側にネストしている**

app.js L1422–1992 の mobile コードは、intro IIFE（L1186–1994）の内側に存在するネストIIFEである。行範囲を単純に切り出して `mobile.js` を作るだけでは分割できない。intro IIFE の閉じる `})()` が L1994 にあるため、mobile を独立させるには intro IIFE を解体（通常の関数化）する必要がある。

実装方針: Phase 2では intro IIFE を通常の async function / モジュール関数に書き換え、mobile の初期化を intro 初期化後に呼び出す形に変換する。

**発見2: observer-link（OL）は shelf IIFE の内側にネストしている**

app.js L2497–3482 の OL コードは、MY SHELF IIFE（L1996–3484）の内側に存在する。OL は shelf の `getShelf()` / `getMemberColor()` を直接参照しており（同一IIFE内のため window 経由不要）、分割後は `import { getShelf, getMemberColor } from './shelf.js'` による明示インポートへの切替が必要。

**発見3: IIFE間通信が window 経由（8関数）— モジュール化後も維持必須**

mobile IIFE が shelf の関数を呼ぶ経路は全て `window.*` 経由（`window.drawVinylDisc`, `window.getMemberColor`, `window.isOnShelf`, `window.addToShelf`, `window.removeFromShelf`, `window.getShelf`, `window.olQuickSend`）。Phase 2 で ES Modules に移行しても、この 8 関数の window 露出は **Chrome拡張連携の観点から維持が必須**（CLAUDE.md条件8）。

モジュール化後の実装パターン:
```javascript
// shelf.js（モジュール）
export { getShelf, getMemberColor, ... }; // ES Module export
window.getShelf = getShelf;              // window露出も維持（拡張・app内部向け）
window.drawVinylDisc = drawVinylDisc;
// ...
```

**発見4: インラインハンドラ参照の 11 関数は ES Modules 化時に明示的 window 露出への切替が必要**

Section 4-B の 11 関数は現在 classic script の暗黙グローバルとして動いているが、ES Modules では自動的に window に載らない。`core.js` でこれらを定義した後、`window.openPage = openPage; window.del = del; ...` と明示露出する処理を追加すること。

**発見5: 「要確認」55 関数の扱い**

Section 4-D の 55 関数が Chrome 拡張に監視されているかを事前に確認せずに ES Modules 化すると、拡張が静かに壊れる可能性がある。Section 11-(b) に記載の通り、Chrome 拡張「VWP New Tab」の content script が `Object.defineProperty` を張っている実際のプロパティ名リストを Yuki に提供してもらい、それに応じた露出設計を行うこと。リスト取得できない場合は 55 件全件を `window.xxx = xxx` で露出するのが最安全策（現状と同等）。

**発見6: style.css L1 が1行のため CSS 分割には展開前処理が必要**

L1 に基本スタイルの大半が連結されているため、CSS ファイル分割（Phase 2）の前に L1 を展開して人間が読める形式に整形する前作業が必要。この前処理自体は「セレクタ・宣言を1文字も変えない」に反しないが、整形前後の動作確認（computed style サンプリング）を必ず実施すること。

---

## 10. リスク評価

### Phase 1（無リスク整理）

| リスク | 詳細 | 深刻度 | 緩和策 |
|---|---|---|---|
| デッドコード削除で外部参照が残存 | vwp_* 3ファイルは docs/*.md から参照あり（履歴文書のみ）。モバイル3ファイルの外部URL共有は否定できない | 低 | netlify.tomlで削除URLを `/` にリダイレクト追加 |
| メンバー定数一元化でisekai色ブレを正規値に統一 | style.css行1の#f0f0f0/#e8e8e8が意図的調整の可能性 | 低 | Section 11-(d) の確認依頼 |
| renderGrid/renderList/renderTimeline削除時の見落とし | 定義のみで呼び出しなしを確認済み（呼び出しはすべてloadMoreItems経由） | 低 | 削除後にgrep `renderGrid\|renderList\|renderTimeline` で確認 |

### Phase 2（モジュール分割）

| リスク | 詳細 | 深刻度 | 緩和策 |
|---|---|---|---|
| window露出消失でChrome拡張が静かに死ぬ | 明示露出24件 + 暗黙グローバル55件（要確認）がES Modules化で露出消失する可能性 | 最高 | Section 4の一覧で全件照合、window.xxx = xxx を明示維持（Section 11-(b)参照） |
| intro IIFE解体時の演出タイミング崩壊 | L1186–1994のIIFE解体でクロージャ変数・実行タイミングが変わる可能性 | 高 | デスクトップ・モバイル両方でイントロ演出を目視確認 |
| OL → shelf 依存の切替ミス | 現在は同一IIFEで直接参照しているものをimport経由に切替 | 高 | `getShelf/getMemberColor` の呼び出し箇所を全件grep確認 |
| style.css L1 展開で計算値崩壊 | 展開整形でセレクタ・値の転記ミスが起きうる | 中 | 展開前後で `computed style` の完全一致サンプリング（最低20要素） |
| `!important` 多用のカスケード依存破壊 | style.css L40–218のMOBILE OPTIMIZATIONが読み込み順に依存 | 中 | CSS分割後も現行の読み込み順を厳守、devtoolsで上書き確認 |

### Phase 3（Functions共通化）

| リスク | 詳細 | 深刻度 | 緩和策 |
|---|---|---|---|
| エラーJSON形式の統一でフロント壊れる | 3系統のエラー形式（Section 8-3）、統一するとフロントのif分岐が誤動作 | 高 | フロント側エラー処理箇所を全列挙し、入出力不変を事前検証 |
| OL exchange フォールバック永続化ロジック破壊 | `guard_waiting_pool` トリガーとの整合（CLAUDE.md条件6） | 最高 | exchange Functionは最終行までロジックを変えない。shared化はヘッダ・初期化部分のみ |
| 42703リトライのthrow/null挙動差 | Section 8-2の3変種を共通化すると挙動が変わる | 中 | 共通化後も呼び出し元ごとの挙動差を保つラッパー設計 |
| youtube.js の無認証エンドポイント | 現在認証なしでクォータ消費。Phase 3で認証追加を検討しても入出力不変を確認 | 低 | 追加する場合はAdmin UIの呼び出し側も同時修正 |

---

## 11. Yukiへの承認依頼事項（Phase 1着手前に判断が必要なもの）

### (a) デッドコード削除の承認

削除候補ファイル・コードについてYukiの承認をお願いします。

**削除候補1: vwp_* 3ファイル（強く推奨）**
- `public/vwp_welcome_scurve.html` — mobile-welcome.htmlとバイト完全同一のコピー
- `public/vwp_mobile_card_view.html` — XSS修正前の脆弱版（`esc()` 未適用）が直URLで配信されている
- `public/vwp_mobile_shelf.html` — 同上

これら3ファイルはプロトタイプ原本であり、本番機能はすべてapp.jsに統合済みです。特に vwp_mobile_card_view.html と vwp_mobile_shelf.html は**セキュリティリスク**のある状態で、外部から直URLでアクセスできます。

**削除候補2: mobile-* 3ファイル（判断が必要）**
- `public/mobile-cards.html`
- `public/mobile-shelf.html`
- `public/mobile-welcome.html`

本番機能はapp.jsに統合済みで未参照ですが、過去に外部共有されたURLがある可能性があります。削除する場合はnetlify.tomlでリダイレクトを追加します。

**削除候補3: app.js内の関数**
- `renderGrid()`（L546–557）、`renderList()`（L558–566）、`renderTimeline()`（L567–582） — 呼び出しゼロのデッドコード

**削除候補4: style.css の未使用セレクタ**
- `.frow` / `.frow .fg`（行1内） — index.html / app.js に参照ゼロ

### (b) Chrome拡張「VWP New Tab」の監視プロパティリスト提供

ES Modules化（Phase 2）の安全な実施のために、Chrome拡張「VWP New Tab」の content script が `Object.defineProperty` で監視している実際のプロパティ名リストを教えてください。

**リストが取得できない場合**は、暗黙グローバルの全55件（Section 4-D参照）を `window.xxx = xxx` で明示露出する形にします（現状と同等のリスク水準で最安全）。

### (c) admin-query.js:138 の憲法5違反を別PRで先行修正するか

**この問題は現時点で実害があります（優先度: 高）。**

admin-query.jsのL138 `videos?select=url` にlimit/offset未指定のため、デフォルトLIMIT 1000が適用されています。videosは現在1,286件あるため約286件がsilent dropし、それらの曲がプレイリストインポート時に重複INSERTされ得ます（adminクエリ経由のINSERTはstatus='published'が即座に設定されます）。

選択肢:
- 選択肢A: 本レポート（PR-B0）と同時に修正する1行hotfix PRを別途作成する
- 選択肢B: Phase 1（PR-B1）の冒頭で修正する
- 選択肢C: 現状維持（プレイリストインポート画面から admin-query.js の分岐は使われていない場合）

どの選択肢を取るかを指示してください。

### (d) isekai の色ブレの意図確認

style.css行1では isekai のCSS値が正規値（#d8d8d8）と異なります:
- `.mpill[data-m="isekai"]` → #f0f0f0
- `.mb-isekai` → #e8e8e8
- `.mob-chip[data-m="isekai"].on` → #e8e8e8

暗背景での視認性向上のための意図的な調整でしょうか? Phase 1のカラー一元化でこのブレを維持する（正規値以外を使う）か、正規値（#d8d8d8）に統一するかを確認させてください。

---

## 12. 判断保留リスト

### フロントエンド系

| 項目 | 保留理由 |
|---|---|
| mobile-*.htmlの削除 | 過去の外部URL共有の可能性が否定できない。Yukiの判断待ち（Section 11-(a)） |
| isekai色ブレ（#f0f0f0/#e8e8e8 vs #d8d8d8） | 意図的な視認性調整の可能性あり。Yukiのデザイン確認待ち（Section 11-(d)） |
| `fmtDate` の2実装統合 | app.js（YYYY.MM.DD）とadmin.js（YYYY/MM/DD）は出力形式が異なる。admin側はMU-TH-UR世界観で独立している設計方針のため統合対象外が妥当かは要判断 |
| `admin.css` の `--c-*` 変数 | adminは意図的に独立した世界観のため、フロントendの共通定数と統合するかは要判断 |
| `olSendingParticles` / `olParticles` の統合 | 骨格は同型だが挙動（浮遊 vs バースト+重力）が異なる。統合の費用対効果は低め |
| style.css L1 の展開整形タイミング | Phase 2の前処理として行うが、展開そのものがデグレリスクのため単独PRとするか Phase 2 に含めるかは要判断 |
| Chrome拡張「VWP New Tab」の監視プロパティ未確定 | Section 11-(b)として確認依頼済み。回答前にPhase 2は着手しない |
| `tilts`配列が2箇所で別値（L2194 vs L2447） | PC棚とモバイル棚で傾きが異なる。意図差か実装漏れかは要確認 |

### Functions系

| 項目 | 保留理由 |
|---|---|
| エラーJSON形式3系統の統一可否 | フロント側の `if(d.error)` / `if(!d.ok)` / `if(!d.success)` 分岐と連動するため、フロント側含む入出力不変の事前検証が必要 |
| youtube.jsの無認証エンドポイント | Phase 3で認証追加するかは運用状況を見てから判断。現状クォータへの実害なし |
| admin-query.jsのplaylist-import actionとplaylist-import.jsの統合 | 同型ロジックの重複だが、admin-query.js側はUIの「プレイリストインポート」ボタンが現在使われているかを確認した上で統合判断 |
| observer-link-exchange.jsのL211 order未指定（フォールバック先頭50件偏り） | 動作はしているが、フォールバック候補のランダム性に偏りがある。修正はexchange Functionの変更であり慎重に（CLAUDE.md条件6） |
| 42703リトライの共通化後の挙動差維持 | throw vs null の挙動差を保つかどうかはPhase 3の設計判断 |
