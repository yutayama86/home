/**
 * サイト全体で共有する分類とサービス定義。
 * Web・SNS・AIは単独商品ではなく、事業の仕組みを実装するための手段として扱う。
 */

import type { KNOWLEDGE_CATEGORIES, SERVICE_IDS } from '../content.config';

export type CategoryId = (typeof KNOWLEDGE_CATEGORIES)[number];
export type ServiceId = (typeof SERVICE_IDS)[number];

export interface Category {
  id: CategoryId;
  name: string;
  description: string;
  primaryService: ServiceId;
}

export const categories: Category[] = [
  {
    id: 'shikumika',
    name: '仕組み化',
    description: '属人化、社長依存、引き継ぎ不能を減らし、成果が再現できる事業運営へ変えるための考え方と実践を扱います。',
    primaryService: 'ai-dx',
  },
  {
    id: 'ai',
    name: 'AI・自動化',
    description: 'AIを導入すること自体ではなく、どの業務にどう組み込み、時間・品質・利益をどう改善するかを扱います。',
    primaryService: 'ai-dx',
  },
  {
    id: 'web',
    name: 'Web・営業資産',
    description: 'ホームページを制作物ではなく、見込み客に判断材料を届け続ける営業資産として機能させる方法を扱います。',
    primaryService: 'web',
  },
  {
    id: 'marketing',
    name: '集客・営業',
    description: '紹介や個人営業だけに依存せず、見込み客との接点から問い合わせ・商談までを積み上げる仕組みを扱います。',
    primaryService: 'web',
  },
  {
    id: 'sns',
    name: '発信の仕組み',
    description: 'SNSやコンテンツを担当者のセンスや気合いに依存させず、企画・制作・分析・改善まで回す方法を扱います。',
    primaryService: 'sns',
  },
];

export interface Service {
  id: ServiceId;
  name: string;
  shortName: string;
  en: string;
  summary: string;
  problems: string[];
  deliverables: string[];
  outcome: string;
  ctaLabel: string;
}

export const services: Service[] = [
  {
    id: 'web',
    name: '集客・営業の仕組み',
    shortName: '集客・営業',
    en: 'GROWTH SYSTEM',
    summary: '紹介や営業量だけに頼らず、見込み客が自ら情報を集め、比較し、相談できる流れをつくります。Web、SEO、コンテンツ、事例、問い合わせ導線を必要に応じて組み合わせます。',
    problems: [
      '営業し続けないと売上が止まる',
      '紹介や人脈への依存が大きい',
      'ホームページや発信が問い合わせにつながらない',
      '見込み客に何を伝えればよいか整理できていない',
      '問い合わせ後の商談化が担当者次第になっている',
    ],
    deliverables: [
      '顧客導線・営業プロセスの整理',
      'Webサイト・LP・SEOの設計と改善',
      '事例・比較材料・コンテンツ設計',
      '問い合わせ・商談化導線の改善',
      '計測環境と改善ルールの設計',
    ],
    outcome: '見込み客に必要な判断材料が継続的に届き、問い合わせと商談が特定の営業担当者だけに依存しない状態。',
    ctaLabel: '集客・営業の仕組みを相談する',
  },
  {
    id: 'sns',
    name: '発信の仕組み',
    shortName: '発信',
    en: 'CONTENT SYSTEM',
    summary: 'SNSやコンテンツを単発の投稿作業から、企画・制作・配信・分析・改善まで続く運用へ変えます。必要に応じて制作代行も行いますが、最終的には型とデータが残る状態を目指します。',
    problems: [
      '投稿が担当者の気分や忙しさで止まる',
      '何を発信すればよいか毎回悩む',
      '担当者が代わると運用が止まる',
      'フォロワーは増えても事業成果につながらない',
    ],
    deliverables: [
      '発信テーマ・企画ルールの設計',
      'SNS・コンテンツ制作フローの標準化',
      '投稿・レビュー・公開体制の設計',
      'KPIと改善サイクルの構築',
      '必要に応じた制作・運用支援',
    ],
    outcome: '誰が担当しても一定品質で発信が続き、蓄積したコンテンツが集客・採用・信用形成に使われる状態。',
    ctaLabel: '発信の仕組みを相談する',
  },
  {
    id: 'ai-dx',
    name: '業務・改善の仕組み',
    shortName: '業務改善',
    en: 'OPERATIONS SYSTEM',
    summary: '社長や特定担当者に集中した仕事を整理し、手順・役割・データ・AIを組み合わせて、引き継げる・改善できる業務へ変えます。',
    problems: [
      '社長や一部の担当者に仕事が集中している',
      '同じ作業を何度も手作業で繰り返している',
      'やり方が人によって違う',
      'AIやツールを導入したが定着していない',
      '業務を引き継げず、人を増やしても楽にならない',
    ],
    deliverables: [
      '業務フローと役割の整理',
      '手順・テンプレート・判断基準の標準化',
      'AI・自動化の業務組み込み',
      'データ・KPI・変更履歴の整備',
      '運用ルールと改善サイクルの設計',
    ],
    outcome: '特定の人がいなくても業務が止まりにくくなり、人は判断・顧客対応・企画など価値の高い仕事に時間を使える状態。',
    ctaLabel: '業務の仕組みを相談する',
  },
];

export function getCategory(id: CategoryId): Category {
  const found = categories.find((c) => c.id === id);
  if (!found) throw new Error(`未定義のカテゴリ: ${id}`);
  return found;
}

export function getService(id: ServiceId): Service {
  const found = services.find((s) => s.id === id);
  if (!found) throw new Error(`未定義のサービス: ${id}`);
  return found;
}
