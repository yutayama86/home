/**
 * サイト全体で共有する分類とサービス定義。
 * ナビゲーション、記事の関連サービス、構造化データ、CTAがすべてここを参照する。
 */

import type { KNOWLEDGE_CATEGORIES, SERVICE_IDS } from '../content.config';

export type CategoryId = (typeof KNOWLEDGE_CATEGORIES)[number];
export type ServiceId = (typeof SERVICE_IDS)[number];

export interface Category {
  id: CategoryId;
  name: string;
  /** 一覧ページの導入文。カテゴリの検索意図を1文で示す。 */
  description: string;
  /** このカテゴリの記事から主に誘導するサービス。 */
  primaryService: ServiceId;
}

export const categories: Category[] = [
  {
    id: 'shikumika',
    name: '仕組み化',
    description:
      '社長や特定の担当者に依存した状態から抜け出し、人が代わっても回る形をつくるための考え方と手順をまとめています。',
    primaryService: 'ai-dx',
  },
  {
    id: 'ai',
    name: 'AI・DX',
    description:
      'AIをどこから業務に組み込むか。中小企業が実際に成果を出しやすい使い方と、向かない領域の見分け方を扱います。',
    primaryService: 'ai-dx',
  },
  {
    id: 'web',
    name: 'Web',
    description:
      'ホームページから問い合わせが来ない原因、制作費用の考え方、依頼先の選び方など、Webサイトの投資判断に必要な情報を扱います。',
    primaryService: 'web',
  },
  {
    id: 'marketing',
    name: 'マーケティング',
    description:
      '限られた人員と予算で集客を続けるために、どの施策から手を付けるべきかを整理します。',
    primaryService: 'web',
  },
  {
    id: 'sns',
    name: 'SNS',
    description:
      '投稿が続かない、成果が見えないSNS運用を、担当者に依存せず回る形へ変えるための実務をまとめています。',
    primaryService: 'sns',
  },
];

export interface Service {
  id: ServiceId;
  name: string;
  /** ナビゲーションなどで使う短い名前。 */
  shortName: string;
  en: string;
  /** サービスページのリード文。 */
  summary: string;
  /** このサービスが解く課題。訪問者が自分ごと化できる言葉で書く。 */
  problems: string[];
  /** 提供内容。 */
  deliverables: string[];
  /** 目指す状態。 */
  outcome: string;
  /** CTAの文言。「お問い合わせ」ではなく相談内容が分かる言葉にする。 */
  ctaLabel: string;
}

export const services: Service[] = [
  {
    id: 'web',
    name: 'Web改善・制作',
    shortName: 'Web改善・制作',
    en: 'WEB',
    summary:
      '見られて終わりのサイトを、問い合わせと採用につながる事業基盤に変えます。作り直しありきではなく、いまのサイトを活かせるなら改修から始めます。',
    problems: [
      'ホームページから問い合わせが来ない',
      'サイトが古く、事業の実態と合っていない',
      '自社で更新できず、情報が止まっている',
      '検索で見つけてもらえない',
      '見てもらえても、問い合わせまでたどり着かない',
    ],
    deliverables: [
      'Webサイト制作・リニューアル',
      'ランディングページ制作',
      'SEO設計と実装',
      '問い合わせまでの導線改善',
      'コンテンツ設計',
      '既存サイトの部分改修',
    ],
    outcome: '公開後も自社で更新でき、どの施策が問い合わせにつながったかを数字で確認できる状態。',
    ctaLabel: 'Webの改善について相談する',
  },
  {
    id: 'sns',
    name: 'SNS運用・仕組み化',
    shortName: 'SNS運用',
    en: 'SOCIAL',
    summary:
      '単発で終わる投稿を、企画から改善まで循環する運用に変えます。代行して終わりではなく、社内で回せる型を残すことを重視します。',
    problems: [
      '投稿が続かない',
      '担当者が代わると止まってしまう',
      '成果が出ているのか分からない',
      '何を投稿すればいいか分からない',
    ],
    deliverables: [
      'Instagram / Threads / X の運用',
      'コンテンツ企画',
      '投稿制作',
      '運用体制の設計',
      '分析と改善',
    ],
    outcome: '担当が代わっても同じ質で発信が続き、投稿が問い合わせや採用につながる状態。',
    ctaLabel: 'SNS運用について相談する',
  },
  {
    id: 'ai-dx',
    name: 'AI・業務改善',
    shortName: 'AI・業務改善',
    en: 'AI / OPERATIONS',
    summary:
      '人の頑張りに頼っていた業務を、仕組みが支える形に変えます。ツールの導入自体を目的にせず、どの業務のどこを変えるかから整理します。',
    problems: [
      '人手が足りない',
      '特定の人しかできない業務がある',
      'ムダな作業に時間を取られている',
      'AIを使いたいが、何から始めればいいか分からない',
    ],
    deliverables: [
      'ChatGPT / Claude / Gemini の業務活用',
      '業務フローの整理と改善',
      '手順書・マニュアル化',
      '定型作業の自動化',
      '社内標準の設計',
    ],
    outcome: '属人化とムダが減り、判断と改善に時間を使える状態。',
    ctaLabel: 'AI・業務改善について相談する',
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
