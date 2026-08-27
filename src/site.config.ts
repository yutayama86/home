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
 * サイト内の /contact/ にフォームを持ち、送信は Cloudflare Pages Functions
 * （functions/api/contact.ts）が受けます。フォーム開始・完了までGA4で計測できます。
 *
 * `email` はフォームが使えない場合の代替手段としてページ下部に表示します。
 */
export const contact: {
  /** サイト内フォームのパス。 */
  formPath: string;
  /** 代替の連絡先。null なら表示しない。 */
  email: string | null;
} = {
  formPath: '/contact/',
  email: 'info@shikumi-base.com',
};

/** すべてのCTAのリンク先。相談内容は遷移先で選ぶ。 */
export function ctaHref(topic?: string): string {
  return topic ? `${contact.formPath}?topic=${topic}` : contact.formPath;
}

/**
 * アクセス解析。2種類を併用しています。
 *
 * ■ Cloudflare Web Analytics（cloudflareToken）
 *   Cookieを使わず個人を追跡しない軽量な計測。
 *   現在は Cloudflare Pages 側の管理画面で有効化しており、ビーコンは
 *   Cloudflareがエッジで自動挿入します。そのため、ここは null のままにします。
 *   （値を入れるとタグが二重になり、二重計測になります）
 *
 * ■ Google Analytics 4（ga4MeasurementId）
 *   流入元やユーザー行動の詳細分析用。「G-」で始まる測定IDを設定します。
 *   Cookieを使うため、プライバシーポリシーでの説明が必要です。
 *   測定IDの場所: GA4 → 管理 → データストリーム → 対象のウェブストリーム
 */
export const analytics: {
  cloudflareToken: string | null;
  ga4MeasurementId: string | null;
} = {
  cloudflareToken: null,
  ga4MeasurementId: 'G-MZPH9X4CPP',
};
