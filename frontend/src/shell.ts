import {connect,currentAccount,disconnect,provider,read,write,inspect,inspectRaw} from './wallet';
import {assertTarget,PendingSubmission,type TransactionContext} from './core';
import type {CalldataEncodable,GenLayerTransaction} from 'genlayer-js/types';
export const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
export const value=(id:string)=>el<HTMLInputElement>(id).value.trim();
export const json=(v:unknown)=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x,2);
export function cell(row:HTMLElement,text:string,tag='td'){const c=document.createElement(tag);c.textContent=text;row.append(c);return c;}
export function boot(title:string,intro:string,workflow:string){
 document.querySelector('#app')!.innerHTML=`<header><strong>${title}</strong><span>GENLAYER · EXPERIMENTAL PROTOTYPE</span></header><main><section class="hero"><p class="eyebrow">PUBLIC SNAPSHOT / DETERMINISTIC RESULT</p><h1>${title}</h1><p>${intro}</p><aside>Local candidate. Demo inputs are fictional and unpublished. Enter a real deployed address and a published source before using transactions.</aside></section><section class="card connection"><h2>Connect a deployment</h2><label>Actual contract address<input id="address" placeholder="0x… not configured"></label><div class="actions"><button id="connect">Connect MetaMask · Studio61999</button><p id="account">Wallet disconnected</p></div><p id="connection" role="status"></p></section>${workflow}<section class="card"><p class="eyebrow">TRANSACTION EVIDENCE</p><h2>Receipt and recovery</h2><p>Completion requires raw FINALIZED and matching consensus SUCCESS evidence (SDK fields are checked when available) for the original sender, target, hash and zero value. Missing, failed or ambiguous evidence retains the hash; no automatic resubmission occurs.</p><label>GenLayer transaction ID<input id="txId" placeholder="0x…"></label><button id="inspect">Inspect this transaction</button><p id="pending" role="status"></p><ol id="trail" aria-live="polite"></ol><pre id="receipt">No receipt inspected</pre></section><footer>AI-assisted prototype · Testnet only · No funds or external effects</footer></main>`;
 const guard=new PendingSubmission({getItem:k=>window.localStorage.getItem(k),setItem:(k,v)=>window.localStorage.setItem(k,v),removeItem:k=>window.localStorage.removeItem(k)},title+':studio:pending');
 let busy=false;let onClear=()=>{};let onGate=()=>{};
 if(guard.pending)el<HTMLInputElement>('txId').value=guard.pending;
 function log(line:string){const li=document.createElement('li');li.textContent=new Date().toLocaleTimeString()+' · '+line;el('trail').prepend(li);}
 function refresh(){let configured=false;try{assertTarget(value('address'),61999,61999);configured=true;}catch{}
  el('account').textContent=currentAccount()||'Wallet disconnected';el('connection').textContent=configured?'Deployment entered · Studio chain61999':'Unconfigured — enter an actual deployment';
  document.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('input,textarea').forEach(x=>x.disabled=busy);
  document.querySelectorAll<HTMLButtonElement>('button').forEach(x=>x.disabled=busy);
  document.querySelectorAll<HTMLButtonElement>('.write').forEach(x=>x.disabled=busy||!configured||!currentAccount()||!!guard.pending);
  el<HTMLButtonElement>('load').disabled=busy||!configured;
  el('pending').textContent=(guard.pending?'Unresolved: '+guard.pending+'. Inspect this exact hash before another write.':'')+(!guard.persistent?' Browser storage unavailable; retain your transaction ID before leaving.':'');onGate();
 }
 async function run(fn:()=>Promise<unknown>){if(busy)return;busy=true;refresh();try{await fn();}catch(e){log(e instanceof Error?e.message:'Operation failed. Inspect the last submission.');}finally{busy=false;refresh();}}
 el('connect').addEventListener('click',()=>run(async()=>{await connect('studio');log('Wallet connected on Studio61999.');}));
 el('address').addEventListener('input',()=>{onClear();refresh();});
 el('inspect').addEventListener('click',()=>run(async()=>{const id=value('txId');if(guard.pending==='UNKNOWN_NO_HASH')guard.attach(id);let tx:GenLayerTransaction|null=null;try{tx=await inspect('studio',id as `0x${string}`);}catch{log('SDK inspection unavailable; checking raw receipt without another submission.');}el('receipt').textContent=json({sdk:tx});const raw=await inspectRaw('studio',id);el('receipt').textContent=json({sdk:tx,raw});const outcome=guard.resolve(id,tx,raw);log(outcome==='success'?'Original transaction and raw consensus success verified. Read the current record.':'The tracked original transaction is not proven successful. Retain the hash; another write remains blocked.');}));
 try{const p=provider() as ReturnType<typeof provider>&{on?:(event:string,fn:()=>void)=>void};for(const event of ['accountsChanged','chainChanged'])p.on?.(event,()=>{disconnect();onClear();refresh();});}catch{}
 refresh();return {refresh,log,run,account:currentAccount,setHooks(clear:()=>void,gate:()=>void){onClear=clear;onGate=gate;refresh();},
  async send(method:string,args:CalldataEncodable[]){if(guard.pending)throw Error('Inspect the unresolved submitted transaction first.');const target=value('address'),context:TransactionContext={from:currentAccount(),to:target,value:0n};try{await write('studio',target,method,args,line=>{if(line==='Submission attempt started')guard.begin(context);if(line.startsWith('Submitted: ')){guard.record(line.slice(11),context);el<HTMLInputElement>('txId').value=guard.pending;}log(line);},(hash,tx,raw)=>{guard.resolve(hash,tx,raw);el('receipt').textContent=json({sdk:tx,raw});});}catch(error){guard.reject(error);throw error;}},
  async read(method:string,args:CalldataEncodable[]){return read('studio',value('address'),method,args);}};
}
