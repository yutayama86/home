#!/usr/bin/env node
/**
 * 記事の品質チェック。
 *
 * `npm run build` の後に実行し、1件でも error があれば終了コード1で止める。
 * CI とデプロイはこの結果を見て公開を止めるため、
 * 「チェックを通らない記事は公開されない」状態を保証する。
 *
 * 使い方:
 *   node scripts/quality-check.mjs            すべての記事を検査
 *   node scripts/quality-check.mjs --changed  Gitで変更された記事だけ検査
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';

const CONTENT_DIRS = ['src/content/knowledge', 'src/content/case'];
const SITE_SOURCE_DIRS = ['src/pages', 'src/components', 'src/layouts', 'functions'];

const errors = [];
const warnings = [];

const addError = (file, message) => errors.push({ file, message });
const addWarning = (file, message) => warnings.push({ file, message });

/** frontmatter と本文を分ける（YAMLパーサを持ち込まず、必要な範囲だけ読む）。 */
function parse(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const [, frontmatterText, body] = match;
  const data = {};
  let currentKey = null;

  for (const line of frontmatterText.split('\n')) {
    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(listItem[1].trim());
      continue;
    }

    const pair = line.match(/^([a-zA-Z]+):\s*(.*)$/);
    if (pair) {
      currentKey = pair[1];
      const value = pair[2].trim();
      data[currentKey] = value === '' ? [] : value;
    }
  }

  return { data, body };
}

function listArticles() {
  const files = [];
  for (const dir of CONTENT_DIRS) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (name.endsWith('.md')) files.push(join(dir, name));
    }
  }
  return files;
}

/** 公開ページとフォームAPIのソースを列挙する。 */
function listSiteSources() {
  const walk = (dir) => {
    if (!existsSync(dir)) return [];
    const files = [];
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, item.name);
      if (item.isDirectory()) files.push(...walk(full));
      else if (/\.(?:astro|ts|tsx|js|mjs)$/.test(item.name)) files.push(full);
    }
    return files;
  };

  return SITE_SOURCE_DIRS.flatMap(walk);
}

function changedArticles() {
  try {
    const output = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf-8' });
    return output
      .split('\n')
      .filter((f) => f.startsWith('src/content/') && f.endsWith('.md') && existsSync(f));
  } catch {
    // 履歴が浅い場合などは全件にフォールバックする
    return listArticles();
  }
}

/* --- 個別の検査 ------------------------------------------------------- */

