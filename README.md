# いまここ (imakoko)

Swarm（Foursquare）の直近のチェックインを取得し、OS のシェアシート経由で任意のアプリに投げるための個人用 Web アプリ。

- バックエンド無し。GitHub Pages に置くだけの静的サイト
- 秘密情報はビルド成果物に一切含まれない（アクセストークンは各端末の localStorage のみ）
- 依存は Svelte だけ。ビルド後 45KB 程度

## シェアされる文面

シャウト（チェックイン時のコメント）がある場合:

```
ランチなう (@ スターバックス 渋谷店 in Shibuya, Tōkyō) https://www.swarmapp.com/user/123456789/checkin/59b97e2a0d173f01fd48252e?s=NGWtGIBccpKeOKH
```

無い場合:

```
I'm at スターバックス 渋谷店 in Shibuya, Tōkyō https://www.swarmapp.com/user/123456789/checkin/59b97e2a0d173f01fd48252e?s=NGWtGIBccpKeOKH
```

住所は `city, state` を連結するが、どちらかが欠けていれば自動的に畳まれる。
文面を変えたい場合は `src/lib/share.ts` の `buildShareText()` だけを直せばよい。

### URL について

API が返す `checkinShortUrl` は名前に反して短くない。100文字前後ある。末尾の `?s=` は
署名付きの共有トークンで、これがあることで他人がログイン無しに閲覧できる。
`www.swarmapp.com/c/...` のような短い形式は現在は存在しない（404 になる）。

X は投稿内のすべてのリンクを t.co でラップし、実際の長さに関係なく一律23文字として数えるため、
ツイートに関しては長さのデメリットは無い。

## セットアップ

### 1. Foursquare アプリを登録する

https://foursquare.com/developers/apps で新規アプリを作成し、**Redirect URI** に
`https://example.com/` を設定する。発行された **Client ID** と **Client Secret** を控える。

Redirect URI は「`code` を目視でコピーするためだけ」に使う。このアプリ自身の URL にすると
ページ側が URL を書き換えてしまうため、無関係な URL にしておくこと。

### 2. 認可して `code` を得る

以下を `CLIENT_ID` を差し替えてブラウザで開き、承認する。

```
https://foursquare.com/oauth2/authenticate?client_id=CLIENT_ID&response_type=code&redirect_uri=https%3A%2F%2Fexample.com%2F
```

`https://example.com/?code=XXXXX` に飛ぶので、URL バーの `code` の値をコピーする。

### 3. アクセストークンに交換する

手元のターミナルで実行する。**この手順でのみ Client Secret を使う。**

```bash
curl -s "https://foursquare.com/oauth2/access_token?client_id=CLIENT_ID&client_secret=CLIENT_SECRET&grant_type=authorization_code&redirect_uri=https%3A%2F%2Fexample.com%2F&code=CODE"
```

`{"access_token":"..."}` が返る。`redirect_uri` は手順1・2と完全一致させること
（末尾スラッシュまで）。ズレていると `invalid_grant` になる。

### 4. アプリに貼り付ける

公開した URL を開き、トークンを貼り付けて「確認して保存」。
`/users/self` を呼んで有効性を確認してから localStorage に保存する。

## 取得件数とレート制限

一覧は1ページ5件で、遡りたいときは「さかのぼる」で追加取得する（`src/lib/config.ts` の `PAGE_SIZE`）。

短縮URLは `/checkins/{id}` にしか含まれないため、1件につき1リクエストの先読みが要る。
つまり **1ページの読み込み = 一覧1回 + 詳細 PAGE_SIZE 回**。

Foursquare の personalization API は「エンドポイント群ごと・OAuth アプリごと・ユーザーごとに
1時間あたり500リクエスト」なので、`PAGE_SIZE = 5` なら詳細側は1時間に100回の読み込みが上限になる。
この値を増やすとそのぶん上限が下がる。

## 自動再取得

アプリが前面に戻ったとき（`visibilitychange` / `pageshow`）、先頭ページを取り直す。
Swarm でチェックインして戻ってきたときに手動更新が要らなくなる。

暴発を避けるためのガードが2つある。

- 直近の取得から `VISIBILITY_RELOAD_INTERVAL_MS`（60秒）以内なら何もしない。
  通知センターを下ろすだけでも `visible` は飛ぶため
- 「さかのぼる」で2ページ目以降を読んでいるときは走らせない。読んだぶんを勝手に捨てないため

## デプロイ

`main` に push すると GitHub Actions が GitHub Pages に公開する。
初回のみリポジトリの **Settings → Pages → Source** を **GitHub Actions** に設定する。

`vite.config.ts` の `base: './'` により相対パス出力になっているので、
リポジトリ名が何であってもサブパス配信で動く。

## 秘密情報の扱い

| 値 | 秘密か | 置き場所 |
|---|---|---|
| Client ID | いいえ（OAuth の仕様上公開前提） | どこでも可 |
| Client Secret | **はい** | 手順3のターミナルのみ。リポジトリにもコードにも入れない |
| アクセストークン | **はい**（チェックイン履歴が読める） | 各端末の localStorage のみ |

注意点が2つある。

**Vite の `VITE_` 環境変数はバンドルに埋め込まれる。** GitHub Actions の Secrets 経由で
渡しても公開 JS に平文で焼き込まれるので、秘密の受け渡しには使えない。このアプリは
そもそもビルド時に秘密を必要としない設計になっている。

**GitHub Pages のプロジェクトページは origin を共有する。** `https://<user>.github.io/` 配下の
全アプリで localStorage が共通になるため、どのプロジェクトにもサードパーティ製スクリプト
（アナリティクス、CDN ウィジェット等）を入れないこと。localStorage のキーには
`imakoko.` プレフィックスを付けて衝突を避けている。

## トークンの保存期間

localStorage に TTL は無く、基本的に無期限で残る。ただし **iOS / iPadOS の Safari** は
ITP により「Safari 使用7日分のあいだ、そのサイトへの操作が一度も無かった場合」に
localStorage を削除する。

**ホーム画面に追加した Web アプリはこの対象外**（Safari とは別枠で日数を数える）なので、
iPhone で使うならホーム画面に追加しておくのが確実。`manifest.webmanifest` と
`apple-touch-icon` を同梱済み。

消えてしまっても Foursquare v2 のトークンに期限は無いので、控えておいたトークンを
貼り直すだけでよい。

## 開発

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run check    # 型チェック
```
