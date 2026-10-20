import {expect,it} from 'vitest';
import {openArgs,fitRows,canConfirm} from '../src/domain';
const creator='0x1111111111111111111111111111111111111111';
const rate={numerator:1,denominator:2};
const record={fit_id:'sample',creator,status:'DERIVED',revision:1,certificate_id:'b'.repeat(64),data:{version:1,bins:[{score:1,count:10,positives:8},{score:2,count:10,positives:2}]},result:{aggregated:[{score:1,count:10,positives:8},{score:2,count:10,positives:2}],blocks:[{scores:[1,2],count:20,positives:10,rate}],fitted:[{score:1,count:10,positives:8,block:0,rate},{score:2,count:10,positives:2,block:0,rate}],weighted_bin_sse:{numerator:9,denominator:5},bernoulli_sse:{numerator:5,denominator:1}}};
it('draws the chain fit while preserving exact fractions and empirical points',()=>{expect(fitRows(record)).toEqual([{score:1,count:10,positives:8,block:0,rate},{score:2,count:10,positives:2,block:0,rate}]);});
it('does not manufacture a fit for the open sample',()=>{expect(fitRows({...record,status:'OPEN',result:null})).toEqual([]);});
it('rejects decreasing or out-of-domain purported chain rates',()=>{expect(()=>fitRows({...record,result:{...record.result,fitted:[{...record.result.fitted[0],rate:{numerator:3,denominator:2}},record.result.fitted[1]]}})).toThrow();expect(()=>fitRows({...record,result:{...record.result,fitted:[{...record.result.fitted[0],rate:{numerator:1,denominator:0}},record.result.fitted[1]]}})).toThrow();});
it('requires complete exact block membership before drawing',()=>{expect(()=>fitRows({...record,result:{...record.result,blocks:[{...record.result.blocks[0],scores:[1]}]}})).toThrow();});
it('gates confirm on creator, stage, revision, valid fit and certificate',()=>{expect(canConfirm(record,creator)).toBe(true);expect(canConfirm({...record,status:'REVOKED'},creator)).toBe(false);expect(canConfirm(record,'0x2222222222222222222222222222222222222222')).toBe(false);expect(canConfirm({...record,certificate_id:''},creator)).toBe(false);});
it.each(['.','..','%2e'])('rejects ambiguous repository %s',repo=>{expect(()=>openArgs('s','https://raw.githubusercontent.com/example/'+repo+'/'+'a'.repeat(40)+'/input.json','b'.repeat(64))).toThrow('commit-pinned');});
it.each(['.github','repo.name','_repo'])('preserves valid repository %s',repo=>{const url='https://raw.githubusercontent.com/example/'+repo+'/'+'a'.repeat(40)+'/input.json';expect(openArgs('s',url,'b'.repeat(64))).toEqual(['s',url,'b'.repeat(64)]);});

it("blocks confirmation after visible record ID changes without a fresh read",()=>{expect(canConfirm(record,creator,"another-record")).toBe(false);});
