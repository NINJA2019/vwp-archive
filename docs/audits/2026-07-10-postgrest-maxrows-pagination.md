# 設計監査レポート: PostgREST Max Rows キャップによる全件fetch切り詰め（憲法5根本修正）

> 監査日: 2026-07-10 / 対象: `netlify/functions/_shared/supabase.js` `fetchAllVideoRows` ほか全件fetch箇所 / 監査体制: planner（設計監査）→ 本レポート承認後に implementer → reviewer → verifier

## 0. 発端

自動取り込み（ingest-youtube）が既存曲と重複するpendingを32件取り込んだ。「videoIdで照合しているのに重複が入るのはおかしい」という指摘から根本調査を実施。

## 1. 根本原因の最終確認

真因: `fetchAllVideoRows`（main版）が `limit=10000&offset=0` の**単発GET**で全件取得を試みたが、PostgREST の Max Rows 設定が1リクエストを1,000行にキャップするため、videos 1,552件のうち先頭1,000行しか返らず、videoId dedup が「id昇順の最初の1,000件」しか見なかった。

**照合ロジック（videoId正規化・Map突合）自体は健全**であることを実データで検証済み: 重複pending 32件は全て相手が id 1321以降（=1,001行目以降、最も手前1,256行目）に存在し、1,000件窓の外にいた。1,000件以内に相手がいたのに弾けなかったケースはゼロ。→ 入力データが silent に切り詰められていたことが唯一の欠陥。

補足: 32件が「id 1256を境にきれいに窓外」という分布は、PostgREST の無指定デフォルト順が **id昇順で安定**していることを強く示唆する（→論点3）。

## 2. 同じ罠の全数洗い出し

`netlify/functions/` 全ファイル + `public/admin.js` をgrepした結果。1,000行超え得るテーブル（videos 1,552件 / song_bottles）への全件・大量fetch:

| 箇所 | クエリ | 分類 | 危険度 | 影響 |
|---|---|---|---|---|
| `_shared/supabase.js:75`（main版） | `videos limit=10000&offset=0` 単発 | (b)単発で危険=真因 | 修正対象 | dedup欠落→重複pending取り込み |
| `ingest-youtube.js:157` | `fetchAllVideoRows(url)` 経由 | (b)→修正で(a) | 高（根本） | supabase.js修正で自動解消。overflowガード有 |
| `playlist-import.js:29` | `fetchAllVideoRows` 経由 | (b)→修正で(a) | 高（#112で10000化したが同穴） | supabase.js修正で自動解消 |
| `admin-query.js:124`（playlist-import action） | `fetchAllVideoRows` 経由 | (b)→修正で(a) | 高 | supabase.js修正で自動解消 |
| **`admin-query.js:50-53`（汎用query action）** | `limit=10000` 組み立て後に**単発 `fetch()`** | **(b)単発で危険・未修正** | **中（admin審査）** | **#119の10000ガードはMax Rowsで無効化** |
| `videos-get.js:37-45` | `limit=1000&offset=N` whileループ | (a)ページング済み・正しい | なし | 公開サイト。`order=date.desc`明示済 |
| `observer-link-exchange.js:214/125` | `limit=50` | (c)意図的少件 | なし | 50<1000 |
| `observer-link-exchange.js:202` | `limit=1 Prefer:count=exact` | (c)count専用 | なし | count=exactはcontent-rangeヘッダで総数返却・行キャップと独立 |
| `albums-get.js:9` | `albums`（limit無） | (c) | なし | 数十件規模 |

### #119ガード無効化の詳細（admin審査への実害）

`admin-query.js` 汎用 `query` action（L44-55）はL50で `limit=10000` を自前組み立てするが、L53は `fetchAllVideoRows` を**使わず単発 `fetch(url)`**。よってMax Rowsで1,000行に切り詰められ、**#119の「10000ガード」は実効性ゼロ**。

