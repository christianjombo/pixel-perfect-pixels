import { tool } from 'ai';
import { toolQuerySchema, type ToolResult } from './schemas';
import { DEFAULT_ANALYTICS, filterFinancial, filterOrders, financeMetrics, commerceMetrics, customerAnalytics, productAnalytics, periodWindow, validWindow, series, breakdown } from '@/lib/demo/insights';
import { CURRENCIES } from '@/lib/money';
import { mergeTxns } from '@/lib/demo/unified';
import { ledgerStore } from '@/lib/demo/ledger';
import { transfersStore } from '@/lib/demo/transfers';
import { payoutsStore } from '@/lib/demo/payouts';
import { accountsStore } from '@/lib/demo/accounts';
import { orderStore } from '@/lib/demo/orders';
import { customersStore } from '@/lib/demo/customers';
import { catalogStore } from '@/lib/demo/catalog';
import { invoicesStore, invoiceTotals, invoicePaid, invoiceStatus } from '@/lib/demo/invoices';
import { cardsStore, cardTxnsStore } from '@/lib/demo/cards';
import { linksStore } from '@/lib/demo/payment-links';
import type { Period } from '@/lib/demo/insights';
export function createBusinessTools(scope:{environment:string; currency:string; period:string; timezone:string}, audit:(event:string, detail:Record<string,unknown>)=>Promise<void>) {
 return { analyzeBusiness: tool({description:'Read authorized business metrics and supporting records. All connected financial services are unavailable; use labelled sample data only in test. Modules: overview, payments, transfers, settlements, balances, customers, commerce, inventory, cards, invoices, payment_links. Use canonical totals, one currency, explicit dates for comparisons. Never invent financial data.', inputSchema:toolQuerySchema,strict:true,execute:async q => {
  await audit('tool_read',{module:q.module,currency:q.currency,period:q.period});
  const currency=CURRENCIES.find(c=>c===q.currency) ?? CURRENCIES.find(c=>c===scope.currency) ?? 'NGN';
  const period=q.period as Period; const w=q.from && q.to && validWindow({from:q.from,to:q.to}) ? {from:q.from,to:q.to} : periodWindow(['Today','Yesterday','Last 7 days','Last 30 days','Last 90 days','This month','Last month','This year'].includes(period) ? period : 'Last 30 days',scope.timezone);
  const result:ToolResult={kind:'report',title:`${q.module} analysis`,source:'Griv canonical sample snapshot · 22 Oct 2026',currency, ...w,sample:true,metrics:[],rows:[],series:[],limitations:['Sample snapshot only; browser-only changes are not synchronized with this server snapshot. Not live financial records.']};
  if(scope.environment==='live') return {...result,kind:'unavailable',sample:false,source:'No connected business data',limitations:['Live financial and operational services are not connected. Switch to Test to analyze labelled sample records.']};
  const all=mergeTxns(ledgerStore.get(),transfersStore.get(),payoutsStore.get(),accountsStore.get());
  let rows=filterFinancial(all,{...DEFAULT_ANALYTICS,...w,currency},customersStore.get(),scope.timezone);
  if(q.status) rows=rows.filter(r=>r.status.toLowerCase()===q.status?.toLowerCase()); if(q.reference) rows=rows.filter(r=>r.id===q.reference || r.txnId===q.reference);
  const orders=filterOrders(orderStore.get(),{...DEFAULT_ANALYTICS,...w,currency},customersStore.get(),scope.timezone);
  if(['overview','payments','transfers','settlements'].includes(q.module)) {
   const tab=q.module==='transfers'?'Transfers':q.module==='settlements'?'Settlements':q.module==='payments'?'Payments':'Overview';
   if(tab==='Transfers') rows=rows.filter(r=>['Transfer','Payout'].includes(r.type)); if(tab==='Settlements') rows=rows.filter(r=>r.type==='Settlement'); if(tab==='Payments') rows=rows.filter(r=>r.type==='Payment');
   result.metrics=financeMetrics(rows,tab); const metric=tab==='Transfers'?'Transfer volume':tab==='Settlements'?'Settlement volume':'Payment volume'; result.series=series(rows,[],w,metric,'Daily',scope.timezone).map(r=>({...r,previous:0}));
   result.rows=rows.slice(0,25).map(r=>({id:r.id,name:`${r.type} · ${r.method}`,amount:r.amount,status:r.status,route:`/transactions?q=${encodeURIComponent(r.id)}`}));
   result.limitations.push('Processing delays are not inferred; only provider-recorded failure reasons are evidence.');
   const channel=breakdown(rows.filter(r=>r.type==='Payment'&&r.payinType!=='Funding'),r=>r.method); result.limitations.push(`Channel breakdown: ${channel.map(c=>`${c.name}: ${c.amount} ${currency}, ${c.rate?.toFixed(1)}% success`).join('; ')}`);
  } else if(q.module==='balances') {
   result.rows=accountsStore.get().filter(a=>a.currency===currency).map(a=>({id:a.id,name:a.name,amount:a.available,status:`Pending ${a.pending}; reserved ${a.reserved}`,route:'/balances'})); result.limitations.push('Balances are current sample snapshots, not historical period balances.');
  } else if(q.module==='invoices') {
   result.rows=invoicesStore.get().filter(i=>i.currency===currency && (!q.reference||i.id===q.reference) && (!q.status||invoiceStatus(i).toLowerCase()===q.status.toLowerCase())).slice(0,25).map(i=>({id:i.id,name:i.customer,amount:Math.max(0,invoiceTotals(i).total-invoicePaid(i)),status:invoiceStatus(i),route:`/invoices/${encodeURIComponent(i.id)}`}));result.limitations.push('Invoice amounts show outstanding total, not collections. Invoice status snapshot is not filtered by payment date.');
  } else if(q.module==='commerce') {result.metrics=commerceMetrics(orders);result.series=series([],orders,w,'Gross sales','Daily',scope.timezone).map(r=>({...r,previous:0})); result.rows=productAnalytics(orders,catalogStore.get()).map(r=>({id:r.name,name:r.name,amount:r.amount,status:`${r.count} paid units`,route:'/products'}));result.limitations.push('Commerce is NGN-only. Gross sales are merchandise totals, not payments or profit. Partial refund amounts and historical inventory are unavailable.');
  } else if(q.module==='customers') {const c=customerAnalytics(orders,orderStore.get(),customersStore.get(),w,scope.timezone);result.metrics=c.metrics;result.rows=c.ranking.slice(0,15).map(r=>({id:r.id??r.name,name:r.name,amount:r.amount,status:`${r.count} paid orders`,route:'/customers'}));result.limitations.push('Customer IDs on commerce orders only; ledger names are not reliable identities. Lifetime spend is not profit.');
  } else if(q.module==='inventory') { result.rows=catalogStore.get().filter(p=>p.type==='Physical').flatMap(p=>p.variants.filter(v=>v.available<=v.reorderAt).map(v=>({id:v.sku,name:p.name,amount:v.available,status:`Reorder level ${v.reorderAt}`,route:'/inventory'})));result.limitations.push('Amount is units on hand, not currency. Current stock snapshot only.');
  } else if(q.module==='cards') {result.rows=cardsStore.get().filter(c=>c.currency===currency && (!q.reference||c.id===q.reference)).slice(0,25).map(c=>({id:c.id,name:c.nickname,amount:c.available,status:c.status,route:`/cards/${c.id}`}));result.limitations.push('Card balances are current snapshots; no PAN or CVV is accessible.');const tx=cardTxnsStore.get().filter(t=>t.currency===currency && t.type==='Capture' && t.date.slice(0,10)>=w.from && t.date.slice(0,10)<=w.to);result.metrics=[{label:'Captured card spend',value:tx.reduce((n,t)=>n+t.amount,0),unit:'money',definition:'Card Capture records in the chosen period; not authorizations, declines or refunds.'}];
  } else if(q.module==='payment_links') {result.rows=linksStore.get().filter(l=>l.currency===currency).slice(0,20).map(l=>({id:l.id,name:l.name,amount:l.payments.reduce((n,p)=>n+p.amount,0),status:l.status,route:`/payment-links/${l.id}`}));result.limitations.push('Payment-link volume is the existing lifetime sample total, not filtered-period revenue.');
  } else return {...result,kind:'unavailable',limitations:['This module is not supported by the read-only tool.']};
  return result;
 }}), prepareAction:tool({description:'Prepare a non-executing action preview. Supported intents: invoice, payment_link, transfer, fund_card, pause_card, resume_card, card_limit, reminder, automation. This tool cannot move funds, change a card, send a message or activate monitoring. Return a review link and expiry, never success.',inputSchema:toolQuerySchema,strict:true,execute:async q=>{
  await audit('action_preview',{type:q.module,target:q.reference});
  const currency=CURRENCIES.find(c=>c===q.currency)??'NGN';const w=periodWindow('Last 30 days');
  const routes:Record<string,string>={invoice:'/invoices/new',payment_link:'/payment-links/new',transfer:'/transfers',fund_card:'/cards',pause_card:'/cards',resume_card:'/cards',card_limit:'/cards',reminder:'/invoices',automation:'/ai'};
  return {kind:'action_preview',title:'Action preparation only',source:'Griv AI',currency,...w,sample:scope.environment==='test',metrics:[],rows:[],series:[],limitations:['No operation has been executed. Financial execution, step-up authentication, approval policies, email and automation services are not connected. Confirming opens the existing review flow only.'],action:{type:q.module,target:q.reference??'Not yet selected',amount:0,expiresAt:new Date(Date.now()+300000).toISOString(),route:routes[q.module]??'/ai'}} satisfies ToolResult;
 }}) };
}
