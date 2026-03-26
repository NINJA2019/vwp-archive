# Claude Code: モバイルUI PRプロンプト

## タスク
`vwp-archive` リポジトリに新しいブランチ `feature/mobile-card-ui` を作成し、モバイル版UIのプロトタイプファイル3つを追加してPRを作成してください。

## リポジトリ
- **URL**: https://github.com/NINJA2019/vwp-archive
- **ベースブランチ**: main

## 手順

1. リポジトリをクローン
```bash
git clone https://github.com/NINJA2019/vwp-archive.git
cd vwp-archive
```

2. 新しいブランチを作成
```bash
git checkout -b feature/mobile-card-ui
```

3. 以下の3ファイルを所定のパスに配置

### ファイル1: `public/mobile-welcome.html`
- ソース: このプロジェクトの `vwp_welcome_scurve.html` をそのままコピー
- 内容: WELCOME画面（S字ホイールでメンバー選択）

### ファイル2: `public/mobile-cards.html`
- ソース: このプロジェクトの `vwp_mobile_card_view.html` をそのままコピー
- 内容: カードビュー（縦スワイプで曲ブラウズ）

### ファイル3: `docs/mobile_ui_spec.md`
- ソース: このプロジェクトの `mobile_ui_spec.md` をそのままコピー
- 内容: モバイル版UI変更仕様書

4. コミット＆プッシュ
```bash
mkdir -p docs
git add public/mobile-welcome.html public/mobile-cards.html docs/mobile_ui_spec.md
git commit -m "feat: add mobile card UI prototypes

- WELCOME screen with S-curve rotary wheel for member selection
- Card swipe view for browsing songs (vertical swipe)
- Mobile UI specification document

Refs: mobile_ui_spec.md for full design details"

git push origin feature/mobile-card-ui
```

5. PRを作成
```bash
gh pr create \
  --title "feat: モバイル版カードUI プロトタイプ" \
  --body "## 概要
モバイル版（700px以下）のUI導線を全面刷新するプロトタイプです。

### 追加ファイル
| ファイル | 内容 |
|---|---|
| \`public/mobile-welcome.html\` | WELCOME画面 — S字ホイールでメンバー選択 |
| \`public/mobile-cards.html\` | カードビュー — 縦スワイプで曲ブラウズ |
| \`docs/mobile_ui_spec.md\` | モバイル版UI変更仕様書 |

### UIフロー
1. **WELCOME画面** → メンバー選択（V.W.P / KAF / RIM / HARU / JOUCHO / KOKO / ALL）
2. **PLAY ARCHIVE** → 選択メンバーの曲がカードで表示
3. **カードビュー** → 上下スワイプで曲送り、タップでLP盤＋YouTube CTA
4. **← 左スワイプ** → WELCOMEに戻ってメンバー選び直し
5. カードビューのフィルターバー → メンバーチップの代わりに**タグチップ**

### デザインリファレンス
- WELCOME: AmazingUI Music App（S字カーブ回転ホイール）
- カードビュー: Milkinside Cards for music player（カードスタック）

### ステータス
プロトタイプ段階。本番統合（app.js / style.css への組み込み）は別PRで対応。

### 残タスク
- [ ] カードビューのメンバーチップをタグチップに置き換え
- [ ] ← 左スワイプでWELCOMEに戻る機能
- [ ] 2画面間のトランジション
- [ ] 本番コードへの統合
- [ ] Supabase APIとの接続
" \
  --base main
```

## 注意事項
- `vwp_welcome_scurve.html` は約180KBあります（メンバーアイコンのbase64が埋め込まれているため）。そのままコピーしてください。
- 既存の `public/index.html`, `public/app.js`, `public/style.css` には**一切変更を加えないでください**。プロトタイプファイルの追加のみです。
- `docs/` ディレクトリが存在しない場合は作成してください。
