#!/usr/bin/env node
/**
 * 商談に近い検索意図を持つ候補から、未作成のテーマを1件選ぶ。
 * GitHub Actions では選択結果を GITHUB_OUTPUT に渡す。
 */

import { existsSync, readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const CONTENT_DIR = 'src/content/knowledge';

const topics = [
  ['web', 'ホームページ リニューアル 費用', 'homepage-renewal-cost'],
  ['web', 'ホームページ 制作会社 選び方', 'homepage-company-choice'],
  ['web', 'ホームページ 保守 費用 相場', 'homepage-maintenance-cost'],
  ['web', '中小企業 ホームページ 必要性', 'small-business-homepage'],
  ['marketing', 'Web集客 外注 費用', 'web-marketing-outsourcing-cost'],
  ['marketing', '地方企業 Web集客', 'local-business-web-marketing'],
  ['marketing', '問い合わせ 増やす 方法 BtoB', 'increase-btob-inquiries'],
  ['sns', 'SNS運用代行 選び方', 'sns-agency-choice'],
  ['sns', '中小企業 SNS運用 何から', 'small-business-sns-start'],
  ['sns', 'Instagram 運用代行 費用', 'instagram-management-cost'],
  ['ai', '中小企業 AI導入 費用', 'small-business-ai-cost'],
  ['ai', '生成AI 社内導入 進め方', 'generative-ai-introduction'],
  ['ai', 'AI業務効率化 事例 中小企業', 'small-business-ai-examples'],
  ['ai', 'ChatGPT 社内利用 ガイドライン', 'chatgpt-company-guidelines'],
  ['shikumika', '業務マニュアル 作り方 中小企業', 'business-manual-guide'],
  ['shikumika', '業務属人化 解消 方法', 'reduce-key-person-dependency'],
  ['shikumika', '業務フロー 見直し 手順', 'business-flow-review'],
  ['shikumika', '中小企業 DX 何から始める', 'small-business-dx-start'],
];

const existing = existsSync(CONTENT_DIR)
  ? readdirSync(CONTENT_DIR)
      .filter((name) => name.endsWith('.md'))
      .map((name) => readFileSync(join(CONTENT_DIR, name), 'utf8'))
      .join('\n')
  : '';

const selected = topics.find(([, keyword, slug]) => {
  return !existsSync(join(CONTENT_DIR, `${slug}.md`)) && !existing.includes(`primaryKeyword: ${keyword}`);
});

const output = process.env.GITHUB_OUTPUT;

if (!selected) {
  console.log('未作成の記事テーマはありません。新しい候補の追加が必要です。');
  if (output) appendFileSync(output, 'has_topic=false\n');
  process.exit(0);
}

const [category, keyword, slug] = selected;
console.log(`本日の候補: [${category}] ${keyword} (${slug})`);

if (output) {
  appendFileSync(
    output,
    [`has_topic=true`, `category=${category}`, `keyword=${keyword}`, `slug=${slug}`, ''].join('\n')
  );
}