`public/admin.js` が汎用queryに `limit:'9999'` を渡す箇所への影響:
- **LIBRARYタブ（L493-499）**: published videos全件を `allVideos`（L505）として重複検出 `dupCount`（L508-510）・鮮度 `freshness`（L515-522）・総数表示・アルバム紐付けUIを構築。**1,552件中1,000件しか見えず**、id 1001以降の重複・古い曲・未紐付けを admin が検知できない。
- **INCOMING TRANSMISSION（L237-242）**: pending審査。現状pendingは1,000未満で当面顕在化しないが、大量ingest時に審査漏れの温床。
- **observer-link監視タブ（L870-875）**: `song_bottles limit:9999`。song_bottlesが1,000超で監視画面が不完全。

重大度「中」: 公開サイト（憲法2）ではなく**admin審査の完全性**の問題。ただしLIBRARYの重複検出が効かないと憲法2違反（重複公開）を人間が見逃す二次リスクがあり放置不可。**本修正のスコープに含めるべき**。

## 3. order明示の結論 → `order=id.asc` 明示すべき（必須）

offsetページングは各ページ間で安定した全順序を前提とする。無指定だとPostgRESTの返す順は実装依存でページ間の行重複/欠落が起き得る。実データはid昇順安定を示唆するが、契約化されていない暗黙依存で脆い。`videos-get.js` は既に `order=date.desc` を明示（先例）。dedup用途では **`order=id.asc` が最適**（idは単調増加PK・欠番あっても全順序安定、date.descはnull/同date衝突でページ境界が不安定になり得る）。→ `fetchAllVideoRows` のURLに `&order=id.asc` を追加。

## 4. 現実装（308505f）の評価

**採用可能な骨格（正しい）**: `limit=1000&offset=N` whileループ・`page.length < PAGE_SIZE` で最終ページ判定（videos-get.js同型）/ `throwOnHttpError` 両分岐維持 / 非配列レスポンス早期return / 戻り値 `{rows, overflow, count}` 不変で呼び出し側3ファイル無改修。

**要修正点**:
1. **`order=id.asc` 未指定（主要欠陥）** — §3の通り追加必須。
2. **MAX_ROWS=50000 の overflow意味変更**: 呼び出し側3系統のエラー文言は依然「上限(10000)に到達」（ingest:162 / playlist:32 / admin:127）で実態とズレる。文言更新推奨（機能上は無害）。
3. offset境界のoff-by-one的挙動（50,000行ちょうどがoverflow扱い）。実データ1,552件では未到達・実害なし。許容。

**結論**: 骨格は採用可。本質的追加は「order=id.asc」のみ。ただしブランチ履歴が信頼できない（自己申告3コミット vs 実態1コミット、scenarios.mjs未コミット）ため**mainから作り直す前提は妥当**。

## 5. overflow時の3呼び出し側挙動 → 全て「安全に中止」

ingest-youtube.js:160-163 / playlist-import.js:31-33 / admin-query.js:126-128 いずれも overflow時 `return 500`（INSERT/PATCH前に中止）。突合不完全→取り込み中止に倒れる。壊れない。文言のみ実態(50,000)とズレ。

## 6. fn-snapshot検証戦略

ハーネス（run.mjs）のfetchスタブは `match`/`body` に関数を許容しURL依存応答が可能 → 1,000件超の2ページ以上fetchを再現できる。

**懸念**: overflowシナリオは50ページ（50 GET）を回すため、main版（1ページ完了）とafter版（50ページ）で構造的にsnapshot一致しない（意図的差分）。→ **overflowシナリオは「before/after diff空」の対象外とし、after単独で overflow=true・statusCode 500 を確認**する運用にすべき。verifier手順に明記。

## 7. 憲法5改訂 最終文言案

現行（誤り — 真因そのものを推奨していた）:
> 5. **Supabase PostgREST**: 1,000件超テーブルの全件fetchは `.range(0, 9999)` を明示（デフォルトLIMIT 1000でsilent dropする。service role keyでも同じ）。

改訂案:
> 5. **Supabase PostgREST — 全件fetchは必ずページングループ**: 1,000件超のテーブル（videos / song_bottles等）の全件取得は、`limit=1000&offset=N` を N=0,1000,2000... と進め、戻りが1,000件未満になるまで繰り返すループで行う（`_shared/supabase.js` の `fetchAllVideoRows` / `videos-get.js` が参照実装）。**単発の `limit=10000` や `.range(0,9999)` は PostgREST の Max Rows 設定（=1,000）で silent に1,000行へ切り詰められるため禁止**（service role keyでも同じ）。ページング時は `order=id.asc` 等で**全順序を明示**しページ間の行ズレを防ぐこと。dedup用全件fetchが切り詰められると重複pending取り込み＝憲法2違反の温床になる。

