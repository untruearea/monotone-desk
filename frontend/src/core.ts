import {isSuccessful} from 'genlayer-js';
import {TransactionStatus,executionResultNumberToName,type GenLayerTransaction} from 'genlayer-js/types';
const resultNames:Readonly<Record<string,string>>=executionResultNumberToName;
export interface TransactionContext{from:string;to:string;value:bigint}
const address=(v:unknown):v is string=>typeof v==='string'&&/^0x[0-9a-fA-F]{40}$/.test(v)&&!/^0x0{40}$/.test(v);
const hashId=(v:unknown):v is string=>typeof v==='string'&&/^0x[0-9a-fA-F]{64}$/.test(v);
const object=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
const equal=(a:unknown,b:string)=>typeof a==='string'&&a.toLowerCase()===b.toLowerCase();
function contextValid(c:TransactionContext):boolean{return !!c&&address(c.from)&&address(c.to)&&c.value===0n;}
export function assertTarget(target:string,walletChain:number,expectedChain:number):asserts target is `0x${string}`{if(!address(target))throw Error('Configure a real deployment address first.');if(walletChain!==expectedChain)throw Error('Wallet network does not match Studio61999.');}
function assertSdk(tx:GenLayerTransaction|null,hash:string,c:TransactionContext):void{
 if(!contextValid(c))throw Error('Original transaction context is missing.');
 if(!tx)return; // Studio's formatter may throw; raw evidence must still independently prove everything.
 for(const [values,expected] of [[[tx.hash,tx.txId],hash],[[tx.sender,tx.from_address],c.from],[[tx.recipient,tx.to_address],c.to]] as [unknown[],string][]){if(values.some(v=>v!==undefined&&!equal(v,expected)))throw Error('SDK transaction hash/sender/target binding conflicts.');}
 if(tx.value!==undefined&&tx.value!==0&&(tx.value as unknown)!==0n)throw Error('SDK transaction zero value binding conflicts.');
 if((tx.statusName!==undefined&&tx.statusName!==TransactionStatus.FINALIZED)||(tx.lifecycle?.state!==undefined&&tx.lifecycle.state!=='finalized'))throw Error('Finality is unresolved. Retain and inspect the exact hash.');
 if(tx.txExecutionResultName!==undefined&&tx.txExecutionResult!==undefined&&resultNames[String(tx.txExecutionResult)]!==tx.txExecutionResultName)throw Error('Conflicting SDK named and numeric execution results.');
 // Actual Studio branch omits train execution fields; do not synthesize them to satisfy this helper.
 if((tx.txExecutionResultName!==undefined||tx.txExecutionResult!==undefined)&&!isSuccessful(tx))throw Error('Contract execution failed or is unknown; completion is not proven.');
}
export function assertRawTransaction(value:unknown,expected:TransactionContext&{hash:string}):void{
 const r=object(value);
 if(!r||!contextValid(expected)||!hashId(expected.hash)||!equal(r.hash,expected.hash)||!equal(r.from_address,expected.from)||!equal(r.to_address,expected.to))throw Error('Raw transaction hash/sender/target binding is missing or mismatched.');
 if(!((typeof r.value==='number'&&Number.isSafeInteger(r.value)&&r.value===0)||(typeof r.value==='string'&&/^(0|0x0+)$/.test(r.value))))throw Error('Raw transaction zero value is missing or mismatched.');
 if(r.status!=='FINALIZED'||r.execution_mode!=='NORMAL'||r.leader_only!==false)throw Error('Raw finality or normal consensus mode is unresolved.');
 if(r.result_name!=='MAJORITY_AGREE')throw Error('Raw consensus is not majority-agree; no business completion is proven.');
 const receipts=object(r.consensus_data)?.leader_receipt;
 if(!Array.isArray(receipts))throw Error('Raw leader evidence is missing.');
 const leaders=receipts.map(object).filter(x=>x?.mode==='leader');
 // Multiple leader entries have no proven current-round identity here: retain hash.
 if(leaders.length!==1||leaders[0]?.execution_result!=='SUCCESS')throw Error('Raw receipt has no unambiguous successful leader execution.');
 // IDLE validator votes can accompany a genuine majority; do not label them leader failure.
}
export async function completeWrite(submit:()=>Promise<`0x${string}`>,wait:(hash:`0x${string}`)=>Promise<GenLayerTransaction>,report:(line:string)=>void,verifyRaw:(hash:`0x${string}`)=>Promise<unknown>,expected:TransactionContext,onReceipt?:(hash:`0x${string}`,tx:GenLayerTransaction|null,raw:unknown)=>void):Promise<`0x${string}`>{
 if(!contextValid(expected))throw Error('Original transaction context is required.');
 report('Awaiting wallet approval…');report('Submission attempt started');const hash=await submit();if(!hashId(hash))throw Error('Invalid submitted transaction hash.');report('Submitted: '+hash);
 let tx:GenLayerTransaction|null=null;try{tx=await wait(hash);report('Stored SDK status: '+(tx.statusName??'unknown')+'; execution: '+(tx.txExecutionResultName??'unavailable'));}catch{report('SDK observation unavailable; checking the exact public raw receipt without resubmitting.');}
 assertSdk(tx,hash,expected);
 if(typeof verifyRaw!=='function')throw Error('Raw public RPC evidence is required.');
 const raw=await verifyRaw(hash);assertRawTransaction(raw,{...expected,hash});
 onReceipt?.(hash,tx,raw);report('Finalized; original transaction and raw consensus execution success verified.');return hash;
}
interface StoragePort{getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
export class PendingSubmission{
 pending='';persistent=true;context:TransactionContext|null=null;
 constructor(private storage:StoragePort,private key:string){try{const saved=storage.getItem(key);if(!saved)return;if(hashId(saved)){this.pending=saved;return;}const r=JSON.parse(saved);if(hashId(r.hash)||r.hash==='UNKNOWN_NO_HASH'){this.pending=r.hash;const c={from:r.from,to:r.to,value:r.value==='0'?0n:1n};if(contextValid(c))this.context=c;}}catch{this.persistent=false;}}
 begin(context:TransactionContext){if(this.pending||!contextValid(context))throw Error('An unresolved submission or invalid original context blocks another attempt.');this.pending='UNKNOWN_NO_HASH';this.context={...context};this.save();}
 private save(){try{this.storage.setItem(this.key,JSON.stringify({hash:this.pending,from:this.context?.from,to:this.context?.to,value:'0'}));}catch{this.persistent=false;}}
 reject(error:unknown){if(this.pending==='UNKNOWN_NO_HASH'&&(error as {code?:number})?.code===4001){this.pending='';this.context=null;try{this.storage.removeItem(this.key);}catch{this.persistent=false;}}}
 attach(hash:string){if(this.pending!=='UNKNOWN_NO_HASH'||!this.context||!hashId(hash))throw Error('Original missing-hash context and a valid wallet-activity hash required.');this.record(hash,this.context);}
 record(hash:string,context:TransactionContext){if(!hashId(hash)||!contextValid(context))throw Error('Exact submitted hash and original zero-value sender/target required.');this.pending=hash;this.context={...context};try{this.storage.setItem(this.key,JSON.stringify({hash,from:context.from,to:context.to,value:'0'}));}catch{this.persistent=false;}}
 resolve(hash:string,tx:GenLayerTransaction|null,raw:unknown):'unknown'|'success'{
  if(!this.context||!equal(hash,this.pending))return 'unknown';
  try{assertSdk(tx,this.pending,this.context);assertRawTransaction(raw,{...this.context,hash:this.pending});}catch{return 'unknown';}
  this.pending='';this.context=null;try{this.storage.removeItem(this.key);}catch{this.persistent=false;}return 'success';
 }
}
