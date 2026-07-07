# V.W.P ARCHIVE — 統合プロジェクト仕様書

> 最終更新: 2026/04/03
> 作成者: Yuki Kakinuma + Claude (設計パートナー)
> 統合元: プロジェクト仕様書(03/22), MY SHELF変更仕様書(03/25), mobile_ui_spec(03/26), observer_link_spec(04/02), quick_send(04/03)

---

## 1. サイト概要

### 基本情報
- **サイト名**: V.W.P ARCHIVE（非公式）
- **URL**: https://vwp-archive.netlify.app
- **リポジトリ**: https://github.com/NINJA2019/vwp-archive
- **用途**: KAMITSUBAKI STUDIO所属のバーチャルアーティストグループV.W.P（花譜・理芽・春猿火・ヰ世界情緒・幸祜）の楽曲アーカイブ
- **収録規模**: 1,256曲以上（2026年3月時点）
- **収益**: なし（個人ファンサイト）
- **ガイドライン準拠**: KAMITSUBAKI STUDIO二次創作ガイドラインに基づく

### 技術スタック
- **フロントエンド**: Vanilla HTML/CSS/JS（フレームワークなし）
- **ホスティング**: Netlify（静的サイト + Functions）
- **データベース**: Supabase（PostgreSQL）
- **API**: Netlify Functions（videos-get, playlist-import, albums-update, observer-link-exchange, observer-link-result 等）
- **構成ファイル**: index.html, app.js, style.css
- **外部フォント**: Cinzel, Shippori Mincho, Noto Sans JP, Barlow Condensed
- **アナリティクス**: GA4 (G-9FTCYNJCHN)

---

## 2. 設計思想

### コアコンセプト: 「CDジャケットを探すような体験」
- 一般的な音楽データベース（VocaDB、TuneFind等）が「情報検索ツール」であるのに対し、vwp-archiveは「ブラウジング体験」を提供する
- CDショップで棚を眺める、レコード屋でジャケットを手に取る感覚のデジタル版
- **意図的な不便さ**: 検索の即時性よりも、偶然の発見（セレンディピティ）を重視
- 効率最大化ではなく「体験の質」を測る設計

### KPIの設計思想
- 「検索→到達の速さ」ではなく「滞在中にどれだけ探索したか」が成功指標
- 一般的なECやSaaSとはファネルの意味が異なる

### 3つの意図レイヤー
1. **探索（Discovery）**: 「何があるか見たい」— ランディング → member_filter → スクロール
2. **消費（Consumption）**: 「特定の曲を聴きたい」— song_click → YouTube遷移
3. **回遊（Exploration）**: 「もっと深く知りたい」— album_open → 別メンバーフィルター切替 → セッション内複数アクション

---

## 3. 共通データ定義

### データ構造（Supabase videos テーブル）
```
id, member (スペース区切り: "kafu rime"), title, url, date, tags (スペース区切り: "シングル アニメ"),
note, spotify_url, album_id,
status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','pending','rejected')),
content_type TEXT NOT NULL DEFAULT 'song' CHECK (content_type IN ('song','live','shorts','announcement')),
source TEXT DEFAULT 'manual',
ingested_at TIMESTAMPTZ
```

**status フィールドの運用ルール:**
- `published`: 公開。公開系videos取得クエリでのみ返却される（`status=eq.published` フィルタ必須）
- `pending`: 自動取り込み後の審査待ち。Admin INCOMINGキューで確認・PUBLISH/REJECT操作を行う
- `rejected`: 不採用。DBには残すが公開しない
- **自動publishは永久にしない（絶対条件10番）**: ingest-youtubeは常に`pending`でINSERTする

**content_type フィールド（ingest-youtubeによる自動分類）:**
- `shorts`: duration ≤ 60秒 または #shorts タグ
- `live`: liveStreamingDetails あり または ライブ系キーワード（ワンマン/ライブ映像/LIVE/不可解/現象/狂想）
- `announcement`: 告知系キーワード（告知/トレーラー/Teaser/XFD/クロスフェード/予告/開催決定/発売決定/情報解禁）
- `song`: 上記に該当しないもの（デフォルト）

**ingest_channels テーブル（PR-A1で新規追加）:**
```
id SERIAL PK, member_id TEXT, channel_id TEXT UNIQUE,
uploads_playlist_id TEXT, enabled BOOLEAN DEFAULT true,
last_checked_at TIMESTAMPTZ, last_video_published_at TIMESTAMPTZ
```
Yukiがチャンネル行を手動INSERTして有効化する。

