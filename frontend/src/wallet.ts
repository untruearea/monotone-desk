import {createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import type {CalldataEncodable,TransactionHash,GenLayerTransaction} from 'genlayer-js/types';
import {assertTarget,completeWrite,type TransactionContext} from './core';
export const networks={studio:studionet};
type Provider=NonNullable<NonNullable<Parameters<typeof createClient>[0]>['provider']>;
let account:`0x${string}`|undefined;
export function provider():Provider{const p=(window as unknown as {ethereum?:Provider}).ethereum;if(!p)throw Error('Install or unlock MetaMask for Studio testnet.');return p;}
export function disconnect():void{account=undefined;}
export function currentAccount():string{return account??'';}
export async function connect(network:keyof typeof networks):Promise<string>{const p=provider(),chain=networks[network];const accounts=await p.request({method:'eth_requestAccounts'}) as string[];const selected=accounts[0];if(!/^0x[0-9a-fA-F]{40}$/.test(selected??''))throw Error('No wallet account.');try{await p.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x'+chain.id.toString(16)}]});}catch(error){if((error as {code?:number}).code!==4902)throw error;await p.request({method:'wallet_addEthereumChain',params:[{chainId:'0x'+chain.id.toString(16),chainName:chain.name,nativeCurrency:chain.nativeCurrency,rpcUrls:[...chain.rpcUrls.default.http]}]});}account=selected as `0x${string}`;return selected;}
export async function inspectRaw(network:keyof typeof networks,hash:string):Promise<unknown>{
 if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw Error('A 32-byte transaction ID is required.');
 const response=await fetch(networks[network].rpcUrls.default.http[0],{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_getTransactionByHash',params:[hash]}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Raw public RPC inspection unavailable. Retain hash.');const r=await response.json();if(r.error||!r.result)throw Error('Raw public RPC transaction unavailable. Retain hash.');return r.result;
}
export async function write(network:keyof typeof networks,address:string,method:string,args:CalldataEncodable[],report:(text:string)=>void,onReceipt?:(hash:`0x${string}`,tx:GenLayerTransaction|null,raw:unknown)=>void):Promise<`0x${string}`>{
 if(!account)throw Error('Connect wallet first.');const p=provider(),chain=networks[network];assertTarget(address,Number(await p.request({method:'eth_chainId'})),chain.id);
 const active=(await p.request({method:'eth_accounts'}) as string[])[0];if(active?.toLowerCase()!==account.toLowerCase()){disconnect();throw Error('Wallet account changed; reconnect.');}
 const signer=account,expected:TransactionContext={from:signer,to:address,value:0n},reader=createClient({chain}),signed=createClient({chain,account:signer,provider:p});
 return completeWrite(async()=>{const h=await signed.writeContract({address,functionName:method,args,value:0n});if(typeof h!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(h))throw Error('SDK returned invalid transaction ID.');return h as `0x${string}`;},hash=>reader.waitForTransactionReceipt({hash:hash as TransactionHash,waitUntil:'finalized',fullTransaction:true,interval:5000,retries:120}),report,hash=>inspectRaw(network,hash),expected,onReceipt);
}
export async function read(network:keyof typeof networks,address:string,method:string,args:CalldataEncodable[]):Promise<unknown>{const chain=networks[network];assertTarget(address,chain.id,chain.id);const value=await createClient({chain}).readContract({address,functionName:method,args});if(value===null||typeof value!=='object'||Array.isArray(value)||(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null))throw Error('Unexpected contract view object.');return value;}
export async function inspect(network:keyof typeof networks,hash:`0x${string}`):Promise<GenLayerTransaction>{if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw Error('Transaction ID must be 32-byte hex.');return createClient({chain:networks[network]}).getTransaction({hash:hash as TransactionHash});}
