export interface Rational{numerator:number;denominator:number}
export interface Loss{numerator:number|string|bigint;denominator:number|string|bigint}
export interface Bin{score:number;count:number;positives:number}
export interface Fitted extends Bin{block:number;rate:Rational}
export interface FitRecord{fit_id:string;creator:string;status:string;revision:number;certificate_id:string;data:{version:number;bins:Bin[]};result:{aggregated:Bin[];blocks:{scores:number[];count:number;positives:number;rate:Rational}[];fitted:Fitted[];weighted_bin_sse:Loss;bernoulli_sse:Loss}|null}
export function openArgs(id:string,url:string,sha:string):[string,string,string]{
 if(!/^[A-Za-z0-9_-]{1,64}$/.test(id))throw Error('Use a unique 1–64 character ASCII ID.');
 const m=url.match(/^https:\/\/raw\.githubusercontent\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9_.-]{1,100})\/([0-9a-f]{40})\/([A-Za-z0-9_.~/-]+)$/);
 if(!m||m[0]!==url||url.length>512||!/[A-Za-z0-9]/.test(m[1][0])||!/[A-Za-z0-9]/.test(m[1].at(-1)!)||m[1].includes('--')||url.split('/').slice(3).some(s=>!s||s==='.'||s==='..'))throw Error('Use an unambiguous public commit-pinned GitHub URL.');
 if(!/^[0-9a-f]{64}$/.test(sha))throw Error('Enter the exact lowercase byte SHA256.');return [id,url,sha];
}
const validRate=(q:Rational)=>Number.isSafeInteger(q.numerator)&&Number.isSafeInteger(q.denominator)&&q.denominator>0&&q.denominator<=100000&&q.numerator>=0&&q.numerator<=q.denominator;
const same=(a:Rational,b:Rational)=>a.numerator*b.denominator===b.numerator*a.denominator;
export function fitRows(r:FitRecord):Fitted[]{
 if(r.status==='OPEN'||!r.result)return [];const p=r.result,rows=p.fitted;
 if(!rows.length||rows.length>16||!p.blocks.length)throw Error('Incomplete fit record.');
 const scores=new Set<number>();let previous:Fitted|undefined;
 for(const row of rows){
  if(!Number.isSafeInteger(row.score)||row.score<0||row.score>10000||scores.has(row.score)||!Number.isSafeInteger(row.count)||row.count<1||!Number.isSafeInteger(row.positives)||row.positives<0||row.positives>row.count||!validRate(row.rate))throw Error('Invalid fit record.');
  if(previous&&(row.score<=previous.score||row.rate.numerator*previous.rate.denominator<previous.rate.numerator*row.rate.denominator))throw Error('Decreasing fit record.');
  if(!Number.isInteger(row.block)||!p.blocks[row.block]?.scores.includes(row.score)||!same(row.rate,p.blocks[row.block].rate))throw Error('Block membership mismatch.');
  scores.add(row.score);previous=row;
 }
 const membership=p.blocks.flatMap(b=>b.scores);if(membership.length!==rows.length||membership.some((s,i)=>s!==rows[i].score))throw Error('Incomplete block coverage.');return rows;
}
export function canConfirm(r:FitRecord,account:string,visibleId:string=r.fit_id):boolean{try{return visibleId===r.fit_id&&r.status==='DERIVED'&&r.revision===1&&r.creator.toLowerCase()===account.toLowerCase()&&/^[0-9a-f]{64}$/.test(r.certificate_id)&&fitRows(r).length>0;}catch{return false;}}
export function fraction(q:Loss):string{return String(q.numerator)+' / '+String(q.denominator);}