## 8. 代替案比較 → (a) コードページング推奨

| 案 | 頑健性 | 保守性 | 評価 |
|---|---|---|---|
| **(a) コードページング** | 高（設定非依存・自己完結） | 中 | **推奨**。videos-get.js と統一 |
| (b) Dashboard Max Rows引き上げ | 低（設定依存の暗黙契約・巻き戻り/新環境で再発） | 一見高 | 不採用（(a)の上での任意の保険） |
| (c) Rangeヘッダ方式 | 高 | 低（既存と二重標準） | 不採用 |

## 9. クリーン実装計画

**前提**: `fix/fetchallvideorows-pagination`（308505f）は破棄。mainから `fix/postgrest-maxrows-pagination`。

- **C1** `_shared/supabase.js`: 308505f実装を流用 + URLに `&order=id.asc` 追加。docコメントのoverflow意味（50,000）を正確に。
- **C2** `admin-query.js`: 汎用query action（L44-55）の1000超え得るテーブルへの全件queryをページング化。汎用ヘルパー `fetchAllRows(supaUrl, key, path, opts)` を新設（任意table/filter/order対応）。**`limit` 明示指定時はページングせず単発**（意図的少件=limit:50等を尊重）、未指定/9999時のみページング、の分岐が安全。
- **C3** 呼び出し側3系統のoverflow文言「上限(10000)」→「安全上限(50,000)」整合（任意）。
- **C4** `tests/fn-snapshot/scenarios.mjs`: クエリ形状追従（order=id.asc含む）+ overflow paging fixture。overflowシナリオはdiff対象外運用。
- **C5** `CLAUDE.md` 憲法5改訂（§7）。

**検証手順**: (1)main functionsコピーでbase.json生成 (2)after生成→diff、overflow/paging新設以外は差分空 (3)overflowシナリオ単独で overflow=true・500確認 (4)デプロイプレビューでvideos全件fetchが1,552件返る（1,000で止まらない）ことをingest/playlist-import/admin LIBRARYで確認。特にadmin LIBRARYのdupCount・総数が1,552ベースになるか。

## 10. リスクと緩和

- R1: order追加でsnapshot全fixture不一致 → match文字列を新URL形状に更新（C4）。`u.includes` 部分一致なので `limit=1000&offset=0` を含めば通る（order挿入位置に注意）。
- R2: admin汎用ページング化のスコープ肥大 → 最小案「limit未指定/≥1000時のみwhileループ」。
- R3: 50ページGETのレイテンシ → 1,552件=2ページで実害なし。
- R4: 並行INSERTのoffsetズレ → ingestはループ外1回・INSERT前で自己汚染なし。order=id.ascで実用上十分。

## 11. Yuki確認事項

1. **admin-query.js 汎用query action のページング化をこのPRスコープに含めるか？**（#119ガード実効ゼロ・admin LIBRARYが1000件しか見えていない。推奨: 含める。別PR分割も可）
2. **overflowエラー文言「10000」→「50,000」修正を含めるか**（ログ整合のみ）
3. **MAX_ROWS=50,000 の妥当性**（本番1,552件に対し余裕十分）
4. 憲法5改訂文言（§7案）の承認
5. `fix/fetchallvideorows-pagination` / 308505f の破棄承認

## 12. Yuki承認記録（2026-07-10）

1. admin-query.js 汎用query action のページング化 → **本PRに含める**（承認）
2. overflowエラー文言「10000」→「50,000」修正 → **含める**（承認）
3. MAX_ROWS=50,000 → **承認**
4. 憲法5改訂文言（§7案）→ **承認**
5. `fix/fetchallvideorows-pagination` / 308505f 破棄 → **承認**

→ 実装体制: mainから `fix/postgrest-maxrows-pagination`（本レポートを含む）で C1〜C5 を逐次コミット。admin汎用ページングは汎用ヘルパー `fetchAllRows(supaUrl, key, path, opts)` を新設し、`limit` 明示かつ<1000なら単発・未指定/≥1000ならページング（order未指定時は id.asc 補完）。
