#!/usr/bin/env node
/** 生成済みサイトのsitemap、canonical、indexabilityの矛盾を公開前に検出する。 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const SITE = 'https://shikumi-base.com';
const errors = [];
const fail = (message) => errors.push(message);
const read = (path) => readFileSync(path, 'utf8');

for (const file of ['sitemap-index.xml', 'sitemap-0.xml', 'robots.txt']) {
  if (!existsSync(join(DIST, file))) fail(`${file} がありません`);
}

if (errors.length === 0) {
  const index = read(join(DIST, 'sitemap-index.xml'));
  const sitemap = read(join(DIST, 'sitemap-0.xml'));
  const robots = read(join(DIST, 'robots.txt'));
  if (!index.includes(`<loc>${SITE}/sitemap-0.xml</loc>`)) fail('サイトマップindexの参照先が不正です');
  if (!robots.includes(`Sitemap: ${SITE}/sitemap-index.xml`)) fail('robots.txtのサイトマップURLが不正です');
  if (/Disallow:\s*\/$/m.test(robots)) fail('robots.txtがサイト全体を拒否しています');

  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  if (urls.length < 20) fail(`サイトマップ掲載URLが少なすぎます（${urls.length}件）`);
  if (new Set(urls).size !== urls.length) fail('サイトマップに重複URLがあります');

  for (const url of urls) {
    if (!url.startsWith(`${SITE}/`)) {
      fail(`正規ドメイン以外のURLがあります: ${url}`);
      continue;
    }
    const pathname = new URL(url).pathname;
    const file = pathname === '/' ? join(DIST, 'index.html') : join(DIST, pathname, 'index.html');
    if (!existsSync(file)) {
      fail(`サイトマップURLのHTMLがありません: ${url}`);
      continue;
    }
    const html = read(file);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
    if (canonical !== url) fail(`canonical不一致: ${url} -> ${canonical || 'なし'}`);
    if (/<meta name="robots" content="[^"]*noindex/i.test(html)) fail(`noindexページがサイトマップに含まれています: ${url}`);
    if (!/<title>[^<]+<\/title>/i.test(html)) fail(`titleがありません: ${url}`);
    if (!/<meta name="description" content="[^"]+"/i.test(html)) fail(`descriptionがありません: ${url}`);
  }
  console.log(`SEO監査: サイトマップ掲載 ${urls.length} URLを検査しました`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}
console.log('SEO監査にエラーはありません。');
