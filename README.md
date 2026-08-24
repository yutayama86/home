# シクミベース

中小企業・地域企業のWeb・集客・業務を、継続的に成果が積み上がる仕組みに整える事業ブランド「シクミベース」の公式サイトです。

## 現在の位置づけ

2026年8月現在、シクミベースは法人ではなく、山野辺雄太が個人で運営する事業ブランドです。
法人設立後は、運営主体・会社情報・契約主体などの表記を更新します。

## Tech

- Astro
- Static Site Generation
- @astrojs/sitemap

## Commands

```bash
npm install
npm run dev
npm run build
```

## Deployment

公開先の想定ドメインは `https://shikumi-base.com/` です。
Cloudflare Pagesへ公開します。ビルドコマンドは `npm run build`、出力ディレクトリは `dist`、プロジェクト名は `shikumi-base` です。

`main` ブランチへの反映時にGitHub Actionsから自動公開されます。GitHubリポジトリには次のActions secretsが必要です。

- `CLOUDFLARE_API_TOKEN`（Cloudflare Pagesの編集権限を持つAPIトークン）
- `CLOUDFLARE_ACCOUNT_ID`

初回のみCloudflare Pagesプロジェクトの作成と、`shikumi-base.com` / `www.shikumi-base.com` のカスタムドメイン接続が必要です。

## 法人化後に更新する箇所

- 運営主体表記
- 会社概要／法人番号等（必要に応じて）
- 契約・請求主体
- プライバシーポリシー／特商法表記（提供・販売方法に応じて）
- 問い合わせ窓口
