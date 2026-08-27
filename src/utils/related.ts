import type { CollectionEntry } from 'astro:content';

type Article = CollectionEntry<'knowledge'>;
type CaseStudy = CollectionEntry<'case'>;

/**
 * 関連記事を選ぶ。
 *
 * frontmatter の relatedArticles を最優先し、足りない分をスコアで補う。
 * これにより「手動で必ず結びたい記事」を保証しつつ、
 * 記事が増えるほど自動でも内部リンクが張られる状態になる。
 */
export function selectRelated(current: Article, all: Article[], limit = 4): Article[] {
  const pool = all.filter((a) => a.id !== current.id && !a.data.draft);
  const picked: Article[] = [];

  // 1. 手動指定
  for (const slug of current.data.relatedArticles) {
    const found = pool.find((a) => a.id === slug);
    if (found && !picked.includes(found)) picked.push(found);
  }

  // 2. スコア順に補充
  const scored = pool
    .filter((a) => !picked.includes(a))
    .map((a) => ({ article: a, score: score(current, a) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // 同点なら新しい記事を優先
      return b.article.data.publishedAt.getTime() - a.article.data.publishedAt.getTime();
    });

  for (const { article } of scored) {
    if (picked.length >= limit) break;
    picked.push(article);
  }

  return picked.slice(0, limit);
}

function score(a: Article, b: Article): number {
  let total = 0;

  // 同じカテゴリは強い関連
  if (a.data.category === b.data.category) total += 3;

  // 同じサービスへ誘導する記事同士も関連が深い
  const sharedServices = a.data.relatedServices.filter((s) => b.data.relatedServices.includes(s));
  total += sharedServices.length * 2;

  // キーワードの重なり
  const aKeywords = new Set([a.data.primaryKeyword, ...a.data.keywords]);
  const bKeywords = [b.data.primaryKeyword, ...b.data.keywords];
  total += bKeywords.filter((k) => aKeywords.has(k)).length;

  return total;
}

/* 下書きを除いて新しい順に並べる。
   ジェネリクスにすると呼び出し側で型が制約側へ潰れるため、コレクションごとに分けている。 */

export function publishedSorted(entries: Article[]): Article[] {
  return sortByPublished(entries.filter((e) => !e.data.draft));
}

export function publishedCases(entries: CaseStudy[]): CaseStudy[] {
  return sortByPublished(entries.filter((e) => !e.data.draft));
}

function sortByPublished<T extends Article | CaseStudy>(entries: T[]): T[] {
  return [...entries].sort(
    (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime()
  );
}