### メンバー定義
| ID | 表示名 | Emoji | カラー | LP盤の見え方 |
|---|---|---|---|---|
| all | すべて | ✦ | #b0b8ff | — |
| vwp | V.W.P | ✦ | #c4b5fd / #b0b8ff | ラベンダーがかった暗い盤面 |
| kafu | 花譜 | 🌸 | #ffb7c5 | ピンクがかった暗い盤面 |
| rime | 理芽 | 🌱 | #7eb8f7 | ブルーがかった暗い盤面 |
| harusar | 春猿火 | 🔥 | #ff7070 | レッドがかった暗い盤面 |
| isekai | ヰ世界情緒 | 🌼 | #d8d8d8 | シルバーがかった暗い盤面 |
| koko | 幸祜 | ⚡ | #c084fc | パープルがかった暗い盤面 |

### テーマ
- **ダーク（デフォルト）**: --bg:#07090e, --surface:#0c0f18, --text:#e8ecf8
- **ライト（body.light）**: --bg:#f4f5f9, --surface:#ffffff, --text:#0f1428

### 多言語対応
- 日本語（デフォルト）、英語、中国語（簡体字）、韓国語
- I18Nオブジェクトでキー管理、タグ名も翻訳対応（例: シングル→Single/单曲/싱글）

---

## 4. PC版UI

### 4-1. イントロ画面（#ttIntro）
- ターンテーブルUI。6人のメンバー + DAILY のLPレコードが円形配置
- クリックでプラッターにセット → PLAY ARCHIVEで入場
- DAILYを選ぶと「今日の観測」モード（日替わり5曲ランダムピックアップ）で入場

### 4-2. メイン画面
- **ヘッダー（sticky）**: ロゴ（UNOFFICIAL V.W.P ARCHIVE）、ビュー切替（⊞☰⊢）、検索バー、ナビ（ABOUT/CONTACT/UPDATE/MY SHELF）、テーマ切替（🌙/☀️）、言語切替（JP/EN/中文/한국어）、管理者🔑ボタン（themeBtnの隣）
- **サイドバー（aside, 200px固定幅）**: メンバーピル（最大3人複数選択可）、アルバムセクション（単一メンバー選択時のみ表示、シリーズ自動グループ化）、タグフィルター
- **ソートバー**: 新しい順 / 古い順 / ✦今日の観測 + 件数表示
- **コンテンツエリア（#vc）**: グリッド / リスト / タイムラインの3ビュー、無限スクロール（IntersectionObserver、PAGE_SIZE=30）

### 4-3. 3つのビュー
1. **グリッド（vgrid）**: YouTubeサムネイル + タグ + タイトル + 日付。auto-fill, minmax(210px, 1fr)
2. **リスト（vlist）**: サムネ左 + 情報右の横並び。サムネ104px
3. **タイムライン（tl）**: 左側に縦線+ドット、年ごとにグルーピング。サムネ90px

### 4-4. MY SHELF（PC専用、700px以下非表示）

#### 概要
- V.W.P ARCHIVEの**楽曲お気に入り棚機能**（PC専用）
- ユーザーが気に入った曲を最大10曲まで「棚」に追加し、レコード屋で棚を眺めるような体験で曲を選んでYouTubeに遷移できる
- **「レコードを取り出す体験」に集中する**: 音楽再生はYouTube側に完全に委ねる
- **コンクリート壁 × ウォールナット棚**: レコード屋のコンクリート壁にウォールナット棚板が架かっているビジュアル

#### 棚への追加・削除
| 項目 | 内容 |
|---|---|
| 追加方法 | メイン画面の曲カードに表示される📌ボタンをクリック |
| 削除方法 | MY SHELFオーバーレイの詳細パネル内の×ボタン |
| 上限 | 最大10曲 |
| 永続化 | localStorage キー `vwp_shelf` |
| 保存形式 | `JSON.stringify(['video_id_1', 'video_id_2', ...])` |

#### MY SHELFオーバーレイ
| 項目 | 内容 |
|---|---|
| 進入方法 | ヘッダーナビの「MY SHELF」ボタン |
| 表示形式 | フルスクリーンオーバーレイ（半透明背景 + 中央カード） |
| カードサイズ | `width: 90vw; max-width: 900px` |
| 閉じる方法 | ×ボタン / ESCキー / 半透明背景クリック |

#### 棚レイアウト
| 項目 | 内容 |
|---|---|
| 1段あたり | 最大5曲 |
| 段組み | 動的生成（5曲ごとに自動で段を追加） |
| ジャケット比率 | `aspect-ratio: 16/9`（YouTubeサムネと同じ横長） |
| ジャケットサイズ上限 | `max-width: 162px`（1曲でも5曲並び時と同じ大きさ） |
| ジャケット傾き | 各ジャケットに微妙なランダム傾き（±1.5deg程度） |
| 棚板 | ウォールナット調（`rgb(74,48,32) → rgb(42,28,12) → rgb(18,10,4)`） |
| 背景 | コンクリート壁テクスチャ（CSS repeating-linear-gradient） |

