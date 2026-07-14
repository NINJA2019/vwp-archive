# vwp-archive — プロジェクト憲法（全エージェント共通ルール）

V.W.P ARCHIVE（https://vwp-archive.netlify.app）— KAMITSUBAKI STUDIO所属V.W.Pの非公式楽曲アーカイブ。
Vanilla HTML/CSS/JS + Netlify Functions + Supabase。収益なし、本番稼働中。

## 絶対条件（違反したPRは即リジェクト）

1. **直接コミット禁止・mainへのpush禁止。** 必ず新ブランチ → PR。マージするのはYukiだけ。
2. **公開サイトのvideos取得クエリには必ず `status='published'` フィルタ。** pending/rejectedの漏洩は最重度の事故。
3. **localStorageキー不変**: `vwp_shelf`, `vwp_received`（ID配列のJSON、各最大10曲）。
4. **CSSスコープ規約不変**: `shelf-` / `shelf-rcv-` / `ol-` プレフィックス、`#my-shelf-overlay` / `#observer-link-screen` スコープ。
5. **Supabase PostgREST — 全件fetchは必ずページングループ**: 1,000件超のテーブル（videos / song_bottles等）の全件取得は、`limit=1000&offset=N` を N=0,1000,2000... と進め、戻りが1,000件未満になるまで繰り返すループで行う（`_shared/supabase.js` の `fetchAllVideoRows` / `videos-get.js` が参照実装）。**単発の `limit=10000` や `.range(0,9999)` は PostgREST の Max Rows 設定（=1,000）で silent に1,000行へ切り詰められるため禁止**（service role keyでも同じ）。ページング時は `order=id.asc` 等で**全順序を明示**しページ間の行ズレを防ぐこと。dedup用全件fetchが切り詰められると重複pending取り込み＝憲法2違反の温床になる。
6. **song_bottles.status** の取りうる値は `waiting / matched / fallback_matched`。`guard_waiting_pool` トリガーが `waiting→fallback` をブロックする。exchange Functionのフォールバック永続化ロジックを変更しない。
7. **netlify.toml** の `/result/` リダイレクトは `force=true` 必須。
8. **windowに露出している関数・変数を消さない。** Chrome拡張（VWP New Tab）が `Object.defineProperty` でwindow変数を監視する。ES Modules化しても外部依存のあるものは `window.xxx = xxx` で露出を維持。
9. **KAMITSUBAKIガイドライン**: 非商業・UNOFFICIAL明示・公式素材の使用禁止。音楽再生はYouTube別タブ遷移のみ（IFrame埋め込みは採用しない）。
10. **自動publishは永久にしない。** 自動取り込みは常に `status='pending'` 止まり。公開判断は人間。

## 設計思想

「CDジャケットを探すような体験」。情報検索ツールではなくブラウジング体験。
セレンディピティ > 効率。KPIは滞在中の探索量。迷ったら世界観（LP/レコードメタファー）に寄せる。

## スタック早見表

- 構成: index.html / app.js / style.css（+ admin.html / admin.css / admin.js は独立、MU-TH-UR 6000風 #33ff66）
- Supabase project: wzhjxhtrksilxgmhnyoh。DDLは `apply_migration` 相当のmigrationファイルで
- メンバーカラー: all=#b0b8ff, vwp=#c4b5fd, kafu=#ffb7c5, rime=#7eb8f7, harusar=#ff7070, isekai=#d8d8d8, koko=#c084fc
- OL変数: --ol-accent=#6c5ce7 / --ol-received=#5dc9a8
- フォント: Cinzel / Shippori Mincho / Barlow Condensed / Noto Sans JP
- 環境変数: SUPABASE_URL, SUPABASE_SECRET_KEY, YOUTUBE_API_KEY, ADMIN_PASSWORD

## オーケストレーション・パイプライン

メインセッション（あなた）は**指揮者**。自分でコードを書かず、以下の順でサブエージェントに委譲する:

```
1. planner     — タスク分解・リスク評価・実装計画（Yukiの承認を待つ）
2. implementer — 計画に沿って新ブランチで実装
3. reviewer    — 実装とは別コンテキストで敵対的レビュー
4. verifier    — 回帰チェック・動作確認手順の実行
5. あなた      — 結果統合 → PR説明文作成 → Yukiに報告
```

- reviewerがCRITICALを出したら implementer に差し戻し（最大2往復。3回目はYukiにエスカレーション）
- 計画承認（planner後）とPRマージの2箇所だけがYukiのゲート。それ以外は自走してよい
- 各段階の完了時に1〜3行のステータスを報告する（長文の途中経過は不要）

## PR説明フォーマット

```
## 目的
## 変更したもの
## 変更していないもの（保証事項）
## レビュー往復履歴（reviewerの指摘と対応）
## 動作確認方法（Yuki向け手順）
## 判断保留リスト
```
