/**
 * サイト全体の設定値。
 *
 * ここで未設定になっている値は「まだ実在しないもの」です。
 * 架空の連絡先やダミーURLを置かず、値が入った時点でUIが自動的に有効になります。
 */

export const site = {
  name: 'シクミベース',
  url: 'https://shikumi-base.com',
  title: 'シクミベース｜事業に、仕組みを。',
  description:
    'シクミベースは、中小企業・地域企業のWeb・集客・業務を、継続的に成果が積み上がる仕組みに整える事業ブランドです。',
  operator: '山野辺 雄太',
} as const;

/**
 * 問い合わせ導線。
 *
 * `formUrl` か `email` のどちらかに値を入れると、
 * ヘッダー・ファーストビュー・問い合わせセクションのCTAがそのまま機能します。
 * 両方 null の間は、動かないボタンを出さずに相談内容の案内だけを表示します。
 *
 * 例:
 *   formUrl: 'https://forms.gle/xxxxxxxx',
 *   email: 'contact@shikumi-base.com',
 */
export const contact: {
  formUrl: string | null;
  email: string | null;
} = {
  formUrl: null,
  email: 'info@shikumi-base.com',
};

/** 問い合わせ先が実際に用意されているか。 */
export const hasContactChannel = Boolean(contact.formUrl || contact.email);

/**
 * ヘッダー・ファーストビューのCTAリンク先。
 * メールの場合はいきなりメーラーを開かず、
 * 相談できる内容を読んでもらってから送れるよう問い合わせセクションへ送る。
 */
export function ctaHref(): string {
  return contact.formUrl ?? '#contact';
}

/** 問い合わせセクション内の実行ボタンのリンク先。 */
export function contactActionHref(): string | null {
  if (contact.formUrl) return contact.formUrl;
  if (contact.email) return `mailto:${contact.email}`;
  return null;
}

/** 外部フォームなら新しいタブで開く。 */
export function contactLinkAttrs(): Record<string, string> {
  return contact.formUrl
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};
}

/**
 * アクセス解析。
 *
 * Cloudflare Web Analytics を使用します。Cookieを使わず個人を追跡しないため、
 * 同意バナーは不要です。
 *
 * トークンの取得手順:
 *   Cloudflareダッシュボード → Analytics & Logs → Web Analytics
 *   → シクミベースのサイトを追加 → 表示されるスニペットの token 値をここへ貼る
 *
 * なお Cloudflare Pages の管理画面から Web Analytics を有効化すると
 * ビーコンが自動挿入されます。その方式を使う場合は、二重計測を避けるため
 * ここは null のままにしてください。
 */
export const analytics: {
  cloudflareToken: string | null;
} = {
  cloudflareToken: null,
};