#### 詳細パネル（ジャケットクリック時）
- ジャケットが浮き上がり、詳細パネルがスライドイン
- LP盤がジャケットの右から半分飛び出す（slideX = jacketSize * 0.5）
- LP盤はメンバーカラーで半透明に染まる（canvas `globalAlpha: 0.55`）
- 情報テキストがフェードイン → 「YouTubeで聴く」ボタン → `window.open(url, '_blank', 'noopener,noreferrer')`

| 項目 | 内容 |
|---|---|
| ジャケットサイズ | `Math.min(200, Math.floor(panelW * 0.18))` |
| LP盤描画 | canvas（`drawVinylDisc` 関数、devicePixelRatio対応） |
| スライド量 | `jacketSize * 0.5` |
| タイトル文字 | 24px、`text-overflow: ellipsis` |

#### RECEIVED RECORDS棚（Observer-Link連携）
- MY SHELFオーバーレイの下段に**ダーク材の受取レコード棚**を表示
- localStorage `vwp_received` から最大10曲を読み込み
- 棚板カラー: エボニー調（`rgb(42,42,48) → rgb(26,26,34) → rgb(18,18,24)`）でウォールナットと差別化

#### LP盤のcanvas描画（drawVinylDisc）
- メンバーカラーを `globalAlpha: 0.55` でベース塗り
- `rgba(0,0,0,0.45)` で暗いオーバーレイ（レコード盤の質感）
- 同心円（3.5px間隔）で溝を表現
- 左上からの放射グラデーションで光沢
- 中央ラベル部分（メンバーカラーのリング + ダークな内側 + スピンドル）
- `devicePixelRatio` 対応でRetina対応

#### CSSスコープ・ID規則
- 全セレクタに `#my-shelf-overlay` プレフィックスを使用
- MY SHELF関連の全IDに `shelf-` プレフィックス
- RECEIVED RECORDS関連は `shelf-rcv-` プレフィックス
- 棚板: `.wood-board`（ウォールナット）/ `.wood-board.wood-board-dark`（エボニー）

### 4-5. 管理機能（認証後）
- 動画の追加・編集・削除
- YouTubeプレイリスト一括インポート
- アルバムの追加・編集・削除・曲紐付け
- アルバムの在庫状況管理（ON SALE / SOLD OUT）

---

## 5. モバイル版UI（700px以下）

### 5-1. 概要
- 既存の3ビュー（グリッド/リスト/タイムライン）に代わり、**カードスワイプUI**を採用
- メンバー選択はWELCOME画面に集約し、メイン画面のフィルターバーは**タグ絞り込み**に置き換え
- 「LPレコードを漁る体験」のモバイル翻訳

### 5-2. 画面遷移フロー

```
WELCOME画面（S字ホイール）
  ├ PLAY ARCHIVE → カードビュー（選択メンバーでフィルタリング）
  ├ TODAY'S OBSERVATION → カードビュー（日替わり5曲モード）
  └ OBSERVER-LINK → Observer-Link画面

カードビュー
  ├ ↕ 上下スワイプ: 曲送り/戻し
  ├ タップ: LP盤表示 + YouTube CTAボタン
  ├ タグチップ: タグで絞り込み
  ├ 左ヘッダーボタン → WELCOME画面に戻る
  ├ 右ヘッダーボタン → MY SHELF画面
  └ 📌ボタン: MY SHELFに追加/削除
```

> **注**: 左右スワイプはiOS Safariのブラウザジェスチャー競合により廃止 → ヘッダーボタンに変更

### 5-3. WELCOME画面仕様

#### S字ホイール
- メンバーアイコン（丸形）が**縦のS字カーブ**に沿って配置
- **中央のアクティブアイコン**: 110px、メンバーカラーのリング＋グロー、左横にメンバー名表示
- **上下のアイコン**: 56px → 38px と徐々に縮小、透明度も低下
- **S字カーブ**: `Math.sin(dist * 0.8) * 70px` で左右にオフセット
- 画面に3〜5個のみ表示

#### メンバー順序と表示名
| 順番 | ID | 表示名 | アイコン |
|---|---|---|---|
| 1 | vwp | V.W.P | V_W_P.png |
| 2 | kafu | KAF | KAF.png |
| 3 | rime | RIM | RIM.png |
| 4 | harusar | HARU | Harusaruhi.png |
| 5 | isekai | JOUCHO | isekaijocho.png |
| 6 | koko | KOKO | koko.png |
| 7 | all | ALL | グラデーション＋◆ |

