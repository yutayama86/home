#!/usr/bin/env node
/**
 * 毎日の改善対象を決めて、Daily Growth Report を出力する。
 *
 * Search Console のデータが取れる場合はそれを根拠に、
 * 取れない場合（設定前・データ蓄積前）はサイト内の状態から判断する。
 *
 * 出力:
 *   docs/seo-log/YYYY-MM-DD.md   その日の判断と根拠
 *   標準出力                      Daily Growth Report（CIのサマリにも使う）
 *
 * 使い方:
 *   node scripts/daily-growth.mjs
 *   node scripts/daily-growth.mjs --dry-run   ログを書かずに表示だけ
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { isConfigured, fetchSearchAnalytics } from './lib/gsc.mjs';

const KNOWLEDGE_DIR = 'src/content/knowledge';
const LOG_DIR = 'docs/seo-log';

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const dryRun = process.argv.includes('--dry-run');

/* --- 記事の読み込み --------------------------------------------------- */

function loadArticles() {
  if (!existsSync(KNOWLEDGE_DIR)) return [];

  return readdirSync(KNOWLEDGE_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const raw = readFileSync(join(KNOWLEDGE_DIR, file), 'utf-8');
      const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!match) return null;

      const [, fm, body] = match;
      const get = (key) => {
        const m = fm.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
        return m ? m[1].trim() : '';
      };

      const slug = basename(file, '.md');
      const category = get('category');

      return {
        slug,
        file: join(KNOWLEDGE_DIR, file),
        title: get('title'),
        category,
        primaryKeyword: get('primaryKeyword'),
        publishedAt: get('publishedAt'),
        updatedAt: get('updatedAt'),
        path: `/knowledge/${category}/${slug}/`,
        chars: body.replace(/\s/g, '').length,
        internalLinks: (body.match(/\]\(\/(knowledge|service|case)\//g) ?? []).length,
      };
    })
    .filter(Boolean);
}

/* --- 改善対象の判定 --------------------------------------------------- */

/**
 * 仕様どおりの優先順位で改善対象を決める。
 *   A. 表示回数はあるがCTRが低い → title / description
 *   B. 11〜30位          → 内容追加・内部リンク強化
 *   C. 流入はあるが問い合わせにつながらない → CTA・導線
 *   D. 成果が出ている     → 関連記事・派生キーワードを追加
 *   E. 表示もクリックもない → 統合・リライト・削除の検討
 */
function decideFromSearchData(rows, articles) {
  const byPath = new Map();
  for (const row of rows) {
    const url = row.keys[0];
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    byPath.set(path, row);
  }

  const candidates = [];

  for (const article of articles) {
    const stats = byPath.get(article.path);

    if (!stats) {
      candidates.push({
        rule: 'E',
        priority: 5,
        article,
        reason: '検索での表示がまだ計測されていません',
        action: 'インデックス状況を確認し、検索意図と内部リンクを見直す',
      });
      continue;
    }

    const { impressions, clicks, ctr, position } = stats;

    if (impressions >= 100 && ctr < 0.02) {
      candidates.push({
        rule: 'A',
        priority: 1,
        article,
        stats,
        reason: `表示${impressions}回に対しCTR ${(ctr * 100).toFixed(2)}%と低い`,
        action: 'title と description を検索意図に寄せて書き直す',
      });
    } else if (position >= 11 && position <= 30) {
      candidates.push({
        rule: 'B',
        priority: 2,
        article,
        stats,
        reason: `平均掲載順位 ${position.toFixed(1)}位。上位化の余地がある`,
        action: '不足している観点を追記し、関連記事からの内部リンクを増やす',
      });
    } else if (clicks >= 10) {
      candidates.push({
        rule: 'D',
        priority: 4,
        article,
        stats,
        reason: `クリック${clicks}件と流入がある`,
        action: '派生キーワードの記事を新規作成し、相互にリンクする',
      });
    } else if (impressions < 10) {
      candidates.push({
        rule: 'E',
        priority: 5,
        article,
        stats,
        reason: `表示${impressions}回とほとんど露出していない`,
        action: '検索需要を再確認し、統合またはリライトを検討する',
      });
    }
  }

  candidates.sort((a, b) => a.priority - b.priority);
  return candidates;
}

/** データがない期間の判断。サイト内の状態だけで決める。 */
function decideFromSiteState(articles) {
  const candidates = [];

  // 内部リンクが少ない記事は、孤立して評価が集まりにくい
  for (const article of articles) {
    if (article.internalLinks < 2) {
      candidates.push({
        rule: '内部リンク不足',
        priority: 2,
        article,
        reason: `サイト内リンクが${article.internalLinks}件しかありません`,
        action: '関連する記事とサービスページへの導線を追加する',
      });
    }
  }

  // カテゴリごとの記事数の偏り
  const counts = {};
  for (const article of articles) {
    counts[article.category] = (counts[article.category] ?? 0) + 1;
  }
  const thin = Object.entries(counts)
    .filter(([, n]) => n < 2)
    .map(([category]) => category);

  for (const category of thin) {
    candidates.push({
      rule: 'カテゴリ拡充',
      priority: 1,
      category,
      reason: `${category} カテゴリの記事が${counts[category]}件しかありません`,
      action: 'このカテゴリで、商談に近い検索意図の記事を1本追加する',
    });
  }

  candidates.sort((a, b) => a.priority - b.priority);
  return candidates;
}

/* --- 実行 ------------------------------------------------------------- */

const articles = loadArticles();
let searchData = null;
let dataError = null;

if (isConfigured()) {
  try {
    searchData = await fetchSearchAnalytics({ dimensions: ['page'], days: 28 });
  } catch (error) {
    dataError = error.message;
  }
}

