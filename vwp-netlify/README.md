# V.W.P ARCHIVE

V.W.Pメンバーの動画を時系列で管理するアーカイブサイトです。

## フォルダ構成

```
vwp-archive/
├── netlify.toml              # Netlify設定
├── netlify/functions/
│   └── youtube.js            # YouTube API プロキシ（APIキーをサーバーに隠す）
└── public/
    └── index.html            # サイト本体
```

## デプロイ手順

### 1. GitHubにリポジトリを作成してプッシュ

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/vwp-archive.git
git push -u origin main
```

### 2. Netlifyでサイトを作成

1. [netlify.com](https://netlify.com) にログイン
2. 「Add new site」→「Import an existing project」
3. GitHubを選んで `vwp-archive` リポジトリを選択
4. Build settings はそのまま（netlify.toml が自動で読まれます）
5. 「Deploy site」をクリック

### 3. 環境変数にAPIキーを設定

1. Netlifyのサイト管理画面 →「Site configuration」→「Environment variables」
2. 「Add a variable」をクリック
3. Key: `YOUTUBE_API_KEY`、Value: `AIzaSy...（あなたのAPIキー）`
4. 「Save」→「Deploy」で再デプロイ

### 4. 動作確認

サイトを開いて動画追加（＋）→ URLを貼って「取得」ボタンを押し、
タイトル・公開日・サムネが自動入力されればOKです！

## ローカルでのテスト（任意）

Netlify CLIを使うとローカルでも Functions をテストできます。

```bash
npm install -g netlify-cli
netlify dev
```

`.env` ファイルを作成して：
```
YOUTUBE_API_KEY=AIzaSy...
```
