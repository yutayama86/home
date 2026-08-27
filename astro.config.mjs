import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const SITE = 'https://shikumi-base.com';

/**
 * 記事の更新日を集める。
 *
 * サイトマップに lastmod を入れておくと、Googleがどのページを再クロールすべきか
 * 判断できる。毎日リライトを回す前提のサイトでは、これがないと更新が伝わりにくい。
 *
 * astro.config はコンテンツ読み込みより前に評価されるため、
 * frontmatter を直接読む。
 */
function collectLastmod() {
  const map = new Map();

  const read = (dir, toPath) => {
    if (!existsSync(dir)) return;

    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;

      const raw = readFileSync(join(dir, file), 'utf-8');
      const field = (key) => raw.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))?.[1]?.trim();

      // 下書きはページ自体が生成されないので対象外
      if (field('draft') === 'true') continue;

      const date = field('updatedAt') || field('publishedAt');
      if (!date) continue;

      const path = toPath(basename(file, '.md'), field('category'));
      if (path) map.set(path, new Date(date));
    }
  };

  read('./src/content/knowledge', (slug, category) =>
    category ? `${SITE}/knowledge/${category}/${slug}/` : null
  );
  read('./src/content/case', (slug) => `${SITE}/case/${slug}/`);

  return map;
}

const lastmodByUrl = collectLastmod();

/** 記事が1本もない一覧ページ用に、サイト全体で最も新しい更新日を持っておく。 */
const newest = [...lastmodByUrl.values()].sort((a, b) => b - a)[0] ?? new Date();

export default defineConfig({
  site: SITE,
  integrations: [
    sitemap({
      /* 検索結果に出したくないページはサイトマップからも外す。
         noindex を付けたページを載せると、Googleに矛盾した指示を出すことになる。 */
      filter: (page) => !page.includes('/contact/thanks/'),

      serialize(item) {
        const lastmod = lastmodByUrl.get(item.url);

        if (lastmod) {
          // 記事ページ：自身の更新日
          item.lastmod = lastmod.toISOString();
          item.changefreq = 'monthly';
          item.priority = 0.7;
        } else if (item.url === `${SITE}/`) {
          item.lastmod = newest.toISOString();
          item.changefreq = 'weekly';
          item.priority = 1.0;
        } else if (item.url.includes('/service/')) {
          // 問い合わせに最も近いページ
          item.changefreq = 'monthly';
          item.priority = 0.9;
        } else if (item.url.includes('/knowledge/') || item.url.includes('/case/')) {
          // 一覧ページ：記事が増えるたびに内容が変わる
          item.lastmod = newest.toISOString();
          item.changefreq = 'weekly';
          item.priority = 0.6;
        } else if (item.url.endsWith('/contact/') || item.url.endsWith('/about/')) {
          // 問い合わせ先と運営者情報。更新頻度は低いが、
          // 検索結果に出す優先度は規約類より高い。
          item.changefreq = 'monthly';
          item.priority = 0.5;
        } else {
          item.changefreq = 'yearly';
          item.priority = 0.3;
        }

        return item;
      },
    }),
  ],
});
