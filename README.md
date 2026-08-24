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

### 現在のドメイン状況（2026年8月時点）

- `https://shikumi-base.pages.dev/` … 本サイトが公開されている
- `https://shikumi-base.com/` … 別サービス（studio.design）を向いており404
- `https://www.shikumi-base.com/` … 名前解決されない

`shikumi-base.com` を本サイトへ向けるには、Cloudflare Pagesのカスタムドメイン接続と
DNSの切り替えが必要です。`astro.config.mjs` の `site` と canonical は
`https://shikumi-base.com` のままにしてあります。

## 法人化後に更新する箇所

- 運営主体表記
- 会社概要／法人番号等（必要に応じて）
- 契約・請求主体
- プライバシーポリシー／特商法表記（提供・販売方法に応じて）
- 問い合わせ窓口
