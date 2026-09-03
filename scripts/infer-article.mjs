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

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model,
    messages: [
      {
        role: 'system',
        content:
          'あなたは住宅リフォーム会社の反響対応を理解する日本語BtoB編集者です。一般論、同語反復、未検証の効果断定を排し、現場で実行できる完成原稿だけを返してください。',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    repetition_penalty: 1.1,
    frequency_penalty: 0.2,
    max_tokens: 6500,
    stream: false,
  }),
});

if (!response.ok) {
  const detail = (await response.text()).slice(0, 1500);
  console.error(`Cloudflare Workers AIの記事生成に失敗しました: ${response.status} ${detail}`);
  process.exit(1);
}

const result = await response.json();
const markdown = result.choices?.[0]?.message?.content?.trim();

if (!markdown) {
  console.error('Cloudflare Workers AIから本文が返りませんでした。');
  process.exit(1);
}

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, `${markdown}\n`, 'utf-8');
console.log(`AI記事応答を保存しました: ${outputFile}`);
