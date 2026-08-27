# シクミベース

中小企業・地域企業のWeb・集客・業務を、継続的に成果が積み上がる仕組みに整える事業ブランド「シクミベース」の公式サイトです。

## 現在の位置づけ

2026年8月現在、シクミベースは法人ではなく、山野辺雄太が個人で運営する事業ブランドです。
法人設立後は、運営主体・会社情報・契約主体などの表記を更新します。

## Tech

- Astro
- Static Site Generation
- @astrojs/sitemap
- 外部UIライブラリなし／外部JSバンドルなし（スクリプトは最小限のインラインのみ）

## Commands

```bash
npm install
npm run dev
npm run build
npm run check
```

## 構成

```
src/
  content/                記事の実体（Markdown）
    knowledge/            ナレッジ記事
    case/                 事例
  content.config.ts       記事のスキーマ。満たさない記事はビルドが通らない
  data/taxonomy.ts        カテゴリとサービスの定義（ナビ・CTA・構造化データの元）
  pages/                  ルーティング
  layouts/                BaseLayout / PageLayout / ArticleLayout
  components/             共通UI
  styles/global.css       デザイントークンと記事本文のスタイル
  site.config.ts          サイト情報・問い合わせ導線・アクセス解析の設定
functions/api/contact.ts  問い合わせフォームの受け口（Cloudflare Pages Functions）
scripts/                  品質チェックと毎日の改善判定
docs/seo-log/             日々の変更履歴
```

### 記事を追加する

`src/content/knowledge/` に Markdown を置くだけです。URL、パンくず、構造化データ、
関連記事、サービスへのCTAは frontmatter から自動生成されます。

```bash
npm run verify   # 型チェック → ビルド → 品質チェック
```

関連記事は `relatedArticles` を書けばそれが優先され、書かなければ
カテゴリ・サービス・キーワードの重なりから自動で選ばれます。

### 品質チェック

`scripts/quality-check.mjs` が次を検査し、**1件でもエラーがあれば公開されません**。

- 出典のない成果数値（「◯%向上」など）
- 法人と誤認される表記（「株式会社シクミベース」「代表取締役」）
- 法務・税務・成果の断定
- 検索意図・主軸キーワードの未設定
- サイト内リンクの欠如
- title / description の長さ
- 日本語で強調が反映されていない箇所（`**「〜」**` の flanking 問題）

### 毎日の改善サイクル

`.github/workflows/daily-content.yml` が毎朝7時（JST）に実行されます。

1. Search Console からデータを取得
2. 改善対象を判定（CTR低下 / 11〜30位 / 流入あり / 露出なし）
3. `docs/seo-log/` に判断と根拠を記録
4. 型チェック・ビルド・品質チェック
5. Pull Request を作成

**マージするまで公開されません。** 品質の最終判断は人が行う設計です。

手動実行時にキーワードを指定すると、記事の下書きも生成します。
生成物は必ず `draft: true` で出力されるため、内容を確認して
`draft: false` に変えるまで公開されません。

色・余白・文字サイズ・罫線は `src/styles/global.css` の CSS 変数で一元管理しています。
個別の値を直接書かず、変数を更新してください。

## 問い合わせ導線

サイト内の `/contact/` にフォームを持ち、送信は `functions/api/contact.ts` が受けます。
フォーム開始（`form_start`）と送信完了（`generate_lead`）をGA4で計測できます。

CTAは設置場所ごとに `data-cta` を持ち、クリックが `cta_click` として記録されます。
どの導線が問い合わせにつながったかを、GA4で追えます。

相談内容は `?topic=` で引き継がれ、フォームの選択肢に初期反映されます。

## Deployment

公開先の想定ドメインは `https://shikumi-base.com/` です。
Cloudflare Pagesへ公開します。ビルドコマンドは `npm run build`、出力ディレクトリは `dist`、プロジェクト名は `shikumi-base` です。

`.github/workflows/build.yml` は `main` への push / PR でビルドが通るかを確認するチェックのみです。
公開はCloudflare PagesのGit連携で行われます（Actionsからのデプロイは設定していません）。

### 現在のドメイン状況

- `https://shikumi-base.com/` … 本サイトを配信中
- `https://www.shikumi-base.com/` … 本サイトを配信中
- `https://shikumi-base.pages.dev/` … 本サイトを配信中

