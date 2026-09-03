# シクミベース

茨城・近隣の住宅リフォーム会社向けに、問い合わせ対応、案件管理、見積フォローを仕組み化する事業ブランド「シクミベース」の公式サイトです。

主力商品は `リフォーム反響OS 30`。導入前商品は税別55,000円の `見積フォロー漏れ診断` です。

## 現在の位置づけ

現在、シクミベースは法人ではなく、山野辺雄太が個人で運営する事業ブランドです。
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
    service/reform-lead-os.astro   主力商品ページ
    diagnosis/reform-lead.astro    導入前診断ページ
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

1. Search Console と GA4 からデータを取得
2. 改善対象を判定（CTR低下 / 11〜30位 / 流入あり / CTA・フォーム離脱 / 露出なし）
3. 判定結果に合う商談直結キーワードを90日分の候補から選定
4. `docs/seo-log/` に判断と根拠を記録
5. 型チェック・ビルド・品質チェック
6. Pull Request を作成

**マージするまで公開されません。** 記事はGitHub Modelsで生成し、`draft: false` の公開候補としてPRに載り、型・ビルド・品質検査を通過します。内容と根拠を人が確認し、PRをマージするとCloudflare Pagesへ自動公開されます。AI原稿を無確認で公開する設定にはしていません。

導線に詰まりがある場合（判定ルールC）は新規記事を増やさず、既存ページの改善を優先します。設定済みのGA4またはSearch Consoleからデータを取得できない場合も、誤った判断を避けるため記事生成を停止し、エラーをレポートしてワークフローを失敗として表示します。

色・余白・文字サイズ・罫線は `src/styles/global.css` の CSS 変数で一元管理しています。
個別の値を直接書かず、変数を更新してください。

## 問い合わせ導線

サイト内の `/contact/` にフォームを持ち、送信は `functions/api/contact.ts` が受けます。
フォーム開始（`contact_form_start`）と送信完了（`generate_lead`）をGA4で計測できます。見積フォロー漏れ診断では、`diagnosis_form_start` と `diagnosis_application` も計測します。

CTAは設置場所ごとに `data-cta` を持ち、クリックが `cta_click` として記録されます。
どの導線が問い合わせにつながったかを、GA4で追えます。

相談内容は `?topic=` で引き継がれ、フォームの選択肢に初期反映されます。
`reform-audit` / `reform-os` の場合だけ、事業区分、月間反響数、平均工事単価、過去90日の営業数字、責任者参加などの適合確認項目を表示します。個人情報はGA4へ送信しません。

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

## 自動化のGoogle認証

Search ConsoleとGA4は、GitHub ActionsのWorkload Identity Federationで認証します。実行時だけ有効な短時間トークンを使うため、GitHubにサービスアカウントのJSON鍵を保存しません。

対象はワークフロー内で固定しています。

- Search Console: `sc-domain:shikumi-base.com`
- GA4プロパティID: `516899437`
- Google Cloudサービスアカウント: `shikumi-base-automation@ibatoco-seo.iam.gserviceaccount.com`

サービスアカウントには、Search Consoleの対象プロパティとGA4プロパティの閲覧権限が必要です。取得に失敗した日はワークフローを失敗として通知し、データなしの判断で記事を量産しません。

記事生成はGitHub Actionsの短時間トークンとGitHub Modelsを使うため、外部AIのAPIキーは不要です。ワークフローには `models: read` を付与し、記事の書き込みとPR作成は対象リポジトリ内に限定します。

Cloudflare Pages 側（Settings → Environment variables）には、
問い合わせフォームのために次が必要です。

| 変数 | 用途 |
| --- | --- |
| `RESEND_API_KEY` | メール送信 |
| `CONTACT_TO` | 通知の宛先 |
| `CONTACT_FROM` | 送信元（Resendで認証済みドメイン） |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstileによる迷惑送信防止 |

`RESEND_API_KEY` または `TURNSTILE_SECRET_KEY` が未設定の場合、フォームは503を返し、ページ上のメールアドレスが代替手段になります。Turnstileのサイトキーは公開情報のため、フォーム側に直接設定しています。

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
