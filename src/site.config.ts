/**
 * サイト全体の設定値。
 *
 * ここで未設定になっている値は「まだ実在しないもの」です。
 * 架空の連絡先やダミーURLを置かず、値が入った時点でUIが自動的に有効になります。
 */

export const site = {
  name: 'シクミベース',
  url: 'https://shikumi-base.com',
  title: 'シクミベース｜仕組みで、事業を強くする。',
  description:
    'シクミベースは、中小企業・地域企業の集客・営業・業務・情報発信を、属人的な頑張りではなく再現可能な仕組みに変える事業ブランドです。Web、SNS、AI、データは目的ではなく、仕組みを実装するための手段として活用します。',
  operator: '山野辺 雄太',
} as const;

export const contact: {
  formPath: string;
  email: string | null;
} = {
  formPath: '/contact/',
  email: 'info@shikumi-base.com',
};

export function ctaHref(topic?: string): string {
  return topic ? `${contact.formPath}?topic=${topic}` : contact.formPath;
}

export const analytics: {
  cloudflareToken: string | null;
  ga4MeasurementId: string | null;
} = {
  cloudflareToken: null,
  ga4MeasurementId: 'G-MZPH9X4CPP',
};
