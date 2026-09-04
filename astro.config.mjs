import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const SITE = 'https://shikumi-base.com';

function collectLastmod() {
  const map = new Map();

  const read = (dir, toPath) => {
    if (!existsSync(dir)) return;

    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const raw = readFileSync(join(dir, file), 'utf-8');
      const field = (key) => raw.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))?.[1]?.trim();
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
const newest = [...lastmodByUrl.values()].sort((a, b) => b - a)[0] ?? new Date();

const legacyPaths = [
  '/service/reform-lead-os/',
  '/diagnosis/reform-lead/',
];

export default defineConfig({
  site: SITE,
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/contact/thanks/') &&
        !legacyPaths.some((path) => page === `${SITE}${path}`),

      serialize(item) {
        const lastmod = lastmodByUrl.get(item.url);

        if (lastmod) {
          item.lastmod = lastmod.toISOString();
          item.changefreq = 'monthly';
          item.priority = 0.7;
        } else if (item.url === `${SITE}/`) {
          item.lastmod = newest.toISOString();
          item.changefreq = 'weekly';
          item.priority = 1.0;
        } else if (item.url.includes('/service/')) {
          item.changefreq = 'monthly';
          item.priority = 0.85;
        } else if (item.url.includes('/knowledge/') || item.url.includes('/case/')) {
          item.lastmod = newest.toISOString();
          item.changefreq = 'weekly';
          item.priority = 0.65;
        } else if (item.url.endsWith('/contact/') || item.url.endsWith('/about/')) {
          item.changefreq = 'monthly';
          item.priority = 0.6;
        } else {
          item.changefreq = 'yearly';
          item.priority = 0.3;
        }

        return item;
      },
    }),
  ],
});