/** 事実に基づかない数字が書かれていないかの手がかりを探す。 */
function checkUnsourcedNumbers(file, body) {
  // 「10件増」「100万円改善」「3日短縮」なども含む成果数値表現
  const claims = body.match(
    /\d+(?:[.,]\d+)?\s*(?:件|円|万円|億円|日|時間|分|%|％|倍|割)\s*(?:向上|増加|改善|削減|減少|短縮|アップ|上昇|低下|獲得|達成|回復|増え|減り)/g
  );
  if (!claims) return;

  for (const claim of new Set(claims)) {
    // 同じ段落に出典リンクがあれば許容する
    const paragraph = body
      .split('\n\n')
      .find((p) => p.includes(claim));
    const hasSource = paragraph && /\[.+?\]\(https?:\/\//.test(paragraph);
    if (!hasSource) {
      addError(file, `出典のない成果数値: 「${claim}」— 根拠リンクを添えるか、表現を変えてください`);
    }
  }
}

/** 法人と誤認される表記を禁止する。 */
function checkCorporateWording(file, raw) {
  const banned = ['株式会社シクミベース', '代表取締役', '弊社は法人'];
  for (const word of banned) {
    if (raw.includes(word)) {
      addError(file, `法人化前のため使用できない表記: 「${word}」`);
    }
  }
}

/** 断定を避けるべき領域を検査する。 */
function checkRiskyAssertions(file, body) {
  const patterns = [
    { re: /(?:必ず|確実に)(?:節税|控除|還付)/, note: '税務の断定' },
    { re: /法律上(?:問題ありません|可能です)/, note: '法務の断定' },
    { re: /(?:100%|絶対に)(?:成果|効果|上位表示)/, note: '成果の断定' },
  ];
  for (const { re, note } of patterns) {
    if (re.test(body)) {
      addError(file, `${note}にあたる表現があります。専門家への確認を促す書き方にしてください`);
    }
  }
}

/** 記事テンプレートに必要な要素が揃っているかを見る。 */
function checkStructure(file, data, body) {
  const isKnowledge = file.includes('/knowledge/');

  if (isKnowledge) {
    if (!data.intent) addError(file, 'intent（検索意図）が未設定です');
    if (!data.primaryKeyword) addError(file, 'primaryKeyword が未設定です');

    // 結論が先に来ているか（最初のH2までの距離）
    const firstH2 = body.indexOf('\n## ');
    if (firstH2 > 800) {
      addWarning(file, `最初の見出しまでが長すぎます（${firstH2}文字）。結論を前に出してください`);
    }

    // まとめの有無
    if (!/^##\s*(まとめ|結論)/m.test(body)) {
      addWarning(file, '「まとめ」の見出しが見つかりません');
    }

    // 内部リンク（関連記事・サービスへの導線）
    const internalLinks = body.match(/\]\(\/(knowledge|service|case)\//g) ?? [];
    if (internalLinks.length === 0) {
      addError(file, 'サイト内リンクがありません。関連記事かサービスへ導線をつくってください');
    }
  }

  // 見出し階層の飛び（H2を挟まずH3が来る）
  const headings = [...body.matchAll(/^(#{2,4})\s/gm)].map((m) => m[1].length);
  for (let i = 1; i < headings.length; i += 1) {
    if (headings[i] - headings[i - 1] > 1) {
      addWarning(file, '見出しの階層が飛んでいます（H2を挟まずにH3以下が来ています）');
      break;
    }
  }

  // 本文量
  const chars = body.replace(/\s/g, '').length;
  if (chars < 1500) {
    addWarning(file, `本文が短めです（約${chars}文字）。検索意図に答えきれているか確認してください`);
  }
}

/** AIが書いた文章に出やすい冗長表現を検出する。 */
function checkVerbosity(file, body) {
  const phrases = [
    'いかがでしたでしょうか',
    'いかがでしたか',
    'ぜひ参考にしてみてください',
    '本記事では、',
    'について解説していきます',
    'と言えるでしょう。',
  ];
  const found = phrases.filter((p) => body.includes(p));
  if (found.length >= 2) {
    addWarning(file, `定型的な表現が目立ちます: ${found.join('、')}`);
  }
}

/** 自動生成候補は、人手記事より厳しい実務品質ゲートを通す。 */
function checkGeneratedEditorialQuality(file, data, body) {
  if (String(data.generated ?? '').replace(/["']/g, '') !== 'true') return;

  const chars = body.replace(/\s/g, '').length;
  if (chars < 2200) {
    addError(file, `自動生成記事が短すぎます（約${chars}文字 / 2,200以上）`);
  }

  const requiredHeadings = [
    ['結論', /結論/],
    ['最初に可視化する業務', /(?:最初に|導入前に|はじめに).{0,12}可視化する業務/],
    ['実装手順', /実装手順/],
    ['KPIの定義と見方', /KPI.{0,8}(?:定義|見方)/i],
    ['自動化しない判断', /自動化しない(?:判断|範囲|境界)/],
    ['向いている会社・先に別課題へ取り組む会社', /向いている会社.{0,16}先に別課題/],
    ['まとめ', /まとめ/],
  ];
  const h2s = [...body.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1]);
  for (const [label, pattern] of requiredHeadings) {
    if (!h2s.some((heading) => pattern.test(heading))) {
      addError(file, `自動生成記事に必須見出し「${label}」がありません`);
    }
  }

  const requiredTerms = [
    ['初回返信時間', /初回返信時間/],
    ['未対応数', /未対応(?:案件)?数/],
    ['次回行動日設定率', /次回行動日設定率/],
    ['追客実施率', /(?:追客|見積後フォロー|フォロー).{0,8}(?:実施率|送信率)/],
  ];
  for (const [label, pattern] of requiredTerms) {
    if (!pattern.test(body)) addError(file, `KPI「${label}」の定義がありません`);
  }

  const internalLinks = body.match(/\]\(\/(knowledge|service|diagnosis|case)\//g) ?? [];
  if (internalLinks.length < 3) {
    addError(file, `自動生成記事の内部リンクが不足しています（${internalLinks.length}件 / 3件以上）`);
  }

  const vaguePhrases = [
    '実現することができます',
    '慎重な検討が必要です',
    '基盤が整っていない会社',
    '住宅リフォーム会社のあなたは',
  ];
  const found = vaguePhrases.filter((phrase) => body.includes(phrase));
  if (found.length > 0) {
    addError(file, `一般論・機械的な表現が残っています: ${found.join('、')}`);
  }

  const inventedProductClaims = [
    ['有料診断を無料とする誤記', /無料(?:診断|で提供)/],
    ['既製ツールとしての誤記', /(?:一括管理|案件管理)ツール(?:です|として|を提供)|入力画面/],
    ['未定義の連携先', /Slack|Teams|Chatwork/],
    ['未定義の自動割り振り', /自動割り振り|自動振り分け/],
    [
      '未定義のリアルタイム処理',
      /リアルタイムで(?!は(?:ない|なく|ありません)).{0,16}(?:反映|更新|閲覧|通知|処理)/,
    ],
    ['未定義の定時処理', /毎(?:朝|晩|日)\s*\d{1,2}(?::\d{2})?時/],
    ['未定義の対応期限', /\d+\s*(?:時間|h|日|分)(?:以内|未満|後)/i],
    ['未定義の金額基準', /\d+(?:[,.]\d+)?\s*万円(?:以上|以下|超|未満)/],
    ['未定義の件数基準', /(?:月|毎月|月間)\s*\d+\s*件(?:以上|以下|未満)/],
    ['未定義のカスタマイズ保証', /カスタマイズ可能/],
    ['未決定の実装技術', /スプレッドシート|軽量DB|PDF\s*を添付|(?:例外|未回答)タグ|フラグを/],
    ['誤解を招く診断費表現', /別途請求は発生しません/],
    ['不自然な運営者呼称', /山野辺雄太さん/],
    ['根拠のない量表現', /毎日多数/],
  ];
  for (const [label, pattern] of inventedProductClaims) {
    if (pattern.test(body)) addError(file, `${label}が含まれています`);
  }

  if (!body.includes('税別55,000円')) {
    addError(file, '見積フォロー漏れ診断の価格「税別55,000円」が明記されていません');
  }

  const productScope = [
    ['受信確認', /受信確認/],
    ['現調前情報の回収', /現調前.{0,8}(?:情報|項目).{0,8}(?:回収|収集)/],
    ['案件台帳', /案件台帳/],
    ['未対応通知', /未対応通知/],
    ['見積後3回のフォロー', /見積後.{0,8}(?:3回.{0,8}フォロー|フォロー.{0,8}3回)|3回.{0,8}見積後フォロー/],
    ['KPI計測', /KPI.{0,8}(?:計測|測定|集計)/i],
  ];
  for (const [label, pattern] of productScope) {
    if (!pattern.test(body)) addError(file, `商品範囲「${label}」の説明がありません`);
  }

  if (!/\]\(\/diagnosis\/reform-lead\/\)/.test(body)) {
    addError(file, '見積フォロー漏れ診断へのMarkdownリンクがありません');
  }
  if (!/\]\(\/service\/reform-lead-os\/\)/.test(body)) {
    addError(file, 'リフォーム反響OS 30へのMarkdownリンクがありません');
  }
}

/** メタ情報の長さ。検索結果での省略を避ける。 */
function checkMeta(file, data) {
  const title = String(data.title ?? '');
  const description = String(data.description ?? '');

  if (title.length > 60) addError(file, `title が長すぎます（${title.length}文字 / 60以内）`);
  if (!title) addError(file, 'title が未設定です');

  if (description.length < 60 || description.length > 140) {
    addError(file, `description の長さが範囲外です（${description.length}文字 / 60〜140）`);
  }
}

/**
 * ビルド結果に、強調にならなかったアスタリスクが残っていないかを見る。
 *
 * 日本語では `**「〜」**` のように括弧と隣接すると、CommonMark の flanking 規則により
 * 強調にならず、`**` がそのまま本文に出てしまう。原稿を読むだけでは気づきにくいため、
 * 生成後のHTMLで確認する。dist/ がない場合はスキップする。
 */
function checkRenderedEmphasis() {
  if (!existsSync('dist')) return;

  const walk = (dir) => {
    const out = [];
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name.name);
      if (name.isDirectory()) out.push(...walk(full));
      else if (name.name.endsWith('.html')) out.push(full);
    }
    return out;
  };

  for (const file of walk('dist')) {
    const html = readFileSync(file, 'utf-8');
    for (const match of html.matchAll(/<p>[^<]*\*\*[^<]*<\/p>/g)) {
      const snippet = match[0].replace(/<\/?p>/g, '').slice(0, 60);
      addError(
        file,
        `強調が反映されていません: 「${snippet}」— 括弧を ** の外に出してください`
      );
    }
  }
}

/* --- 実行 ------------------------------------------------------------- */

const onlyChanged = process.argv.includes('--changed');
const files = onlyChanged ? changedArticles() : listArticles();

if (files.length === 0) {
  console.log('検査対象の記事はありません。');
  process.exit(0);
}

for (const file of files) {
  const raw = readFileSync(file, 'utf-8');
  const parsed = parse(raw);

  if (!parsed) {
    addError(file, 'frontmatter を読み取れません');
    continue;
  }

  const { data, body } = parsed;

  checkMeta(file, data);
  checkCorporateWording(file, raw);
  checkUnsourcedNumbers(file, body);
  checkRiskyAssertions(file, body);
  checkStructure(file, data, body);
  checkVerbosity(file, body);
  checkGeneratedEditorialQuality(file, data, body);
}

// 記事以外の販売ページやフォームにも、法人誤認表記を持ち込ませない。
for (const file of listSiteSources()) {
  checkCorporateWording(file, readFileSync(file, 'utf-8'));
}

checkRenderedEmphasis();

console.log(`\n品質チェック: ${files.length}件の記事を検査しました\n`);

if (warnings.length > 0) {
  console.log(`警告 ${warnings.length}件（公開は止めません）`);
  for (const { file, message } of warnings) {
    console.log(`  - ${basename(file)}: ${message}`);
  }
  console.log('');
}

if (errors.length > 0) {
  console.log(`エラー ${errors.length}件（このままでは公開できません）`);
  for (const { file, message } of errors) {
    console.log(`  ✗ ${basename(file)}: ${message}`);
  }
  console.log('');
  process.exit(1);
}

console.log('エラーはありません。');
