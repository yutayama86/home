#!/usr/bin/env node
/**
 * daily-growth の判断にもとづいて、記事の下書きを生成する。
 *
 * 生成物は公開候補（draft: false）としてPRに載せる。
 * mainへ直接書かないため、内容を人が確認してPRをマージしたときだけ公開される。
 *
 * 使い方:
 *   node scripts/generate-article.mjs --category shikumika --keyword "業務標準化 進め方" --prompt-output /tmp/prompt.md
 *   node scripts/generate-article.mjs --category shikumika --keyword "業務標準化 進め方" --response-file /tmp/response.md
 *   node scripts/generate-article.mjs --category shikumika --keyword "業務標準化 進め方"
 */

import { writeFileSync, existsSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';

// モデル名はGitHub Actionsの変数で更新できるようにし、コード変更を不要にする。
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const KNOWLEDGE_DIR = 'src/content/knowledge';

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

const category = arg('category');
const keyword = arg('keyword');
const slug = arg('slug') ?? (keyword ? slugify(keyword) : null);
const promptOutput = arg('prompt-output');
const responseFile = arg('response-file');
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

const prompt = `あなたは、シクミベースの商談獲得につながる実務記事を書きます。

## シクミベースについて
- 山野辺雄太が個人で運営する事業ブランドです。法人ではありません。
- 「株式会社シクミベース」「代表取締役」という表記は絶対に使わないでください。
- 主力商品は、外壁塗装・屋根・住宅リフォーム会社向けの「リフォーム反響OS 30」です。
- 新規問い合わせへの受信確認、現調前情報の回収、案件台帳、未対応通知、見積後3回のフォロー、KPI計測を、対象フロー1本に実装します。
- 導入前に税別55,000円の「見積フォロー漏れ診断」を提供します。実装契約時は同額を実装費から控除します。
- 売上、受注数、SEO順位は保証しません。AI・Web・SNSは商品名ではなく、運用を動かす手段です。

## 今回書く記事
- カテゴリ: ${category}
- 主軸キーワード: ${keyword}

## 絶対に守ること
1. **実績や数値を捏造しない。** 「弊社の支援で問い合わせが3倍になりました」のような検証できない実績は書かない。
2. **外部統計、市場規模、成果率を書かない。** 自動生成時には出典内容を検証できないため、外部の数値やURLを新しく作らない。
3. **法務・税務・労務を断定しない。** 「専門家に確認してください」と書く。
4. 存在しない制度・サービス・機能を書かない。
5. 「いかがでしたでしょうか」「本記事では〜解説していきます」のような定型表現を使わない。
6. キーワードを不自然に繰り返さない。
7. 一般論で水増しせず、住宅リフォーム会社の問い合わせ受付、現調、見積、追客の業務に限定する。
8. 「よくある」「多くの会社」など未検証の一般化を避け、「該当する場合」「確認すべき状態」と書く。
9. 事実、運用上の判断基準、シクミベースのサービス条件を混同しない。

## 記事の構成
必ず次を含めてください。
- 冒頭で読者の状況に触れる（2〜3行）
- 「## 結論：〜」で先に答えを出す
- 読者の課題の説明
- 具体的な解決方法（手順や判断基準）
- 注意点・失敗しやすい進め方
- 確認すべきKPI（初回返信時間、未対応数、次回行動日設定率、追客実施率などから関連するもの）
- 「向いている会社／先に別課題へ取り組む会社」の判断
- 「## まとめ」で箇条書き
- 本文中に既存記事またはサービスページへのリンクを2つ以上

## 内部リンクに使える既存記事
${existingArticles().join('\n') || '（まだありません）'}

## サービスページ
- /service/reform-lead-os/ … リフォーム反響OS 30
- /diagnosis/reform-lead/ … 見積フォロー漏れ診断
- /service/web/ … Web改善・制作
- /service/ai-dx/ … AI・業務改善

記事末尾では、住宅リフォーム会社に限り「見積フォロー漏れ診断」または「リフォーム反響OS 30」を案内してください。対象外の読者へ無理に勧めないでください。

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
draft: false
---

（本文）`;

if (promptOutput) {
  mkdirSync(dirname(promptOutput), { recursive: true });
  writeFileSync(promptOutput, `${prompt}\n`, 'utf-8');
  console.log(`記事生成用プロンプトを作成しました: ${promptOutput}`);
  process.exit(0);
}

let markdown;

if (responseFile) {
  if (!existsSync(responseFile)) {
    console.error(`AIの応答ファイルが見つかりません: ${responseFile}`);
    process.exit(1);
  }
  markdown = readFileSync(responseFile, 'utf-8').trim();
} else {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('--response-file または ANTHROPIC_API_KEY が必要です。');
    process.exit(1);
  }

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
  markdown = result.content.map((block) => block.text ?? '').join('').trim();
}

// コードフェンスで包まれて返ってきた場合に外す
markdown = markdown.replace(/^```(?:markdown|md)?\n/, '').replace(/\n```$/, '');

if (!markdown.startsWith('---')) {
  console.error('frontmatter で始まっていないため保存を中止します。');
  process.exit(1);
}

// 公開はPRのマージで制御する。プレビューと品質検査の対象にするため、記事自体は公開候補にする。
if (!/^draft:\s*false$/m.test(markdown)) {
  markdown = markdown.replace(/^draft:\s*true$/m, 'draft: false');
}

writeFileSync(outPath, `${markdown}\n`, 'utf-8');
console.log(`公開候補を作成しました: ${outPath}`);
console.log('自動作成されたPRで内容を確認し、マージすると公開されます。');