#### 操作
| 操作 | 動作 |
|---|---|
| 上下スワイプ | ホイールが1個ずつ回転（慣性＋スナップ付き） |
| アイコンタップ | そのメンバーが中央にスナップ |
| PLAY ARCHIVE | トランジション演出 → カードビューに遷移 |
| OBSERVER-LINK | Observer-Link画面に遷移 |

#### ビジュアル
- **背景**: `#050710`
- **アンビエントグロー**: 選択中メンバーのカラーが背景にぼんやり滲む（filter:blur(110px)）
- **S字パスライン**: SVGで薄いカーブライン描画（opacity 0.04〜0.06）
- **ヘッダー**: Cinzel「V.W.P ARCHIVE」＋ Barlow Condensed「UNOFFICIAL」

### 5-4. カードビュー仕様

#### カード構造
```
┌─ Card ─────────────────────────────┐
│ [📌 ピンボタン]          (右上)     │
│  ┌─ サムネイル ──────────────────┐  │
│  │  YouTubeサムネ（object-fit:cover）│
│  │  グラデーションオーバーレイ     │  │
│  └───────────────────────────────┘  │
│  ── メンバーカラーバー（2px） ──    │
│  MEMBER NAME（メンバーカラー）      │
│  曲タイトル（Shippori Mincho）      │
│  2024-01-20                         │
│  [シングル] [系譜曲]                │
│         [▶ YOUTUBE]（タップ時表示）  │
└─────────────────────────────────────┘
```

#### カードスタック表示
| 位置 | transform | opacity |
|---|---|---|
| 前面（data-pos="0"） | translateY(0) scale(1) | 1 |
| 背面1（data-pos="1"） | translateY(12px) scale(.97) | 0.55 |
| 背面2（data-pos="2"） | translateY(24px) scale(.94) | 0.3 |
| 非表示 | translateY(40px) scale(.9) | 0 |

#### LP盤表示（タップ時）
- デフォルトは完全非表示（opacity:0, translate(105%)）
- タップ時にスライドイン: `transform: translate(40%,-50%) rotate(25deg); opacity:1`
- canvas描画: メンバーカラー半透明 + 溝 + 光沢 + ラベル
- YouTube CTAボタンも同時にフェードイン

#### パフォーマンス最適化
- 仮想カードレンダリング（DOM3ノードのみ保持）
- requestAnimationFrameスロットリング
- blurを50px→30pxに削減

### 5-5. モバイルMY SHELF画面
- 横ジャケットカルーセル
- ヘッダー右ボタンから遷移

---

## 6. Observer-Link

### 6-1. 概要
V.W.P ARCHIVE内の観測者（ファン）同士のレコード交換機能。
「1曲送ると、どこかの観測者から1曲届く」— Song Bottle（song-bottle.app）に着想を得た、V.W.P.楽曲限定のセレンディピティ交換体験。

- **Observer**（観測者）= KAMITSUBAKI STUDIOファンの呼称
- **V.W.P.楽曲限定**: 既存DB（videosテーブル）の曲のみ。外部URL不可 → モデレーション不要
- **認証不要**: client_hash（IP+UA SHA-256）でレート制限。PII保存なし
- **LP/レコード世界観の統一**: MY SHELFの棚 → レコード交換 → 受取棚、全てレコードメタファーで一貫
- **全テキスト英語**: 4言語対応サイトの翻訳コスト削減

### 6-2. 設計決定事項

| 項目 | 決定 | 理由 |
|---|---|---|
| 曲プール | videosテーブルの曲のみ | モデレーション不要 |
| バックエンド | Supabase `song_bottles` + Netlify Functions | 既存アーキテクチャ活用 |
| 認証 | 不要。client_hash のみ | RLS・認証コスト回避 |
| マッチング | `ORDER BY random()` | 「古い贈り物も贈り物」 |
| 保持期間 | waiting / matched 両方7日TTL | 統一管理 |
| レート制限 | 1日10回（client_hashベース） | スパム防止 |
| ムードタグ | Morning / Night / Rain / Walk / Work / Chill（最大2つ） | |
| メッセージ | オプショナル、最大20文字 | placeholder: "Add a short note..." |
| 受取曲保存 | localStorage `vwp_received` 最大10曲 | MY SHELFと同パターン |

### 6-3. 選曲ピッカー（ボトムシート）

**MY SHELFタブ（デフォルト）:**
- localStorage `vwp_shelf` の曲を表示
- 空の場合は disabled → ALLタブが自動デフォルト

