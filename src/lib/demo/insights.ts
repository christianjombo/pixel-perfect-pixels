/** Reconciliable, read-only analytics over the same stores as Transactions and Commerce.
 * Amounts are major units; no FX, no joining commerce receipts into financial volume.
 * Reporting days are inclusive in the configured IANA timezone. */
import { DEMO_TODAY } from '@/lib/dates';
import type { Currency } from '@/lib/money';
import type { UnifiedTxn } from './unified';
import type { Order } from './orders';
import type { Customer } from './customers';
import type { Product } from './catalog';

export const INSIGHT_TABS = ['Overview', 'Payments', 'Customers', 'Commerce', 'Transfers', 'Settlements'] as const;
export type InsightTab = typeof INSIGHT_TABS[number];
export const PERIODS = ['Today', 'Yesterday', 'Last 7 days', 'Last 30 days', 'Last 90 days', 'This month', 'Last month', 'This year', 'Custom range'] as const;
export type Period = typeof PERIODS[number];
export type Window = { from: string; to: string };
export type AnalyticsFilters = Window & { currency: Currency; country: string; account: string; product: string; method: string; provider: string; status: string; direction: string; channel: string; commerceChannel: string; transferKind: string };
export type Metric = { label: string; value: number | null; unit: 'money' | 'count' | 'rate' | 'minutes'; definition: string; previous?: number | null };
export type Breakdown = { name: string; count: number; amount: number; rate?: number; average?: number; share?: number; id?: string; refs?: string[] };
export type Point = { key: string; value: number; previous: number };
export const DEFAULT_ANALYTICS = { currency: 'NGN' as Currency, country: 'All', account: 'All', product: 'All', method: 'All', provider: 'All', status: 'All', direction: 'All', channel: 'All', commerceChannel: 'All', transferKind: 'All' };
export function reportingDay(iso: string | Date, zone = 'Africa/Lagos') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function shiftDay(day: string, by: number) { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + by); return d.toISOString().slice(0, 10); }
export function periodWindow(period: Period, zone = 'Africa/Lagos', custom?: Window, now: Date = DEMO_TODAY): Window {
  const to = reportingDay(now, zone); const month = to.slice(0, 7) + '-01';
  switch (period) {
    case 'Today': return { from: to, to };
    case 'Yesterday': return { from: shiftDay(to, -1), to: shiftDay(to, -1) };
    case 'Last 7 days': return { from: shiftDay(to, -6), to };
    case 'Last 30 days': return { from: shiftDay(to, -29), to };
    case 'Last 90 days': return { from: shiftDay(to, -89), to };
    case 'This month': return { from: month, to };
    case 'Last month': { const last = shiftDay(month, -1); return { from: last.slice(0, 7) + '-01', to: last }; }
    case 'This year': return { from: to.slice(0, 4) + '-01-01', to };
    case 'Custom range': return custom && validWindow(custom) ? custom : { from: shiftDay(to, -29), to };
  }
}
export function validWindow(w: Window) { return /^\d{4}-\d{2}-\d{2}$/.test(w.from) && /^\d{4}-\d{2}-\d{2}$/.test(w.to) && Number.isFinite(Date.parse(w.from)) && Number.isFinite(Date.parse(w.to)) && new Date(w.from).toISOString().slice(0, 10) === w.from && new Date(w.to).toISOString().slice(0, 10) === w.to && w.from <= w.to && (Date.parse(w.to) - Date.parse(w.from)) / 86400000 <= 730; }
export function previousWindow(w: Window): Window { const length = Math.round((Date.parse(w.to) - Date.parse(w.from)) / 86400000) + 1; return { from: shiftDay(w.from, -length), to: shiftDay(w.from, -1) }; }
export function change(current: number, previous: number, rate = false) { return rate ? current - previous : previous === 0 ? null : (current - previous) / previous * 100; }
export const sum = <T,>(rows: T[], value: (r: T) => number) => Math.round(rows.reduce((s, r) => s + value(r), 0) * 100) / 100;
const success = (r: UnifiedTxn) => r.status === 'Successful';
const pending = (r: UnifiedTxn) => ['Pending', 'Processing', 'Scheduled'].includes(r.status);
const rate = (rows: UnifiedTxn[]) => rows.length ? rows.filter(success).length / rows.length * 100 : 0;
const within = (date: string, w: Window, zone: string) => { const d = reportingDay(date, zone); return d >= w.from && d <= w.to; };
export function filterFinancial(rows: UnifiedTxn[], f: AnalyticsFilters, customers: Customer[], zone: string) {
  return rows.filter(r => {
    const customer = customers.find(c => c.email.toLowerCase() === r.email?.toLowerCase());
    return r.currency === f.currency && within(r.date, f, zone)
      && (f.country === 'All' || customer?.country === f.country)
      && (f.account === 'All' || r.source === f.account || r.destination === f.account)
      && (f.product === 'All' || (f.product === 'Payments' ? r.type === 'Payment' : f.product === 'Transfers' ? ['Transfer', 'Payout'].includes(r.type) : f.product === 'Settlements' ? r.type === 'Settlement' : false));
  });
}
export function filterOrders(orders: Order[], f: AnalyticsFilters, customers: Customer[], zone: string) {
  return f.currency !== 'NGN' || f.account !== 'All' || !['All', 'Commerce'].includes(f.product) ? [] : orders.filter(o => within(o.date, f, zone) && (f.country === 'All' || customers.find(c => c.id === o.customerId)?.country === f.country) && (f.commerceChannel === 'All' || o.channel === f.commerceChannel));
}
export function tabFinancial(rows: UnifiedTxn[], f: AnalyticsFilters, tab: InsightTab) {
  return rows.filter(r => (f.status === 'All' || r.status === f.status) && (f.method === 'All' || r.method === f.method) && (f.provider === 'All' || r.provider === f.provider) && (f.channel === 'All' || r.origin === f.channel)
    && (tab !== 'Payments' || (f.direction === 'All' ? ['Payment', 'Payout'].includes(r.type) : f.direction === 'Deposits' ? r.type === 'Payment' : r.type === 'Payout'))
    && (tab !== 'Transfers' || (['Transfer', 'Payout'].includes(r.type) && (f.transferKind === 'All' || (f.transferKind === 'Internal' ? r.type === 'Transfer' : f.transferKind === 'External' ? r.type === 'Payout' : r.status === 'Scheduled'))))
    && (tab !== 'Settlements' || r.type === 'Settlement'));
}
export function breakdown(rows: UnifiedTxn[], key: (r: UnifiedTxn) => string, confirmedOnly = true): Breakdown[] {
  const total = sum(confirmedOnly ? rows.filter(success) : rows, r => r.amount);
  return [...new Set(rows.map(key))].map(name => { const subset = rows.filter(r => key(r) === name); const paid = confirmedOnly ? subset.filter(success) : subset; const amount = sum(paid, r => r.amount); return { name, count: subset.length, amount, rate: rate(subset), average: paid.length ? amount / paid.length : 0, share: total ? amount / total * 100 : 0, refs: subset.map(r => r.id) }; }).sort((a, b) => b.amount - a.amount || b.count - a.count);
}
export function financeMetrics(rows: UnifiedTxn[], tab: InsightTab): Metric[] {
  const paid = rows.filter(r => r.type === 'Payment' && r.payinType !== 'Funding'); const collected = paid.filter(success); const volume = sum(collected, r => r.amount); const fees = sum(collected, r => r.fee);
  const m = (label: string, value: number | null, unit: Metric['unit'], definition: string): Metric => ({ label, value, unit, definition });
  if (tab === 'Transfers' || tab === 'Settlements') {
    const settled = rows.filter(success); const isTransfer = tab === 'Transfers';
    return [m(isTransfer ? 'Total transfer volume' : 'Total settled', sum(settled, r => r.amount), 'money', 'Successful canonical records only; pending and failed amounts excluded.'), m(isTransfer ? 'Successful transfers' : 'Completed settlements', settled.length, 'count', 'Records confirmed successful in the shared transaction feed.'), m(isTransfer ? 'Pending transfers' : 'Pending settlement amount', isTransfer ? rows.filter(pending).length : sum(rows.filter(pending), r => r.amount), isTransfer ? 'count' : 'money', 'Pending and processing records within the selected reporting dates.'), m(isTransfer ? 'Failed transfers' : 'Failed settlements', rows.filter(r => r.status === 'Failed').length, 'count', 'Records with an explicit Failed status; delays are not inferred.'), ...(isTransfer ? [m('Transfer success rate', rate(rows), 'rate', 'Successful transfers / all transfer attempts × 100.')] : []), m(isTransfer ? 'Total transfer fees' : 'Settlement fees', sum(settled, r => r.fee), 'money', 'Recorded fees on successful transactions, not estimated fees.'), m('Average processing time', null, 'minutes', 'Completion timestamps are not available for all canonical records.'), ...(!isTransfer ? [m('Reconciliation exceptions', null, 'count', 'Requires reconciled bank/processor statements; no exceptions dataset is connected.')] : [])];
  }
  const metrics = [m('Total payment volume', volume, 'money', 'Successful customer pay-ins; own-balance funding, transfers and settlements excluded.'), m('Net collections', volume - fees, 'money', 'Successful customer payment volume less recorded payment fees. Refunds are separate and not allocated without a parent reference.'), m('Successful payments', collected.length, 'count', 'Number of successful customer pay-in records.'), m('Payment success rate', rate(paid), 'rate', 'Successful customer pay-ins / all customer pay-in attempts × 100.'), m('Average transaction value', collected.length ? volume / collected.length : 0, 'money', 'Successful payment volume / successful customer payments.'), m('Payment fees', fees, 'money', 'Recorded fees attached to successful customer pay-ins.')];
  if (tab === 'Payments') metrics.push(m('Deposits', sum(rows.filter(r => r.type === 'Payment' && success(r)), r => r.amount), 'money', 'All successful deposits, including merchant balance funding.'), m('Withdrawals', sum(rows.filter(r => r.type === 'Payout' && success(r)), r => r.amount), 'money', 'Successful external payouts; not internal account transfers.'), m('Failed transactions', rows.filter(r => r.status === 'Failed').length, 'count', 'Failed deposits and withdrawals.'), m('Pending transactions', rows.filter(pending).length, 'count', 'Pending, processing and scheduled deposits and withdrawals.'), m('Average processing time', null, 'minutes', 'No payment completion timestamp is recorded.'));
  else metrics.push(m('Total outbound transfers', sum(rows.filter(r => r.type === 'Payout' && success(r)), r => r.amount), 'money', 'External payouts only; internal account movements excluded.'));
  return metrics;
}
export function commerceMetrics(orders: Order[]): Metric[] {
  const placed = orders.filter(o => o.fulfilment !== 'Cancelled'); const paid = placed.filter(o => o.payment === 'Paid');
  const gross = sum(placed, o => sum(o.items, i => i.price * i.quantity));
  const net = sum(placed.filter(o => o.payment !== 'Refunded'), o => sum(o.items, i => i.price * i.quantity) - o.discount);
  return [
    { label: 'Gross sales', value: gross, unit: 'money', definition: 'Non-cancelled merchandise subtotal before discounts, tax, shipping and returns; order value is not payment volume.' },
    { label: 'Net sales (known)', value: net, unit: 'money', definition: 'Gross merchandise sales less discounts and fully refunded orders. Partial refund amounts are not recorded and cannot be deducted.' },
    { label: 'Orders', value: placed.length, unit: 'count', definition: 'Non-cancelled orders placed during the period.' },
    { label: 'Average order value', value: placed.length ? gross / placed.length : 0, unit: 'money', definition: 'Gross merchandise sales / non-cancelled orders.' },
    { label: 'Refunded orders', value: orders.filter(o => ['Refunded', 'Partially refunded'].includes(o.payment)).length, unit: 'count', definition: 'Orders marked fully or partially refunded; pending refund requests excluded.' },
    { label: 'Units sold', value: sum(paid, o => sum(o.items, i => i.quantity)), unit: 'count', definition: 'Units on paid, non-cancelled orders.' },
    ...(['POS', 'Online Store'] as const).map(channel => ({ label: `${channel} sales`, value: sum(placed.filter(o => o.channel === channel), o => sum(o.items, i => i.price * i.quantity)), unit: 'money' as const, definition: 'Gross non-cancelled merchandise sales by channel; not settlement or collected funds.' })),
  ];
}
export function customerAnalytics(orders: Order[], history: Order[], customers: Customer[], w: Window, zone: string) {
  const paid = orders.filter(o => o.payment === 'Paid' && o.fulfilment !== 'Cancelled');
  const historical = history.filter(o => o.payment === 'Paid' && o.fulfilment !== 'Cancelled');
  const activeIds = [...new Set(paid.map(o => o.customerId))];
  const identified = activeIds.filter(id => customers.some(c => c.id === id));
  const firstDay = (id: string) => historical.filter(o => o.customerId === id).map(o => reportingDay(o.date, zone)).sort()[0] ?? '';
  const newIds = identified.filter(id => firstDay(id) >= w.from && firstDay(id) <= w.to);
  const returning = identified.filter(id => firstDay(id) < w.from);
  const ranking: Breakdown[] = identified.map(id => { const subset = paid.filter(o => o.customerId === id); const lifetime = historical.filter(o => o.customerId === id); const amount = sum(subset, o => sum(o.items, i => i.price * i.quantity) - o.discount); return { id, name: customers.find(c => c.id === id)?.name ?? id, count: subset.length, amount, average: sum(lifetime, o => sum(o.items, i => i.price * i.quantity) - o.discount), share: firstDay(id) ? Date.parse(firstDay(id)) : 0 }; }).sort((a, b) => b.amount - a.amount);
  const repeat = ranking.filter(r => r.count > 1).length;
  const metrics: Metric[] = [
    { label: 'Total customers', value: customers.length, unit: 'count', definition: 'Current customer directory size; registration dates are unavailable, so not a historical period count.' },
    { label: 'New customers', value: newIds.length, unit: 'count', definition: 'Identified customers whose first observed paid order is in this period. Not signup count.' },
    { label: 'Returning customers', value: returning.length, unit: 'count', definition: 'Identified customers with a paid order in this period and a paid order before it.' },
    { label: 'Active customers', value: identified.length, unit: 'count', definition: 'Distinct canonical customer IDs on paid orders during the period.' },
    { label: 'Average customer spend', value: identified.length ? sum(ranking, r => r.amount) / identified.length : 0, unit: 'money', definition: 'Paid merchandise sales after discounts / identified active customers; not profit.' },
    { label: 'Repeat purchase rate', value: identified.length ? repeat / identified.length * 100 : 0, unit: 'rate', definition: 'Customers with more than one paid order in period / active customers × 100.' },
  ];
  const cohorts = [...new Set(identified.map(id => firstDay(id).slice(0, 7)))].filter(Boolean).sort().map(month => { const ids = identified.filter(id => firstDay(id).startsWith(month)); const purchases = ids.filter(id => historical.filter(o => o.customerId === id).length > 1).length; return { name: month, count: ids.length, amount: purchases, rate: ids.length ? purchases / ids.length * 100 : 0 }; });
  return { metrics, ranking, cohorts, newIds, returning, unknown: activeIds.length - identified.length };
}
export function productAnalytics(orders: Order[], products: Product[], category = false): Breakdown[] {
  const rows = orders.filter(o => o.payment === 'Paid' && o.fulfilment !== 'Cancelled').flatMap(o => o.items);
  const nameFor = (item: Order['items'][number]) => category ? products.find(p => p.variants.some(v => v.sku === item.sku))?.category ?? 'Uncategorised' : item.name;
  return [...new Set(rows.map(nameFor))].map(name => { const subset = rows.filter(i => nameFor(i) === name); return { name, count: sum(subset, i => i.quantity), amount: sum(subset, i => i.quantity * i.price) }; }).sort((a, b) => b.amount - a.amount);
}
export type SeriesMetric = 'Payment volume' | 'Successful payments' | 'Net collections' | 'Fees' | 'Transfer volume' | 'Customer growth' | 'Gross sales' | 'Orders' | 'Refunded orders' | 'Settlement volume' | 'Failed payments' | 'Deposits' | 'Withdrawals';
export function series(rows: UnifiedTxn[], orders: Order[], w: Window, metric: SeriesMetric, aggregation: 'Daily' | 'Weekly' | 'Monthly', zone: string): { key: string; value: number }[] {
  const days: string[] = []; for (let d = w.from; d <= w.to; d = shiftDay(d, 1)) days.push(d);
  const groups = new Map<string, number>();
  const bucket = (day: string) => aggregation === 'Monthly' ? day.slice(0, 7) : aggregation === 'Weekly' ? shiftDay(w.from, Math.floor((Date.parse(day) - Date.parse(w.from)) / 86400000 / 7) * 7) : day;
  days.forEach(d => groups.set(bucket(d), 0));
  const add = (date: string, value: number) => { const key = bucket(reportingDay(date, zone)); if (groups.has(key)) groups.set(key, (groups.get(key) ?? 0) + value); };
  if (['Gross sales', 'Orders', 'Refunded orders', 'Customer growth'].includes(metric)) {
    const seen = new Set<string>();
    [...orders].sort((a, b) => a.date.localeCompare(b.date)).forEach(o => {
      if (metric === 'Refunded orders') { if (['Refunded', 'Partially refunded'].includes(o.payment)) add(o.date, 1); return; }
      if (o.fulfilment === 'Cancelled') return;
      if (metric === 'Customer growth') { if (o.payment === 'Paid' && !seen.has(o.customerId)) { add(o.date, 1); seen.add(o.customerId); } return; }
      add(o.date, metric === 'Orders' ? 1 : sum(o.items, i => i.price * i.quantity));
    });
  } else rows.forEach(r => {
    if (metric === 'Failed payments') { if (r.type === 'Payment' && r.status === 'Failed') add(r.date, 1); return; }
    if (!success(r)) return;
    if (metric === 'Transfer volume') { if (['Transfer', 'Payout'].includes(r.type)) add(r.date, r.amount); return; }
    if (metric === 'Settlement volume') { if (r.type === 'Settlement') add(r.date, r.amount); return; }
    if (metric === 'Withdrawals') { if (r.type === 'Payout') add(r.date, r.amount); return; }
    if (r.type !== 'Payment' || (metric !== 'Deposits' && r.payinType === 'Funding')) return;
    add(r.date, metric === 'Successful payments' ? 1 : metric === 'Fees' ? r.fee : metric === 'Net collections' ? r.amount - r.fee : r.amount);
  });
  return [...groups].map(([key, value]) => ({ key, value: Math.round(value * 100) / 100 }));
}
export function businessHighlights(current: UnifiedTxn[], previous: UnifiedTxn[], w: Window, prev: Window) {
  const a = financeMetrics(current, 'Overview'); const b = financeMetrics(previous, 'Overview');
  const volume = a[0]?.value ?? 0; const old = b[0]?.value ?? 0; const pct = change(volume, old);
  const channels = breakdown(current.filter(r => r.type === 'Payment' && r.payinType !== 'Funding'), r => r.method);
  const lead = channels.find(c => c.amount > 0); const pp = (a[3]?.value ?? 0) - (b[3]?.value ?? 0);
  const hasBaseline = previous.some(r => r.type === 'Payment' && r.payinType !== 'Funding');
  return [
    { title: 'Payment volume', description: `${current.filter(r => r.type === 'Payment' && success(r) && r.payinType !== 'Funding').length} successful customer payments from ${w.from} to ${w.to}.`, current: volume, previous: old, change: pct, rate: false, period: `${prev.from} – ${prev.to}`, refs: current.filter(r => r.type === 'Payment' && r.payinType !== 'Funding').map(r => r.id) },
    ...(lead ? [{ title: `${lead.name} leads collections`, description: `${lead.share?.toFixed(1)}% of successful volume; ${lead.count} attempts from ${w.from} to ${w.to}.`, current: lead.amount, previous: breakdown(previous.filter(r => r.type === 'Payment' && r.payinType !== 'Funding'), r => r.method).find(r => r.name === lead.name)?.amount ?? 0, change: null, rate: false, period: `${prev.from} – ${prev.to}`, refs: lead.refs ?? [] }] : []),
    ...(current.some(r => r.type === 'Payment') ? [{ title: 'Payment success rate', description: `All customer pay-in attempts from ${w.from} to ${w.to}; ${hasBaseline ? `${pp >= 0 ? 'increased' : 'decreased'} ${Math.abs(pp).toFixed(1)} percentage points versus ${prev.from} – ${prev.to}.` : `comparison unavailable: no customer attempts from ${prev.from} to ${prev.to}.`}`, current: a[3]?.value ?? 0, previous: b[3]?.value ?? 0, change: hasBaseline ? pp : null, rate: true, period: `${prev.from} – ${prev.to}`, refs: current.filter(r => r.type === 'Payment' && r.payinType !== 'Funding').map(r => r.id) }] : []),
  ].slice(0, 3);
}
