#!/usr/bin/env node
/** シクミベースの日次コンテンツ候補を選ぶ。Web/SNS/AIは仕組み化の手段として扱う。 */
import { existsSync, readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
const CONTENT_DIR='src/content/knowledge';
const baseTopics=[
['shikumika','中小企業 属人化 解消','sme-dependency-reduction'],['shikumika','社長依存 脱却','owner-dependency-reduction'],['shikumika','業務標準化 進め方','business-standardization-guide'],['shikumika','仕組み化すべき業務','what-to-systemize'],['shikumika','業務フロー 可視化','business-flow-visualization'],['shikumika','業務マニュアル 作り方 中小企業','sme-operation-manual'],['shikumika','引き継ぎ 属人化 解消','handover-dependency-reduction'],['shikumika','業務改善 優先順位','process-improvement-priority'],['shikumika','中小企業 KPI 設計','sme-kpi-design'],['shikumika','業務改善 定着しない','process-improvement-adoption'],
['marketing','営業 仕組み化 中小企業','sme-sales-systemization'],['marketing','紹介営業 依存 脱却','referral-sales-dependency'],['marketing','反響営業 仕組み','inbound-sales-system'],['marketing','問い合わせ対応 属人化','inquiry-response-dependency'],['marketing','営業プロセス 標準化','sales-process-standardization'],['marketing','営業 引き継ぎ 仕組み','sales-handover-system'],['marketing','営業 KPI 中小企業','sme-sales-kpi'],['marketing','見込み客 フォロー 仕組み','lead-follow-up-system'],['marketing','問い合わせ管理 仕組み化','inquiry-management-systemization'],['marketing','営業会議 KPI 改善','sales-meeting-kpi'],['marketing','発信 仕組み化','content-publishing-system'],['marketing','SNS運用 属人化 解消','social-media-dependency-reduction'],['marketing','コンテンツ制作 仕組み化','content-production-system'],['marketing','情報発信 継続できない 企業','sustainable-company-publishing'],['marketing','広報 業務 標準化','pr-work-standardization'],
['web','Web 営業資産','web-as-sales-asset'],['web','ホームページ 問い合わせ 導線 改善','website-inquiry-path'],['web','Webサイト 営業 仕組み','website-sales-system'],['web','コンテンツマーケティング 仕組み化','content-marketing-systemization'],['web','Webサイト 改善 PDCA','website-improvement-cycle'],['web','問い合わせ 計測 GA4','inquiry-tracking-ga4'],['web','サービスページ 改善 問い合わせ','service-page-conversion'],['web','事例ページ 問い合わせ','case-study-conversion'],['web','SEO 属人化 解消','seo-dependency-reduction'],['web','Web運用 内製化 仕組み','web-operations-system'],
['ai','AI 業務フロー 組み込む','ai-in-business-workflow'],['ai','中小企業 AI 業務改善','sme-ai-process-improvement'],['ai','生成AI 業務標準化','generative-ai-standardization'],['ai','AI導入 定着しない','ai-adoption-failure'],['ai','AI 人間 承認 業務フロー','ai-human-approval-workflow'],['ai','生成AI ガイドライン 中小企業','sme-generative-ai-guidelines'],['ai','AI 業務マニュアル 作成','ai-operation-manual'],['ai','AI 議事録 業務フロー','ai-meeting-notes-workflow'],['ai','AI 問い合わせ対応 下書き','ai-inquiry-drafting'],['ai','AI 自動化 しない業務','what-not-to-automate-with-ai']];
const topics=baseTopics.flatMap(([c,k,s])=>[[c,k,s],[c,`${k} 実践`,`${s}-practice`]]);
if(topics.length<90) throw new Error(`記事候補が${topics.length}件しかありません。90件以上必要です。`);
const value=f=>{const i=process.argv.indexOf(f);return i>=0?process.argv[i+1]??'':''};
const focusRule=value('--focus-rule'),focusCategory=value('--focus-category'),focusKeyword=value('--focus-keyword'),output=process.env.GITHUB_OUTPUT;
const out=e=>{if(output)appendFileSync(output,[...e,''].join('\n'))};
if(focusRule==='C'||focusRule==='DATA_ERROR'){const r=focusRule==='C'?'コンバージョン障害の修正を優先':'計測障害の復旧を優先';out(['has_topic=false',`selection_basis=${r}`]);process.exit(0)}
const existing=existsSync(CONTENT_DIR)?readdirSync(CONTENT_DIR).filter(n=>n.endsWith('.md')).map(n=>readFileSync(join(CONTENT_DIR,n),'utf8')).join('\n'):'';
const pending=topics.filter(([,k,s])=>!existsSync(join(CONTENT_DIR,`${s}.md`))&&!existing.includes(`primaryKeyword: ${k}`));
const tokens=focusKeyword.split(/\s+/).filter(t=>t.length>=2);const score=([c,k])=>(focusRule!=='E'&&focusCategory===c?100:0)+tokens.reduce((n,t)=>n+(k.includes(t)?10:0),0);const selected=[...pending].sort((a,b)=>score(b)-score(a))[0];
if(!selected){out(['has_topic=false','selection_basis=バックログ完了']);process.exit(0)}
const [category,keyword,slug]=selected;out(['has_topic=true',`category=${category}`,`keyword=${keyword}`,`slug=${slug}`,`selection_basis=${focusKeyword?`計測フォーカス「${focusKeyword}」との近さ`:'仕組み化ブランドの商談近接テーマ順'}`]);console.log({category,keyword,slug});
