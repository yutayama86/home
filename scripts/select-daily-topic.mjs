#!/usr/bin/env node
/**
 * 3か月分の商談直結ロングテールから、未作成テーマを1件選ぶ。
 * Daily Growth Report の最優先ルール・カテゴリ・キーワードを受け取り、
 * 計測上の課題に近い候補を優先する。コンバージョン障害（Rule C）の日は
 * 新規記事を増やさず、既存導線の修正を優先する。
 */

import { existsSync, readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const CONTENT_DIR = 'src/content/knowledge';

const topics = [
  // marketing — 反響から受注までの意思決定
  ['marketing', 'リフォーム会社 問い合わせ 管理', 'renovation-inquiry-management'],
  ['marketing', 'リフォーム会社 見積 フォロー', 'renovation-estimate-follow-up'],
  ['marketing', '外壁塗装 見積後 連絡', 'painting-estimate-follow-up'],
  ['marketing', 'リフォーム会社 反響営業', 'renovation-lead-sales'],
  ['marketing', 'リフォーム会社 反響率 改善', 'renovation-lead-conversion-improvement'],
  ['marketing', 'リフォーム 見積 失注 理由', 'renovation-estimate-loss-reasons'],
  ['marketing', '外壁塗装 問い合わせ 成約率', 'painting-inquiry-conversion-rate'],
  ['marketing', 'リフォーム会社 取りこぼし 対策', 'renovation-lost-lead-prevention'],
  ['marketing', 'リフォーム会社 営業フロー', 'renovation-sales-flow'],
  ['marketing', '問い合わせ 返信時間 成約率 リフォーム', 'renovation-response-time-conversion'],
  ['marketing', 'リフォーム 見積 フォロー タイミング', 'renovation-follow-up-timing'],
  ['marketing', 'リフォーム 見込み客 再アプローチ', 'renovation-lead-reactivation'],
  ['marketing', 'リフォーム会社 営業 KPI', 'renovation-sales-kpi'],
  ['marketing', 'リフォーム 見積 成約率 改善', 'renovation-estimate-win-rate'],
  ['marketing', '現地調査 受注率 リフォーム', 'renovation-site-survey-conversion'],
  ['marketing', '茨城 リフォーム会社 集客 問い合わせ', 'ibaraki-renovation-lead-generation'],
  ['marketing', 'リフォーム 見積 返事がない', 'renovation-estimate-no-response'],
  ['marketing', 'リフォーム 顧客 ジャーニー', 'renovation-customer-journey'],
  ['marketing', 'リフォーム 問い合わせ 見込み度', 'renovation-lead-qualification'],
  ['marketing', 'リフォーム会社 電話 問い合わせ 管理', 'renovation-phone-inquiry-management'],
  ['marketing', 'リフォーム会社 営業時間外 問い合わせ', 'renovation-after-hours-inquiry'],
  ['marketing', '外壁塗装 問い合わせ 繁忙期', 'painting-inquiry-seasonality'],
  ['marketing', 'リフォーム 集客経路 効果測定', 'renovation-channel-attribution'],
  ['marketing', 'リフォーム 商談 メモ 管理', 'renovation-sales-meeting-notes'],
  ['marketing', 'リフォーム会社 紹介案件 フォロー', 'renovation-referral-follow-up'],

  // web — 問い合わせ前後の導線と計測
  ['web', '外壁塗装 問い合わせ 返信', 'painting-inquiry-response'],
  ['web', 'リフォーム会社 問い合わせフォーム', 'renovation-inquiry-form'],
  ['web', 'リフォーム会社 LINE 問い合わせ', 'renovation-line-inquiry'],
  ['web', 'リフォーム会社 ホームページ 問い合わせ', 'renovation-website-inquiry'],
  ['web', 'リフォーム会社 ランディングページ 改善', 'renovation-landing-page-improvement'],
  ['web', '外壁塗装 ホームページ CTA', 'painting-website-cta'],
  ['web', 'リフォーム 問い合わせフォーム 離脱', 'renovation-form-abandonment'],
  ['web', 'リフォーム 問い合わせ 自動返信', 'renovation-auto-reply'],
  ['web', 'リフォーム ホームページ LINE 導線', 'renovation-website-line-cta'],
  ['web', '外壁塗装 ホームページ スマホ対応', 'painting-mobile-website'],
  ['web', 'リフォーム サンクスページ 改善', 'renovation-thank-you-page'],
  ['web', 'リフォーム 問い合わせ 計測 GA4', 'renovation-inquiry-tracking-ga4'],
  ['web', '外壁塗装 問い合わせ 写真 添付', 'painting-inquiry-photo-upload'],
  ['web', 'リフォーム 問い合わせ 個人情報', 'renovation-form-privacy'],
  ['web', 'リフォーム会社 地域 SEO 問い合わせ', 'renovation-local-seo-conversion'],
  ['web', 'リフォーム サービスページ 作り方', 'renovation-service-page'],
  ['web', '外壁塗装 施工事例 問い合わせ', 'painting-case-study-conversion'],
  ['web', 'リフォーム ホームページ FAQ', 'renovation-website-faq'],
  ['web', 'リフォーム会社 アクセス解析 見方', 'renovation-web-analytics'],
  ['web', 'リフォーム会社 ヒートマップ 改善', 'renovation-heatmap-improvement'],

  // shikumika — 台帳・SLA・追客・標準化
  ['shikumika', 'リフォーム会社 顧客管理 Excel', 'renovation-customer-management-excel'],
  ['shikumika', 'リフォーム会社 案件管理', 'renovation-project-management'],
  ['shikumika', 'リフォーム会社 営業管理', 'renovation-sales-management'],
  ['shikumika', 'リフォーム会社 営業 自動化', 'renovation-sales-automation'],
  ['shikumika', 'リフォーム会社 追客', 'renovation-sales-follow-up'],
  ['shikumika', '外壁塗装 現地調査 ヒアリング', 'painting-site-survey-hearing'],
  ['shikumika', 'リフォーム会社 CRM 選び方', 'renovation-crm-selection'],
  ['shikumika', 'リフォーム 営業 パイプライン', 'renovation-sales-pipeline'],
  ['shikumika', 'リフォーム 次回行動日 管理', 'renovation-next-action-date'],
  ['shikumika', 'リフォーム 見積 リマインド 自動化', 'renovation-estimate-reminder'],
  ['shikumika', 'リフォーム 未対応 通知', 'renovation-unhandled-lead-alert'],
  ['shikumika', 'リフォーム 追客 メール テンプレート', 'renovation-follow-up-email-template'],
  ['shikumika', 'リフォーム会社 タスク管理', 'renovation-task-management'],
  ['shikumika', 'リフォーム 顧客管理 Excel 限界', 'renovation-excel-limitations'],
  ['shikumika', 'リフォーム 問い合わせ 担当 振り分け', 'renovation-lead-routing'],
  ['shikumika', 'リフォーム 顧客台帳 項目', 'renovation-customer-ledger-fields'],
  ['shikumika', '問い合わせ 対応 SLA リフォーム', 'renovation-response-sla'],
  ['shikumika', 'リフォーム 営業 引き継ぎ', 'renovation-sales-handoff'],
  ['shikumika', 'リフォーム 失注理由 管理', 'renovation-loss-reason-management'],
  ['shikumika', 'リフォーム 売上予測 案件管理', 'renovation-sales-forecast'],
  ['shikumika', 'リフォーム 見積書 管理', 'renovation-quote-management'],
  ['shikumika', 'リフォーム 顧客情報 重複', 'renovation-duplicate-customer-data'],
  ['shikumika', 'リフォーム 顧客管理 権限', 'renovation-crm-permissions'],
  ['shikumika', 'リフォーム 営業 マニュアル', 'renovation-sales-manual'],
  ['shikumika', 'リフォーム 問い合わせ 対応 手順書', 'renovation-inquiry-sop'],
  ['shikumika', 'リフォーム 業務 自動化 設計', 'renovation-automation-design'],
  ['shikumika', 'リフォーム 自動化 例外処理', 'renovation-automation-exceptions'],
  ['shikumika', 'リフォーム KPI 会議', 'renovation-kpi-meeting'],
  ['shikumika', 'リフォーム 営業 ダッシュボード', 'renovation-sales-dashboard'],
  ['shikumika', 'リフォーム 営業仕組み化 30日', 'renovation-sales-system-30-days'],

  // ai — 人が承認する安全な効率化
  ['ai', 'リフォーム会社 DX', 'renovation-dx'],
  ['ai', 'リフォーム会社 AI 活用', 'renovation-ai-use'],
  ['ai', '外壁塗装 営業 効率化', 'painting-sales-efficiency'],
  ['ai', 'リフォーム 顧客対応 自動化', 'renovation-customer-response-automation'],
  ['ai', 'リフォーム 追客文 AI 作成', 'renovation-ai-follow-up-draft'],
  ['ai', 'リフォーム 問い合わせ AI 分類', 'renovation-ai-inquiry-classification'],
  ['ai', 'リフォーム 商談 議事録 AI', 'renovation-ai-meeting-notes'],
  ['ai', 'リフォーム 見積 説明 AI', 'renovation-ai-estimate-explanation'],
  ['ai', 'リフォーム FAQ AI', 'renovation-ai-faq'],
  ['ai', 'リフォーム会社 生成AI ガイドライン', 'renovation-generative-ai-guidelines'],
  ['ai', 'リフォーム 顧客情報 AI 個人情報', 'renovation-ai-personal-data'],
  ['ai', 'リフォーム AI 人間 承認', 'renovation-ai-human-approval'],
  ['ai', 'リフォーム AI 誤回答 対策', 'renovation-ai-hallucination-prevention'],
  ['ai', 'リフォーム会社 AI プロンプト', 'renovation-ai-prompts'],
  ['ai', '中小リフォーム会社 AI 導入', 'small-renovation-company-ai-adoption'],
];

if (topics.length < 90) throw new Error(`記事候補が${topics.length}件しかありません。90件以上必要です。`);

const values = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] ?? '' : '';
};

