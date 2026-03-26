# Claude Code: モバイル版MY SHELF PRプロンプト

## タスク
`vwp-archive` リポジトリに新しいブランチ `feature/mobile-shelf` を作成し、モバイル版MY SHELFのプロトタイプを追加してPRを作成してください。

## リポジトリ
- **URL**: https://github.com/NINJA2019/vwp-archive
- **ベースブランチ**: main

## 手順

1. リポジトリをクローン（既にクローン済みなら `git pull origin main` でOK）
```bash
git clone https://github.com/NINJA2019/vwp-archive.git
cd vwp-archive
git checkout main
git pull origin main
```

2. 新しいブランチを作成
```bash
git checkout -b feature/mobile-shelf
```

3. 以下のファイルを配置

### ファイル: `public/mobile-shelf.html`
- ソース: このディレクトリの `vwp_mobile_shelf.html` をそのままコピー
- 内容: モバイル版MY SHELF（横スクロールジャケットカルーセル）

4. コミット＆プッシュ
```bash
git add public/mobile-shelf.html
git commit -m "feat: add mobile MY SHELF prototype

- Horizontal jacket carousel for browsing saved songs
- Tap jacket to show detail panel + YouTube CTA
- Edge swipe (left 30px zone) to return to card view
- Member color accent on each jacket
- Scroll-snap for smooth per-item scrolling
- Empty state when shelf has no songs

Part of mobile UI redesign (see feature/mobile-card-ui PR)"

git push origin feature/mobile-shelf
```

5. PRを作成
```bash
gh pr create \
  --title "feat: モバイル版MY SHELF プロトタイプ" \
  --body "## 概要
モバイル版MY SHELFのプロトタイプです。カードビューから→右スワイプで開く想定。

### 追加ファイル
| ファイル | 内容 |
|---|---|
| \`public/mobile-shelf.html\` | 横スクロールジャケットカルーセル |

### ナビゲーション構造
\`\`\`
← 左スワイプ          中央              → 右スワイプ
WELCOME画面    ⟷    カードビュー    ⟷    MY SHELF
(メンバー選択)       (曲ブラウズ)        (お気に入り)
\`\`\`

### UI仕様
- **ジャケットカルーセル**: 144px角の横スクロール、scroll-snap で1枚ずつ止まる
- **アクティブジャケット**: scale(1.12) で浮き上がり、メンバーカラーバー表示
- **ディテールパネル**: ジャケットタップで下部スライドイン（サムネ＋曲情報＋YouTube＋削除）
- **左端スワイプ**: 画面左30px以内からの右ドラッグでカードビューに戻る
- **アンビエントグロー**: 選択中ジャケットのメンバーカラーが背景に滲む
- **LP盤なし**: 軽量版（ジャケットのみ、静的カラーリングのみ）

### 関連PR
- feature/mobile-card-ui（WELCOME画面＋カードビュー）

### ステータス
プロトタイプ段階。本番統合は別PRで対応。

### 残タスク
- [ ] カードビューとの右スワイプ遷移接続
- [ ] localStorage連携（既存のvwp_shelfキー読み取り）
- [ ] Supabase APIとの接続（曲詳細の取得）
- [ ] 本番コードへの統合
" \
  --base main
```

## 注意事項
- 既存の `public/index.html`, `public/app.js`, `public/style.css` には**一切変更を加えないでください**
- `feature/mobile-card-ui` ブランチとは独立したPRです（将来マージ時に統合）
