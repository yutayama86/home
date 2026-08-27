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
  // 「◯%向上」「◯倍」「◯件増加」など、成果を示す数値表現
  const claims = body.match(/\d+(?:\.\d+)?\s*(?:%|％|倍|割)\s*(?:向上|増加|改善|削減|減少|アップ|増)/g);
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