const candidates = searchData
  ? decideFromSearchData(searchData.rows, articles)
  : decideFromSiteState(articles);

const top = candidates[0] ?? null;

/* --- レポート --------------------------------------------------------- */

const totals = searchData
  ? searchData.rows.reduce(
      (acc, r) => ({
        impressions: acc.impressions + r.impressions,
        clicks: acc.clicks + r.clicks,
      }),
      { impressions: 0, clicks: 0 }
    )
  : null;

const lines = [];
lines.push('【シクミベース Daily Growth Report】');
lines.push('');
lines.push(`日付: ${today}`);
lines.push('');

lines.push('■ 直近の結果');
if (searchData) {
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  lines.push(`  集計期間: ${searchData.period.start} 〜 ${searchData.period.end}`);
  lines.push(`  表示回数: ${totals.impressions}`);
  lines.push(`  クリック: ${totals.clicks}`);
  lines.push(`  CTR: ${ctr.toFixed(2)}%`);
  lines.push(`  計測対象ページ: ${searchData.rows.length}`);
} else if (dataError) {
  lines.push(`  Search Console からデータを取得できませんでした: ${dataError}`);
} else {
  lines.push('  Search Console が未設定のため、サイト内の状態から判断しています。');
  lines.push('  （GSC_SERVICE_ACCOUNT_JSON と GSC_SITE_URL を設定すると実データで判断します）');
}
lines.push('');

if (searchData && searchData.rows.length > 0) {
  const best = [...searchData.rows].sort((a, b) => b.clicks - a.clicks)[0];
  lines.push('■ 最も流入が多いページ');
  lines.push(`  ${best.keys[0]}`);
  lines.push(`  クリック${best.clicks} / 表示${best.impressions} / 平均${best.position.toFixed(1)}位`);
  lines.push('');
}

lines.push('■ 改善が必要なページ');
if (candidates.length === 0) {
  lines.push('  該当なし');
} else {
  for (const c of candidates.slice(0, 5)) {
    const label = c.article ? c.article.title : `${c.category} カテゴリ`;
    lines.push(`  [${c.rule}] ${label}`);
    lines.push(`        ${c.reason}`);
  }
}
lines.push('');

lines.push('■ 今日やること');
if (top) {
  const label = top.article ? top.article.title : `${top.category} カテゴリの記事を1本追加`;
  lines.push(`  対象: ${label}`);
  if (top.article) lines.push(`  URL: ${top.article.path}`);
  lines.push(`  内容: ${top.action}`);
  lines.push('');
  lines.push('■ 理由');
  lines.push(`  ${top.reason}`);
  lines.push('');
  lines.push('■ 想定効果');
  lines.push(`  ${expectedEffect(top)}`);
  lines.push('');
  lines.push('■ 次の判断条件');
  lines.push(`  ${nextCheck(top)}`);
} else {
  lines.push('  緊急の改善対象はありません。新規記事の追加を優先してください。');
}

function expectedEffect(candidate) {
  switch (candidate.rule) {
    case 'A':
      return '同じ表示回数のままでもクリックが増える。2週間でCTRの変化を確認する';
    case 'B':
      return '検索意図への充足度が上がり、10位以内に入る可能性がある';
    case 'D':
      return '関連キーワードでの露出が増え、既存記事へのリンクも強くなる';
    case 'E':
      return '需要のないキーワードに時間を使わずに済む。統合すれば1本あたりの厚みが増す';
    case '内部リンク不足':
      return '回遊が増え、サービスページへの到達率が上がる';
    case 'カテゴリ拡充':
      return 'カテゴリとしての網羅性が上がり、関連記事同士で評価を補える';
    default:
      return '—';
  }
}

function nextCheck(candidate) {
  switch (candidate.rule) {
    case 'A':
      return '14日後にCTRを再確認。改善しなければ検索意図の読み違いを疑う';
    case 'B':
      return '28日後に平均掲載順位を再確認。動かなければ競合の充足度を調べる';
    case 'D':
      return '新規記事の公開から28日後に、両方の記事の表示回数を確認する';
    case 'E':
      return '次回の実行時に表示回数が増えていなければ、統合または削除を決める';
    default:
      return '次回の実行時に、同じ指摘が残っていないかを確認する';
  }
}

const report = lines.join('\n');
console.log(report);

/* --- ログの保存 ------------------------------------------------------- */

if (!dryRun && top) {
  mkdirSync(LOG_DIR, { recursive: true });

  const log = [
    '---',
    `date: ${today}`,
    `target: ${top.article ? top.article.path : `${top.category} カテゴリ`}`,
    `rule: ${top.rule}`,
    `keyword: ${top.article?.primaryKeyword ?? '—'}`,
    `data_source: ${searchData ? 'search-console' : 'site-state'}`,
    '---',
    '',
    '## action',
    top.action,
    '',
    '## reason',
    top.reason,
    '',
    '## before',
    top.stats
      ? `表示${top.stats.impressions} / クリック${top.stats.clicks} / CTR ${(top.stats.ctr * 100).toFixed(2)}% / 平均${top.stats.position.toFixed(1)}位`
      : '計測データなし',
    '',
    '## expected_effect',
    expectedEffect(top),
    '',
    '## next_action',
    nextCheck(top),
    '',
    '## result',
    '（次回以降に追記）',
    '',
  ].join('\n');

  const logPath = join(LOG_DIR, `${today}.md`);
  writeFileSync(logPath, log, 'utf-8');
  console.log(`\nログを保存しました: ${logPath}`);
}

// CIのサマリに出す
if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `\`\`\`\n${report}\n\`\`\`\n`, { flag: 'a' });
}