const focusRule = values('--focus-rule');
const focusCategory = values('--focus-category');
const focusKeyword = values('--focus-keyword');
const output = process.env.GITHUB_OUTPUT;

const writeOutput = (entries) => {
  if (!output) return;
  appendFileSync(output, [...entries, ''].join('\n'));
};

if (focusRule === 'C' || focusRule === 'DATA_ERROR') {
  const reason = focusRule === 'C' ? 'コンバージョン障害の修正を優先' : '計測障害の復旧を優先';
  console.log(`本日は新規記事を作成しません: ${reason}`);
  writeOutput(['has_topic=false', `selection_basis=${reason}`]);
  process.exit(0);
}

const existing = existsSync(CONTENT_DIR)
  ? readdirSync(CONTENT_DIR)
      .filter((name) => name.endsWith('.md'))
      .map((name) => readFileSync(join(CONTENT_DIR, name), 'utf8'))
      .join('\n')
  : '';

const pending = topics.filter(([, keyword, slug]) => {
  return !existsSync(join(CONTENT_DIR, `${slug}.md`)) && !existing.includes(`primaryKeyword: ${keyword}`);
});

const focusTokens = focusKeyword.split(/\s+/).filter((token) => token.length >= 2);
const score = ([category, keyword]) => {
  // まだ表示データがないRule Eの日に既存記事のカテゴリへ寄せると、
  // 商談から遠い一般論を量産しやすい。初期は並び順（商談への近さ）を優先する。
  const categoryScore = focusRule !== 'E' && focusCategory && category === focusCategory ? 100 : 0;
  const keywordScore = focusTokens.reduce((sum, token) => sum + (keyword.includes(token) ? 10 : 0), 0);
  return categoryScore + keywordScore;
};

const selected = [...pending].sort((a, b) => score(b) - score(a))[0];

if (!selected) {
  console.log('90日分の記事候補をすべて消化しました。次の四半期設計が必要です。');
  writeOutput(['has_topic=false', 'selection_basis=90日バックログ完了']);
  process.exit(0);
}

const [category, keyword, slug] = selected;
const basis = focusCategory
  ? `Daily Growth Reportの${focusRule || '優先'}判定・${focusCategory}カテゴリに接続`
  : '90日商談直結バックログから選定';

console.log(`本日の候補: [${category}] ${keyword} (${slug})`);
console.log(`選定根拠: ${basis}`);

writeOutput([
  'has_topic=true',
  `category=${category}`,
  `keyword=${keyword}`,
  `slug=${slug}`,
  `selection_basis=${basis}`,
]);
