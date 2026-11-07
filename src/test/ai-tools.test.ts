import { describe, expect, it } from 'vitest';
import { createBusinessTools } from '@/lib/ai/tools.server';
import { threadSchema, toolQuerySchema, type ToolResult } from '@/lib/ai/schemas';
const query={module:'payments',currency:'NGN',period:'Last 30 days',from:'2026-10-01',to:'2026-10-22',status:null,reference:null};
async function run(environment:string,q=query){
 const tools=createBusinessTools({environment,currency:'NGN',period:'Last 30 days',timezone:'Africa/Lagos'},async()=>{});
 const execute=tools.analyzeBusiness.execute;
 if(!execute)throw new Error('Missing business tool');
 return await execute(q,{toolCallId:'test',messages:[],context:undefined,abortSignal:new AbortController().signal}) as ToolResult;
}
describe('Griv AI data boundaries',()=>{
 it('never returns sample financial records in Live',async()=>{const result=await run('live');expect(result.kind).toBe('unavailable');expect(result.sample).toBe(false);expect(result.rows).toEqual([]);expect(result.metrics).toEqual([]);});
 it('labels Test analysis as sample data',async()=>{const result=await run('test');expect(result.sample).toBe(true);expect(result.rows.length).toBeGreaterThan(0);});
 it('USD commerce cannot return NGN orders',async()=>{const result=await run('test',{...query,module:'commerce',currency:'USD'});expect(result.rows).toEqual([]);expect(result.metrics[0]?.value).toBe(0);});
 it('requires a valid Test or Live conversation environment',()=>{expect(threadSchema.safeParse({title:'Report',environment:'admin',currency:'NGN',period:'Last 30 days'}).success).toBe(false);});
 it('rejects tool fields outside the strict read schema',()=>{expect(toolQuerySchema.safeParse({...query,execute:true}).success).toBe(false);});
 it('prepares actions without execution and with expiry',async()=>{const tools=createBusinessTools({environment:'test',currency:'NGN',period:'Last 30 days',timezone:'Africa/Lagos'},async()=>{});const execute=tools.prepareAction.execute;if(!execute)throw new Error('Missing preview tool');const result=await execute({...query,module:'transfer'},{toolCallId:'preview',messages:[],context:undefined,abortSignal:new AbortController().signal}) as ToolResult;expect(result.kind).toBe('action_preview');expect(result.action?.route).toBe('/transfers');expect(Date.parse(result.action?.expiresAt??'')).toBeGreaterThan(Date.now());expect(result.action?.amount).toBe(0);});
});