### robots.txt について

本番の `/robots.txt` は、リポジトリ内の `public/robots.txt` の手前に
Cloudflareの管理ブロック（Managed robots.txt / AI Crawl Control）が自動で注入されます。
Googlebotは許可されたままなので検索インデックスには影響しませんが、
GPTBot・ClaudeBot・Google-Extended などのAIクローラーは拒否されます。
変更する場合はCloudflareダッシュボード側の設定です（リポジトリでは制御できません）。

## OGP画像

SNSでシェアされたときに表示される画像は `public/og.png`（1200×630）です。
版下は `tools/og-image.html` で、サイトのファーストビューと同じ構成にしてあります。

文言やブランドを変更したら、版下を編集して再生成します。

```bash
npm run og
```

Google Chromeのヘッドレスモードで書き出すため、追加の依存パッケージは不要です。
生成した `public/og.png` はリポジトリにコミットします（ビルド時には生成されません）。

## アクセス解析

2種類を併用しています。設定は `src/site.config.ts` の `analytics` にまとまっています。

### Cloudflare Web Analytics

Cookieを使わず個人を追跡しない軽量な計測です。
現在は **Cloudflare Pages 側の管理画面で有効化** しており、ビーコンはCloudflareが
エッジで自動挿入します。そのため `cloudflareToken` は `null` のままにしてください。

ここに値を入れるとタグが二重になり、二重計測になります。
自前でタグを出す方式に切り替える場合のみ、Cloudflareダッシュボード →
Analytics & Logs → Web Analytics で取得したトークンを設定します。

### Google Analytics 4

流入元やユーザー行動の詳細分析用です。測定ID（`G-` で始まる）を設定します。

```ts
export const analytics = {
  cloudflareToken: null,
  ga4MeasurementId: 'G-XXXXXXXXXX',
};
```

測定IDの場所は GA4 → 管理 → データストリーム → 対象のウェブストリームです。
`null` の間は、タグ自体が出力されません。

> GA4はCookieを使うため、プライバシーポリシーでの説明が必要です。
> Cloudflare Web Analytics だけの構成に戻す場合は `ga4MeasurementId` を `null` にします。

## 自動化に必要なシークレット

GitHub リポジトリの Settings → Secrets and variables → Actions に設定します。

| シークレット | 用途 | 未設定のときの挙動 |
| --- | --- | --- |
| `GSC_SERVICE_ACCOUNT_JSON` | Search Console API のサービスアカウント鍵 | サイト内の状態だけで改善対象を判定 |
| `GSC_SITE_URL` | 対象プロパティ（`sc-domain:shikumi-base.com`） | 同上 |
| `ANTHROPIC_API_KEY` | 記事の下書き生成 | 生成をスキップ（レポートとログは出る） |

Cloudflare Pages 側（Settings → Environment variables）には、
問い合わせフォームのために次が必要です。

| 変数 | 用途 |
| --- | --- |
| `RESEND_API_KEY` | メール送信 |
| `CONTACT_TO` | 通知の宛先 |
| `CONTACT_FROM` | 送信元（Resendで認証済みドメイン） |

未設定の場合、フォームは503を返し、ページ上のメールアドレスが代替手段になります。

## Search Console

ドメインプロパティ（DNS認証）で登録します。`www` やサブドメインもまとめて検証されるため、
サイト側のコード変更は不要です。

1. Search Console → プロパティを追加 → **「ドメイン」** を選び `shikumi-base.com` を入力
2. 表示された `google-site-verification=…` の値をコピー
3. Cloudflare → `shikumi-base.com` → DNS → レコードを追加
   - Type: `TXT` / Name: `@` / Content: コピーした値
4. Search Consoleに戻って「確認」
5. 左メニューの「サイトマップ」で `sitemap-index.xml` を送信

サイトマップは `@astrojs/sitemap` がビルド時に生成し、`public/robots.txt` からも参照しています。

## 法人化後に更新する箇所

- 運営主体表記
- 会社概要／法人番号等（必要に応じて）
- 契約・請求主体
- プライバシーポリシー／特商法表記（提供・販売方法に応じて）
- 問い合わせ窓口