**ALLタブ（段階絞り込み）:**
- Step 1: メンバー選択（V.W.P / KAF / RIM / HARU / JOUCHO / KOKO）
- Step 2: タグ絞り込み（Single / Duet / Trio / Cover）
- Step 3: フィルタリングされた曲リスト

### 6-4. データモデル（song_bottles テーブル）

```sql
CREATE TABLE song_bottles (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id      BIGINT NOT NULL,
  mood_tags     TEXT[],
  message       TEXT CHECK (char_length(message) <= 20),
  client_hash   TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  status        TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched')),
  matched_with  UUID REFERENCES song_bottles(id)
);
```

### 6-5. API仕様

#### POST /.netlify/functions/observer-link-exchange
マッチングAPI。曲を送信して1曲受け取る。

**マッチングロジック:**
1. IP + User-Agent → SHA-256 → client_hash
2. 当日のclient_hashの投稿数COUNT → 10回超なら429
3. video_idをvideosテーブルでバリデーション → なければ400
4. INSERT INTO song_bottles (status='waiting')
5. SELECT * FROM song_bottles WHERE status='waiting' AND client_hash != 送信者 ORDER BY random() LIMIT 1
6. マッチ成立 → 両方 status='matched' + matched_with 相互リンク
7. プール空 → videosテーブルからランダム1曲をフォールバック推薦

#### GET /.netlify/functions/observer-link-result?id=xxx
リザルトページ。交換の両曲をOGP meta + UIで返す。

**ルーティング（netlify.toml）:**
```toml
[[redirects]]
  from = "/result/"
  to = "/.netlify/functions/observer-link-result"
  status = 200
  force = true
```

### 6-6. フロントエンドUI

```
WELCOME画面（OBSERVER-LINKボタン）
  ↓
Compose画面（曲選択 + ムード + メッセージ）
  ↓ SEND RECORD
Sending画面（LP盤回転飛行アニメーション）
  ↓ API応答後
Result画面（Your record / Received record）
  ├ Share → カスタム共有ダイアログ or OSシェアシート
  ├ Send another → Compose画面に戻る
  └ YouTubeで聴く → 外部遷移
```

**共有:**
- モバイル: `navigator.share()` → OSシェアシート
- デスクトップ: カスタムダイアログ（X / Discord / Copy URL）
- 共有テキスト: `#ObserverLink で「{曲名}」を受け取りました！`

**OGP meta:**
```html
<meta property="og:title" content="#ObserverLink で {member} - {title} を受け取りました！">
<meta property="og:description" content="{message or 'V.W.P ARCHIVE — Observer-Link'}">
<meta name="twitter:card" content="summary">
```

### 6-6a. Quick Send（曲カード直接OL送信）

曲カードから直接Observer-Link送信を行うショートカット機能。
既存のCompose画面（曲選択+ムード+メッセージ）をスキップし、ワンタップで送信→Sending→Resultに合流する。

**設計意図:**
GA4データでOLへの導線が弱い（mob_observer_link_open: 4回/28日間）。曲を閲覧中に「これを誰かに送りたい」衝動を逃さない導線。

**フロー:**
```
曲カードのOLボタンタップ
  ↓ 即API呼び出し（mood_tags:[], message:null）
Sending画面（LP盤回転アニメ）
  ↓ API応答後
Result画面（既存OLフローに合流）
  ├ Share
  ├ Send another
  └ YouTubeで聴く
```

**アイコン:**
- Observer linkアイコン: 2つの円を点線で繋いだSVG（16px）
- 色: `--ol-accent: #6c5ce7`（📌の白系と差別化）

```svg
<svg viewBox="0 0 16 16" width="16" height="16" fill="none">
  <circle cx="4" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3"/>
  <circle cx="12" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3"/>
  <line x1="6.5" y1="8" x2="9.5" y2="8" stroke="currentColor" stroke-width="1.2" stroke-dasharray="1.5 1.5"/>
</svg>
```

**配置:**
- PC版: 📌ボタンの隣（グリッド/リスト/タイムライン全ビュー）
- モバイル版: `.card-pin` の左隣（カードビュー）

**仕様:**
| 項目 | 内容 |
|---|---|
| API | 既存 `observer-link-exchange`（変更なし） |
| mood_tags | `[]`（空配列） |
| message | `null` |
| 誤タップ防止 | なし（即送信） |
| 受取曲保存 | `vwp_received` に自動追加 |
| 上限到達時 | トースト通知「Daily limit reached (10/10)」 |
| CSSクラス（PC） | `.ol-quick-send-btn` |
| CSSクラス（モバイル） | `.card-ol-send` |
| ブランチ | `feature/ol-quick-send` |

