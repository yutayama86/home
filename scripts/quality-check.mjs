#!/usr/bin/env node
/** シクミベース共通品質ゲート。特定業界・商品・固定価格には依存しない。 */
import { readFileSync,readdirSync,existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
const DIRS=['src/content/knowledge','src/content/case'];const errors=[],warnings=[];
const err=(f,m)=>errors.push({file:f,message:m}),warn=(f,m)=>warnings.push({file:f,message:m});
function parse(raw){const m=raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);if(!m)return null;const data={};let key=null;for(const line of m[1].split('\n')){const li=line.match(/^\s+-\s+(.*)$/);if(li&&key){if(!Array.isArray(data[key]))data[key]=[];data[key].push(li[1].trim());continue}const p=line.match(/^([a-zA-Z]+):\s*(.*)$/);if(p){key=p[1];data[key]=p[2].trim()||[]}}return{data,body:m[2]}}
function all(){return DIRS.flatMap(d=>existsSync(d)?readdirSync(d).filter(n=>n.endsWith('.md')).map(n=>join(d,n)):[])}
function changed(){try{return execSync('git diff --name-only HEAD~1 HEAD',{encoding:'utf8'}).split('\n').filter(f=>f.startsWith('src/content/')&&f.endsWith('.md')&&existsSync(f))}catch{return all()}}
function check(file,raw){const p=parse(raw);if(!p){err(file,'frontmatterを解析できません');return}const{data,body}=p;if(file.includes('/knowledge/')){if(!data.intent)err(file,'intent（検索意図）が未設定です');if(!data.primaryKeyword)err(file,'primaryKeyword が未設定です');const links=body.match(/\]\(\/(knowledge|service|case|contact)\/?/g)??[];if(!links.length)err(file,'関連記事・支援・事例・相談への内部導線がありません');if(!/^##\s*(まとめ|結論)/m.test(body))warn(file,'まとめ/結論の見出しがありません')}
const banned=['株式会社シクミベース','代表取締役','弊社は法人'];for(const w of banned)if(raw.includes(w))err(file,`法人化前のため使用できない表記: ${w}`);
const legacy=['リフォーム反響OS 30','見積フォロー漏れ診断','住宅リフォーム会社のあなたは'];for(const w of legacy)if(raw.includes(w))err(file,`旧リフォーム特化ブランド表現が残っています: ${w}`);
const risky=[/(?:必ず|確実に)(?:節税|控除|還付)/,/法律上(?:問題ありません|可能です)/,/(?:100%|絶対に)(?:成果|効果|上位表示)/];for(const r of risky)if(r.test(body))err(file,'法務・税務・成果について過度な断定があります');
const claims=body.match(/\d+(?:[.,]\d+)?\s*(?:件|円|万円|億円|日|時間|分|%|％|倍|割)\s*(?:向上|増加|改善|削減|減少|短縮|アップ|上昇|低下|獲得|達成|回復)/g)??[];for(const c of new Set(claims)){const para=body.split('\n\n').find(x=>x.includes(c));if(!para||!/\[.+?\]\(https?:\/\//.test(para))err(file,`出典のない成果数値: ${c}`)}
const chars=body.replace(/\s/g,'').length;if(chars<1200)warn(file,`本文が短めです（約${chars}文字）`);
if(String(data.generated??'').replace(/["']/g,'')==='true'){if(chars<1800)err(file,`自動生成記事が短すぎます（約${chars}文字）`);if(!/(仕組|標準|再現|属人)/.test(body))err(file,'自動生成記事がシクミベースの「再現可能な仕組み」という中核テーマに接続していません');if(!/(人が確認|人間が確認|承認|レビュー)/.test(body)&&/(AI|自動化)/.test(body))warn(file,'AI/自動化記事に人間確認・承認の境界が明示されていません')}
}
const files=process.argv.includes('--changed')?changed():all();for(const f of files)check(f,readFileSync(f,'utf8'));for(const w of warnings)console.warn(`WARN ${w.file}: ${w.message}`);for(const e of errors)console.error(`ERROR ${e.file}: ${e.message}`);console.log(`Quality check: ${files.length} files / ${errors.length} errors / ${warnings.length} warnings`);if(errors.length)process.exit(1);
