import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/** ナレッジ記事のカテゴリ。追加するときは src/site.config.ts の categories も更新する。 */
export const KNOWLEDGE_CATEGORIES = ['shikumika', 'ai', 'web', 'marketing', 'sns'] as const;

/** サービスID。記事から関連サービスとして参照する。 */
export const SERVICE_IDS = ['web', 'sns', 'ai-dx'] as const;

const knowledge = defineCollection({
  loader: glob({ base: './src/content/knowledge', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string().max(60, 'titleは60文字以内（検索結果での省略を避ける）'),
    description: z.string().min(60).max(140, 'descriptionは60〜140文字'),
    category: z.enum(KNOWLEDGE_CATEGORIES),

    /** この記事が応える検索意図。記事テンプレートの起点であり、リライト判断にも使う。 */
    intent: z.string(),
    /** 主軸キーワード。1本の記事につき1つに絞る。 */
    primaryKeyword: z.string(),
    /** 補助キーワード。 */
    keywords: z.array(z.string()).default([]),

    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),

    /** 記事下部で誘導するサービス。導線を切らさないため最低1つ必須。 */
    relatedServices: z.array(z.enum(SERVICE_IDS)).min(1),
    /** 手動で指定する関連記事のslug。未指定ならカテゴリとキーワードから自動選出する。 */
    relatedArticles: z.array(z.string()).default([]),

    /** 一次情報（自社の実践）に基づく記事かどうか。一覧で優先表示する。 */
    firstParty: z.boolean().default(false),

    draft: z.boolean().default(false),
  }),
});

const caseStudy = defineCollection({
  loader: glob({ base: './src/content/case', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string().max(60),
    description: z.string().min(60).max(140),

    /** 事例の対象。自社案件は「シクミベース」、外部案件はクライアント名または匿名表記。 */
    client: z.string(),
    /** 自社で運営している事例か（イバトコなど）。 */
    isOwnProject: z.boolean().default(false),
    /** 外部公開URL。ある場合のみ。 */
    url: z.string().url().optional(),

    /** 課題・打ち手・結果。結果は検証できる事実のみを書く。 */
    challenge: z.string(),
    approach: z.array(z.string()).min(1),

    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),

    relatedServices: z.array(z.enum(SERVICE_IDS)).min(1),
    draft: z.boolean().default(false),
  }),
});

export const collections = { knowledge, case: caseStudy };
