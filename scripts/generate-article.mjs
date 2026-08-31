#!/usr/bin/env node
/**
 * daily-growth の判断にもとづいて、記事の下書きを生成する。
 *
 * 生成物は必ず draft: true で出力し、そのままでは公開されない。
 * 人が内容を確認して draft: false に変えたときにはじめて公開される。
 *
 * 必要な環境変数:
 *   ANTHROPIC_API_KEY
 *
 * 使い方:
 *   node scripts/generate-article.mjs --category shikumika --keyword "業務標準化 進め方"
 */

import { writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

// モデル名はGitHub Actionsの変数で更新できるようにし、コード変更を不要にする。
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const KNOWLEDGE_DIR = 'src/content/knowledge';

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

const category = arg('category');
const keyword = arg('keyword');
const slug = arg('slug') ?? (keyword ? slugify(keyword) : null);
const publishedAt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

if (!category || !keyword || !slug) {
  console.error('使い方: node scripts/generate-article.mjs --category <id> --keyword "<キーワード>" [--slug <slug>]');
  process.exit(1);
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY が設定されていないため、記事生成をスキップします。');
  process.exit(0);
}

function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60) || `article-${Date.now()}`;
}

const outPath = join(KNOWLEDGE_DIR, `${slug}.md`);
if (existsSync(outPath)) {
  console.error(`既に存在します: ${outPath}`);
  process.exit(1);
}

/** 既存記事の一覧を渡し、内部リンクを張れるようにする。 */
function existingArticles() {
  if (!existsSync(KNOWLEDGE_DIR)) return [];
  return readdirSync(KNOWLEDGE_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const raw = readFileSync(join(KNOWLEDGE_DIR, file), 'utf-8');
      const title = raw.match(/^title:\s*(.*)$/m)?.[1] ?? '';
      const cat = raw.match(/^category:\s*(.*)$/m)?.[1] ?? '';
      return `- ${title} → /knowledge/${cat}/${basename(file, '.md')}/`;
    });
}

const prompt = `あなたは、シクミベースというWeb・マーケティング支援の事業ブランドのために記事を書きます。

## シクミベースについて
- 山野辺雄太が個人で運営する事業ブランドです。法人ではありません。
- 「株式会社シクミベース」「代表取締役」という表記は絶対に使わないでください。
- 中小企業・地域企業のWeb改善、SNS運用、AI活用・業務改善を支援しています。

## 今回書く記事
- カテゴリ: ${category}
- 主軸キーワード: ${keyword}

## 絶対に守ること
1. **実績や数値を捏造しない。** 「弊社の支援で問い合わせが3倍になりました」のような検証できない実績は書かない。
2. **出典のない統計を書かない。** 数値を出す場合は必ず出典URLをMarkdownリンクで添える。曖昧なら数値を出さない。
3. **法務・税務・労務を断定しない。** 「専門家に確認してください」と書く。
4. 存在しない制度・サービス・機能を書かない。
5. 「いかがでしたでしょうか」「本記事では〜解説していきます」のような定型表現を使わない。
6. キーワードを不自然に繰り返さない。

## 記事の構成
必ず次を含めてください。
- 冒頭で読者の状況に触れる（2〜3行）
- 「## 結論：〜」で先に答えを出す
- 読者の課題の説明
- 具体的な解決方法（手順や判断基準）
- 注意点・失敗しやすい進め方
- 「## まとめ」で箇条書き
- 本文中に既存記事またはサービスページへのリンクを2つ以上

## 内部リンクに使える既存記事
${existingArticles().join('\n') || '（まだありません）'}

## サービスページ
- /service/web/ … Web改善・制作
- /service/sns/ … SNS運用・仕組み化
- /service/ai-dx/ … AI・業務改善

## 出力形式
以下のfrontmatterから始まるMarkdownだけを出力してください。説明文は不要です。

---
title: （60文字以内）
description: （60〜140文字）
category: ${category}
intent: （この記事が答える検索意図を1文で）
primaryKeyword: ${keyword}
keywords:
  - （関連キーワード）
publishedAt: ${publishedAt}
relatedServices:
  - （web / sns / ai-dx から1つ以上）
firstParty: false
draft: true
---

（本文）`;

const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  }),
});

if (!response.ok) {
  console.error(`記事生成に失敗しました: ${response.status} ${await response.text()}`);
  process.exit(1);
}

const result = await response.json();
let markdown = result.content.map((block) => block.text ?? '').join('').trim();

// コードフェンスで包まれて返ってきた場合に外す
markdown = markdown.replace(/^```(?:markdown|md)?\n/, '').replace(/\n```$/, '');

if (!markdown.startsWith('---')) {
  console.error('frontmatter で始まっていないため保存を中止します。');
  process.exit(1);
}

// 安全側に倒す：生成物は必ず下書きにする
if (!/^draft:\s*true$/m.test(markdown)) {
  markdown = markdown.replace(/^draft:\s*false$/m, 'draft: true');
}

writeFileSync(outPath, `${markdown}\n`, 'utf-8');
console.log(`下書きを作成しました: ${outPath}`);
console.log('内容を確認し、draft: false に変更すると公開されます。');
