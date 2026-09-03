#!/usr/bin/env node
/** Cloudflare Workers AIで記事プロンプトを実行し、Markdown応答を保存する。 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

const promptFile = arg('prompt-file');
const outputFile = arg('output-file');
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const apiToken = process.env.CLOUDFLARE_AI_API_TOKEN?.trim();
const model = process.env.CLOUDFLARE_AI_MODEL || '@cf/openai/gpt-oss-120b';

if (!promptFile || !outputFile) {
  console.error('使い方: node scripts/infer-article.mjs --prompt-file <path> --output-file <path>');
  process.exit(1);
}

if (!existsSync(promptFile)) {
  console.error(`記事プロンプトが見つかりません: ${promptFile}`);
  process.exit(1);
}

if (!accountId || !apiToken) {
  console.error('CLOUDFLARE_ACCOUNT_ID と CLOUDFLARE_AI_API_TOKEN が必要です。');
  process.exit(1);
}

const prompt = readFileSync(promptFile, 'utf-8');
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/v1/chat/completions`;

const system =
  'あなたは住宅リフォーム会社の反響対応を理解する日本語BtoB編集者です。一般論、同語反復、未検証の効果断定を排し、与えられた事実だけで完成原稿を書いてください。';

async function infer(messages) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      repetition_penalty: 1.1,
      frequency_penalty: 0.2,
      max_tokens: 6500,
      stream: false,
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1500);
    throw new Error(`Cloudflare Workers AIの記事生成に失敗しました: ${response.status} ${detail}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Cloudflare Workers AIから本文が返りませんでした。');
  return content;
}

let draft;
let markdown;
try {
  draft = await infer([
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ]);
  markdown = await infer([
    { role: 'system', content: system },
    { role: 'user', content: prompt },
    { role: 'assistant', content: draft },
    {
      role: 'user',
      content: `上の原稿を事実監査し、Markdown全文をリライトしてください。

- リフォーム反響OS 30は既製SaaSや一括管理ツールではなく、対象フロー1本を実装する支援商品です。
- 明示されていない画面、連携先、割り振り方法、通知時刻、対応期限、金額基準、問い合わせ件数基準を削除してください。
- 見積後フォローの間隔・文面・停止条件は「設計時に会社ごとに決める」としてください。
- 税別55,000円の見積フォロー漏れ診断を、無料・無料診断と表現してはいけません。
- 効果は保証せず、「防ぐ」「削減できる」ではなく「防止を目的にする」「確認しやすくする」としてください。
- 外部統計、架空の実績、根拠のない閾値は使わないでください。
- frontmatterと必須H2、2,200文字以上、内部リンク3件以上を維持してください。

説明や監査メモは付けず、修正後のMarkdown全文だけを返してください。`,
    },
  ]);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (!markdown) {
  console.error('Cloudflare Workers AIから本文が返りませんでした。');
  process.exit(1);
}

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, `${markdown}\n`, 'utf-8');
console.log(`AI記事応答を保存しました: ${outputFile}`);
