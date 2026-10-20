import {beforeEach,expect,it,vi} from 'vitest';
const transport=vi.hoisted(()=>({readContract:vi.fn()}));
vi.mock('genlayer-js',async original=>({...await original<typeof import('genlayer-js')>(),createClient:()=>({readContract:transport.readContract})}));
import {read} from '../src/wallet';
const address='0x1111111111111111111111111111111111111111';
beforeEach(()=>{transport.readContract.mockReset();});
it('reads the actual decoded SDK dictionary shape without parsing it as JSON text',async()=>{const record={fit_id:'demo',status:'OPEN',revision:0,data:{version:1,bins:[{score:1,count:10,positives:5}]},result:null};transport.readContract.mockResolvedValue(record);await expect(read('studio',address,'get_fit',['demo'])).resolves.toEqual(record);expect(transport.readContract).toHaveBeenCalledWith({address,functionName:'get_fit',args:['demo']});});
it.each([null,[],['unexpected'],'{"status":"OPEN"}',42,true])('rejects a non-dictionary SDK view payload: %j',async payload=>{transport.readContract.mockResolvedValue(payload);await expect(read('studio',address,'get_fit',['demo'])).rejects.toThrow('view');});
it('preserves a network or contract view failure instead of manufacturing a record',async()=>{transport.readContract.mockRejectedValue(Error('source view unavailable'));await expect(read('studio',address,'get_fit',['demo'])).rejects.toThrow('source view unavailable');});
