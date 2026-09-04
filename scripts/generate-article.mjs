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
10. 「DX化で効率化できます」「慎重な検討が必要です」だけで段落を終えない。何を、誰が、どの条件で行うかまで書く。
11. 見積書の作成自体を自動化するとは書かない。自動化対象は、受信確認、情報回収、台帳反映、未対応通知、見積後フォロー候補に限る。
12. チャットボット導入を前提にしない。個人情報をAIへ無条件に渡さず、権限・保存先・人の承認・例外時の戻し方を明記する。
13. 本文は空白を除いて2,200〜3,500文字を目安にし、同じ結論を言い換えて繰り返さない。
14. リフォーム反響OS 30を、既製SaaS・一括管理ツール・入力画面のある完成品として説明しない。会社ごとの対象フロー1本を設計・実装する支援商品です。
15. 明示されていない連携先、担当の割り振り方法、通知時刻、対応期限、金額・件数の閾値、部署構成を作らない。例示する場合も具体的な数値を置かず「設計時に決める」と書く。
16. 税別55,000円の見積フォロー漏れ診断を「無料」「無料診断」と書かない。
17. 「防ぐ」「削減できる」「短縮できる」と効果を断定せず、「防止を目的にする」「確認しやすくする」「判断材料にする」と書く。
18. スプレッドシート、DB、PDF、タグ、フラグなど特定の実装技術を、採用決定済みの仕様として書かない。
19. 「山野辺雄太さん」ではなく事業名の「シクミベース」を使う。「毎日多数」など根拠のない頻度・量を書かない。
20. 商品範囲として、受信確認、現調前情報の回収、案件台帳、未対応通知、見積後3回のフォロー、KPI計測の6要素を漏れなく説明する。
21. CTAは「見積フォロー漏れ診断は税別55,000円。実装契約時に診断費を実装費から控除する」と正確に書き、「別途請求は発生しない」など誤解を招く補足を加えない。
22. 記事末尾の診断ページとサービスページは、必ず通常のMarkdownリンクで記述する。

## 記事の構成
次のH2をこの順番で必ず含めてください。見出しの「：」以降は記事テーマに合わせてよいですが、見出し名は省略しないでください。
- 冒頭で読者の状況に触れる（2〜3行）
- 「## 結論：〜」で先に答えを出す
- 「## 最初に可視化する業務」で、受付経路、受付時刻、担当者、案件状態、次回行動日、失注理由を整理する
- 「## 実装手順」で、対象フローを1本に絞り、各手順の入力・担当・完了条件・例外時の処理を書く
- 「## KPIの定義と見方」で、初回返信時間、未対応数、次回行動日設定率、追客実施率（または見積後フォロー実施率）の定義と計算方法を書く。成果保証はしない
- 「## 自動化しない判断」で、金額・工法・契約・クレーム・個人情報など、人が確認すべき境界を書く
- 「## 向いている会社・先に別課題へ取り組む会社」で、導入判断を具体的な状態で分ける
- 「## まとめ」で箇条書き
- 本文中に既存記事またはサービスページへのリンクを2つ以上

## 実務上の前提
- 受付経路はWebフォーム、電話、LINEなど複数あり得るが、存在を断定せず「利用している経路」と書く。
- 台帳の必須項目例は、受付日時、流入元、氏名・連絡先、相談対象、希望時期、担当者、案件状態、次回行動日、最終接触日、失注理由。
- 受信確認と担当者通知を分ける。自動返信は受付事実と次の連絡目安だけを伝え、診断・価格・工期を確約しない。
- 見積後フォローは3回分を設計するが、送信間隔・文面・停止条件は会社ごとに合意し、人が承認できるようにする。
- KPIは定義式と集計単位を固定し、件数が少ない期間の率だけで判断しない。

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
generated: true
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

const frontmatterMatch = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
if (!frontmatterMatch) {
  console.error('frontmatter の終端が見つからないため保存を中止します。');
  process.exit(1);
}

const modelFrontmatter = frontmatterMatch[1];
const body = markdown.slice(frontmatterMatch[0].length).trim();
if (body.replace(/\s/g, '').length < 2200) {
  console.error('記事本文が2,200文字未満のため保存を中止します。');
  process.exit(1);
}

const field = (name) => {
  const value = modelFrontmatter.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? '';
  return value.replace(/^['"]|['"]$/g, '').trim();
};

const compact = (value) => value.replace(/\s+/g, ' ').trim();
const title = compact(field('title') || `${keyword}｜住宅リフォーム会社の実務ポイント`).slice(0, 60);
let description = compact(field('description'));
const fallbackDescription = `住宅リフォーム会社が「${keyword}」を進める前に、問い合わせ受付・現地調査・見積後フォローのどこを整え、何を測るべきかを実務目線で整理します。`;
if (description.length < 60) description = fallbackDescription;
description = description.slice(0, 140);
const intent = compact(
  field('intent') || `住宅リフォーム会社が${keyword}を実務で進めるための手順と判断基準を知る`
);
const relatedService = category === 'ai' ? 'ai-dx' : category === 'sns' ? 'sns' : 'web';
const yaml = (value) => JSON.stringify(value);

// スキーマに関わる値はモデルへ委ねず、検証済みの入力から毎回組み直す。
markdown = `---
title: ${yaml(title)}
description: ${yaml(description)}
category: ${category}
intent: ${yaml(intent)}
primaryKeyword: ${yaml(keyword)}
keywords:
  - ${yaml(keyword)}
  - ${yaml(`${keyword} 進め方`)}
  - ${yaml('リフォーム会社 反響対応')}
publishedAt: ${publishedAt}
relatedServices:
  - ${relatedService}
firstParty: false
generated: true
draft: false
---

${body}`;

writeFileSync(outPath, `${markdown}\n`, 'utf-8');
console.log(`公開候補を作成しました: ${outPath}`);
console.log('自動作成されたPRで内容を確認し、マージすると公開されます。');