### 6-7. CSSスコープ・命名規則
- 画面: `#observer-link-screen`
- クラスプレフィックス: `ol-`（ol-compose, ol-result, ol-send-btn, ol-picker-overlay 等）
- CSS変数: `--ol-accent: #6c5ce7`, `--ol-accent-soft: rgba(108, 92, 231, .12)`, `--ol-received: #5dc9a8`

### 6-8. 無料枠試算（1日100交換想定）

| サービス | 使用量 | 無料枠 | 消費率 |
|---|---|---|---|
| Supabase DB | +140KB/月（7日TTL） | 500MB | +0.03% |
| Supabase API | 月12,000クエリ | 無制限 | 0% |
| Netlify Functions | 月9,000呼び出し | 125,000/月 | 7.2% |
| Netlify 帯域 | 月45MB追加 | 100GB/月 | 0.05% |

バイラル時リスク: Netlify Functions 月125,000超過の可能性（1日10,000交換時）。Pro プラン（$19/月）で解消。

### 6-9. デプロイ・実装ステータス

| ファイル | ステータス |
|---|---|
| `netlify/functions/observer-link-exchange.js` | ✅ デプロイ済み・動作確認済み |
| `netlify/functions/observer-link-result.js` | ✅ OGP + 交換曲UI（fix/observer-link-share で修正済み） |
| `public/index.html` | ✅ OL画面HTML + Shareダイアログ + RECEIVED棚 |
| `public/app.js` | ✅ Share・WELCOME接続修正済み（fix/observer-link-share） |
| `public/style.css` | ✅ デプロイ済み |
| `netlify.toml` | ✅ force=true 追加済み（fix/observer-link-share） |
| Supabase song_bottles テーブル | ✅ 作成済み（テストデータ8件） |

**修正済みバグ（fix/observer-link-share — 2026/04/03 マージ）:**
- ✅ Share テキストが空 → `olSetShareData()` 実装
- ✅ WELCOMEボタン未接続 → `.mw-btn-daily` addEventListener 追加
- ✅ リザルトページ交換曲未表示 → Function UI実装
- ✅ /result/ ルーティング → netlify.toml force=true 追加
- ✅ チェックマーク演出 → CSS/SVGアニメーション実装
- ✅ フォールバックexpired表示 → status='fallback' + fallback_video_idカラム追加

---

## 7. GA4 計測設計

### 7-1. 重要指標の優先順位

**Tier 1（サイトの存在意義を測る）**
- YouTube遷移率 = external_link_click / song_click
- リピート率（Returning Users率）— ファンサイト最大の健全性指標

**Tier 2（体験の質を測る）**
- セッションあたりイベント数
- album_open → song_click 転換率
- モバイル vs PC のエンゲージメント差

**Tier 3（成長の可能性を測る）**
- 流入元別の新規ユーザー数
- メンバー別の利用偏り
- 曜日/時間帯別のアクティブ

### 7-2. 全イベント一覧

#### 共通イベント
| イベント名 | パラメータ | 発火タイミング |
|---|---|---|
| `song_click` | `song_title`, `member_name`, `album_name` | 曲タイトルクリック |
| `album_open` | `album_name`, `member_name` | アルバムモーダル開く |
| `member_filter_select` | `member_name` | メンバーフィルター選択 |
| `external_link_click` | `song_title` | YouTube遷移 |

#### MY SHELF イベント
| イベント名 | パラメータ | 発火タイミング |
|---|---|---|
| `shelf_add_song` | `song_title`, `member_name` | 曲を棚に追加 |
| `shelf_remove_song` | `song_title` | 曲を棚から削除 |
| `shelf_open` | `song_count` | MY SHELFオーバーレイを開いた |
| `shelf_play` | `song_title`, `member_name` | YouTubeで聴くボタン押下 |

#### モバイル専用イベント
| イベント名 | パラメータ | 発火タイミング |
|---|---|---|
| `mob_welcome_select` | `member_name` | WELCOMEでメンバー選択 |
| `mob_card_swipe` | `direction`, `song_title` | カード上下スワイプ |
| `mob_card_tap` | `song_title`, `member_name` | カードタップ |
| `mob_tag_filter` | `tag_name`, `member_name` | タグチップ選択 |
| `mob_back_to_welcome` | `member_name` | WELCOMEに戻る |

