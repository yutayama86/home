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
  pages/index.astro       各セクションを並べるだけのページ
  layouts/BaseLayout.astro  head・メタ情報・スクロール表示の共通処理
  components/             セクション単位のコンポーネント
    SiteHeader / Hero / About / Services /
    Process / Project / Operator / Contact / SiteFooter
  styles/global.css       デザイントークン（色・余白・文字サイズ・罫線）と共通パーツ
  site.config.ts          サイト情報と問い合わせ導線の設定
```

色・余白・文字サイズ・罫線は `src/styles/global.css` の CSS 変数で一元管理しています。
個別の値を直接書かず、変数を更新してください。

## 問い合わせ導線の設定

`src/site.config.ts` の `contact` で管理しています。値を入れると、ヘッダー・ファーストビュー・
問い合わせセクションのCTAがそのまま機能します。

```ts
export const contact = {
  formUrl: null,                    // フォームURL（設定すると優先される）
  email: 'info@shikumi-base.com',   // 問い合わせ用メールアドレス
};
```

導線の考え方：

- ヘッダー・ファーストビューの「相談する」は問い合わせセクションへスクロールする
  （いきなりメーラーを開かず、相談できる内容を読んでから送れるようにするため）
- 問い合わせセクションの「メールで相談する」が実際の `mailto:` になる
- `formUrl` を設定した場合は、ヘッダーとFVのCTAも直接フォームへ向かう
- 両方 `null` の場合は、動かないボタンやダミーの連絡先を出さず、案内文だけを表示する

## Deployment

公開先の想定ドメインは `https://shikumi-base.com/` です。
Cloudflare Pagesへ公開します。ビルドコマンドは `npm run build`、出力ディレクトリは `dist`、プロジェクト名は `shikumi-base` です。

`.github/workflows/build.yml` は `main` への push / PR でビルドが通るかを確認するチェックのみです。
公開はCloudflare PagesのGit連携で行われます（Actionsからのデプロイは設定していません）。

### 現在のドメイン状況（2026年8月25日時点）

- `https://shikumi-base.com/` … 本サイトを配信中（200）
- `https://shikumi-base.pages.dev/` … 本サイトを配信中（200）
- `https://www.shikumi-base.com/` … **525（SSLハンドシェイク失敗）**

`www` はCloudflare Pagesのカスタムドメインに未登録です。
Pagesプロジェクト → Custom domains → `www.shikumi-base.com` を追加し、
証明書が発行されるのを待つと解消します。

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