#### Observer-Link イベント
| イベント名 | パラメータ | 発火タイミング |
|---|---|---|
| `ol_send_record` | `video_id`, `member_name`, `mood_tags`, `has_message` | SEND RECORD |
| `ol_match_success` | `sent_video_id`, `received_video_id`, `time_ago_seconds` | マッチ成立 |
| `ol_match_fallback` | `sent_video_id`, `received_video_id` | フォールバック |
| `ol_share` | `method` | Share操作 |
| `ol_youtube_click` | `video_id`, `member_name` | 受取曲YouTube |
| `ol_picker_tab` | `tab` | ピッカータブ切替 |
| `mob_observer_link_open` | `member_name` | WELCOMEからOL起動 |
| `shelf_rcv_open` | `received_count` | RECEIVED RECORDS表示 |
| `shelf_rcv_tap` | `video_id`, `member_name` | 受取レコードタップ |
| `ol_quick_send` | `video_id`, `member_name`, `source` | 曲カードからQuick Send実行時 |

- `ol_quick_send` の `source` 値: `grid` / `list` / `timeline` / `mobile_card`

### 7-3. 離脱仮説
1. **「目的の曲が見つからない」離脱**: filter_select → song_click 間の離脱率
2. **「モバイルでの操作性」離脱**: デバイス別エンゲージセッション率比較
3. **「初回訪問で価値が伝わらない」離脱**: 新規ユーザーのイベント数=0のセッション率

### 7-4. 強み/弱みのシグナル
- Returning Users 30%以上 = ファンサイトとして強い
- YouTube遷移率が高い = アーカイブとしてのコアバリュー成立
- セッション内song_click 3回以上 = 回遊が起きている
- モバイル直帰率がPCより著しく高い = UIの問題
- album_open → song_click が不発 = モーダルの情報設計課題

---

## 8. 拡張予定

### フェーズ1: 隣接性（シリーズ区分の導入）
- CDラックの背表紙メタファー: 曲カード展開時に、背表紙が並んだ棚UIを表示
- データ構造: `series: "keifu" | "hasei" | "kakusei" | null`, `pair: ["kaf", "rim"] | null`
- 2つの棚レイヤー: シリーズの棚 + アルバムの棚

### フェーズ2残り: 棚機能拡張
- 棚に名前をつける: `{ shelfName: string, songs: string[] }` への拡張
- URL共有: 曲ID配列をBase64エンコードしてURLハッシュに埋め込み
- OGP画像生成: html2canvas or サーバーレスで、XカードにジャケットGタイルを表示
- 「棚から削除」をオーバーレイ外でも可能に: 📌ボタンをトグルに

### フェーズ3: 年譜ビュー（時系列の物語化）
- V.W.Pの歩みを「章立て」で見せる独立ビュー
- 章ごとにフルブリードの色面で空気感を変える
- ナラティブはセリフ体（Shippori Mincho）で詩的に配置

| 章 | タイトル | 時期 | キーイベント |
|---|---|---|---|
| I | 電撃、五つの魔女 | 2021.3 — 2022 | 花譜2nd ONE-MAN「不可解弐Q2」で結成 |
| II | 系譜、運命へ | 2022 — 2023.8 | 系譜曲蓄積 → 1stアルバム「運命」 |
| III | 覚醒、代々木の夜 | 2024.1 — 2024 | 代々木第一体育館ワンマン「現象Ⅱ」→ 2ndアルバム「覚醒」 |
| IV | 反転 | 2025.1 — | 3rdアルバム「反転」→ ぴあアリーナMM「現象Ⅳ」 |

### Chrome拡張連携（別リポジトリ）
- New Tabオーバーライド: 新しいタブでMY SHELFのLP風UIを表示
- データ同期: content_script.js が `vwp_shelf` をlocalStorageから読み、`chrome.storage.local` に書き写す

### 実装優先順位の判断基準
- album_openが1回で止まっている → フェーズ1（回遊設計）を先に
- すでに2〜3回開かれている → フェーズ2（コレクション）で繰り返し来る理由を作る

---

## 9. localStorage キー一覧

| キー | 用途 | 形式 | 上限 |
|---|---|---|---|
| `vwp_shelf` | MY SHELF（自分のピン留め曲） | `JSON.stringify([id1, id2, ...])` | 10曲 |
| `vwp_received` | RECEIVED RECORDS（交換で受け取った曲） | `JSON.stringify([id1, id2, ...])` | 10曲 |

---

## 10. 運用

### コミット方法
- Claude Codeは必ず新ブランチ作成→PR提出。Yukiが自分でマージ。直接コミットは禁止
- デプロイ: Netlifyが自動デプロイ

### 環境変数（Netlify Functions）
- SUPABASE_URL
- SUPABASE_SECRET_KEY
- YOUTUBE_API_KEY
- ADMIN_PASSWORD

### KAMITSUBAKI STUDIO 二次創作ガイドライン遵守事項
- 非商業目的（個人ファンサイト）
- 公式作品と誤認されない配慮（UNOFFICIALの明示）
- 過度に暴力的・性的なコンテンツの禁止
- 完全なガイドライン: https://kamitsubaki.jp/guidelines/

### ファン層に関する知見
- VTuberファンは10〜30代の男性、10〜20代の女性が中心（矢野経済研究所2023年11月調査）
- KAMITSUBAKI / V.W.P単体の公開データは存在しない
- GA4のユーザー属性レポートで実データ確認が最優先

---

## 11. モバイル最適化履歴（PR #56）

| # | 改善項目 | アフター |
|---|---|---|
| 1 | ヘッダーボタン | 最小32×32px保証 |
| 2 | グリッド(375px) | repeat(2,1fr)固定+パディング調整 |
| 3 | ソートバー | flex-wrapで自然に折り返し |
| 4 | フィルターチップ | 最小高34px+スクロールスナップ |
| 5 | リスト/TLサムネ | 80px / 72px |
| 6 | アルバムヘッダー | flex-wrap+サムネ64px |
| 7 | モーダル | 幅94%/padding1.2rem/iOSズーム防止 |
| 8 | FAB | safe-area-inset-bottom対応 |
| 9 | アクセシビリティ | reduced-motion全無効化 |

---

## 12. 開発経緯・意思決定ログ

### MY SHELF 改修サイクル（2026/03/25）
1. 統合性チェック＋実装プロンプト作成
2. PRレビュー＋Issue起票プロンプト作成
3. プロトタイプUI（shelf_lp_ratio_layout.html）
4. 詳細パネル見切れ修正（max-height遷移追加）
5. LP盤の重なり修正（slideX 0.58→0.45）
6. 詳細ジャケットサイズ: 120px に確定
7. LP盤をSVG→canvas描画に変更
8. フルスクリーン化 → 900pxに縮小
9. 棚ジャケを16:9比率に修正
10. 5枚ごと動的段組み
11. 1曲時の拡大防止（max-width: 162px）

### Observer-Link PRマージ履歴
| PR | ブランチ | 内容 | ステータス |
|---|---|---|---|
| #82 | `feature/observer-link-backend` | Supabase + Functions | ✅ マージ済み |
| #83 | `feature/observer-link-ui` | フロントエンドUI | ✅ マージ済み |
| #84 | `feature/observer-link-integration` | WELCOME + SHELF改修 | ✅ マージ済み |
| - | `fix/observer-link-share` | Share + リザルト + バグ修正 | ✅ マージ済み（2026/04/03） |
| - | `feature/ol-quick-send` | 曲カード直接OL送信 | 📋 プロンプト作成済み・未着手 |

### 見送った設計案（主要なもの）
| 案 | 見送り理由 |
|---|---|
| Supabase保存（MY SHELF） | 認証機能が必要。localStorageで十分 |
| LP盤の無限回転アニメーション | canvas静止画に変更。回転不要 |
| フクロウ/モールス信号機アイコン（OL） | LP/レコード世界観と不整合 |
| メッセージ必須（OL） | 送信ハードルが上がる |
| 新しい曲優先マッチング（OL） | 「古い贈り物も贈り物」 |
| 左右スワイプ（モバイル） | iOS Safariブラウザジェスチャー競合 |
| Quick Sendにムードタグ付与 | タップ→即送信の潔さを優先。タグ付きはCompose経由で可能 |
| Quick Send誤タップ防止（長押し/undo） | 1日10回制限＋体験の軽さを優先 |
| Arc trailアイコン（OLヒーローモチーフ） | 16pxで2円+点線のObserver linkの方が明快 |
| Disc sendアイコン（LP盤+矢印） | 16pxで矢印が潰れる。Observer linkの方がシンプル |

---

## 13. プロトタイプファイル一覧

| ファイル | 内容 | 状態 |
|---|---|---|
| `vwp_welcome_scurve.html` | WELCOME画面（S字ホイール） | ✅ プロトタイプ完了・本番統合済み |
| `vwp_mobile_card_view.html` | カードビュー（縦スワイプ＋LP盤） | ✅ プロトタイプ完了・本番統合済み |
| `vwp_mobile_shelf.html` | モバイルMY SHELF | ✅ プロトタイプ完了・本番統合済み |
| `prototype_observer_link.html` | Observer-Link UIプロトタイプ | ✅ 完了・本番統合済み |
| `vwp_image_conte_template.xlsx` | 画像コンテテンプレート | 運用中 |
| `PR_quick_send_from_card.md` | Quick Send実装プロンプト | 📋 作成済み・未着手 |
