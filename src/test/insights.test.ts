import { describe, expect, it } from 'vitest';
import { DEFAULT_ANALYTICS, breakdown, businessHighlights, change, periodWindow, previousWindow, reportingDay, filterFinancial, financeMetrics, commerceMetrics, customerAnalytics, filterOrders, series, validWindow } from '@/lib/demo/insights';
import { mergeTxns } from '@/lib/demo/unified';
import { INITIAL_LEDGER } from '@/lib/demo/ledger';
import { transfersStore } from '@/lib/demo/transfers';
import { payoutsStore } from '@/lib/demo/payouts';
import { INITIAL_ACCOUNTS } from '@/lib/demo/accounts';
import { CUSTOMERS } from '@/lib/demo/customers';
import { orderStore, type Order } from '@/lib/demo/orders';
import type { UnifiedTxn } from '@/lib/demo/unified';

const txn = (patch: Partial<UnifiedTxn>): UnifiedTxn => ({ id: 't1', date: '2026-10-22T10:00:00Z', type: 'Payment', status: 'Successful', currency: 'NGN', amount: 1000, fee: 15, party: 'Customer', method: 'Card', sourceChannel: 'Checkout', origin: 'Checkout', provider: 'Verve', txnId: 'TXN1', note: '', ...patch });
const order = (patch: Partial<Order>): Order => ({ id: 'o1', customerId: 'cus_01', date: '2026-10-22T10:00:00Z', channel: 'Online Store', payment: 'Paid', fulfilment: 'Delivered', items: [{ name: 'Product', sku: 'SKU', variant: 'Default', quantity: 2, price: 1000 }], discount: 100, delivery: 2500, carrier: '', tracking: '', notes: [], events: [], refundPending: false, ...patch });
const w = { from: '2026-10-01', to: '2026-10-22' };
describe('Insights metric rules', () => {
  it('never adds USD to NGN financial totals', () => {
    const filtered = filterFinancial([txn({}), txn({ id: 'usd', currency: 'USD', amount: 8000 })], { ...DEFAULT_ANALYTICS, ...w }, [], 'Africa/Lagos');
    expect(financeMetrics(filtered, 'Overview')[0]?.value).toBe(1000);
  });
  it('previous-zero percentage comparison is N/A, not infinite', () => { expect(change(200, 0)).toBeNull(); expect(change(200, 100)).toBe(100); });
  it('success rates compare in percentage points', () => { expect(change(90, 80, true)).toBe(10); });
  it('reports a UTC-near-midnight event on the merchant timezone day', () => { expect(reportingDay('2026-10-21T23:30:00Z', 'Africa/Lagos')).toBe('2026-10-22'); expect(reportingDay('2026-10-21T23:30:00Z', 'Africa/Accra')).toBe('2026-10-21'); });
  it('Last 7 days includes today and exactly six previous days', () => { expect(periodWindow('Last 7 days')).toEqual({ from: '2026-10-16', to: '2026-10-22' }); });
  it('previous comparison has equal inclusive length and no overlap', () => { expect(previousWindow({ from: '2026-10-16', to: '2026-10-22' })).toEqual({ from: '2026-10-09', to: '2026-10-15' }); });
  it('last month uses actual month boundaries', () => { expect(periodWindow('Last month')).toEqual({ from: '2026-09-01', to: '2026-09-30' }); });
  it('excludes merchant funding and pending movements from collected volume', () => { const m = financeMetrics([txn({}), txn({ id: 'fund', payinType: 'Funding', amount: 4000 }), txn({ id: 'pending', status: 'Pending', amount: 5000 })], 'Overview'); expect(m[0]?.value).toBe(1000); expect(m[1]?.value).toBe(985); expect(m[3]?.value).toBe(50); });
  it('outbound volume excludes internal movements and pending payouts', () => { const m = financeMetrics([txn({ type: 'Transfer', amount: 4000 }), txn({ type: 'Payout', amount: 2000 }), txn({ type: 'Payout', status: 'Pending', amount: 3000 })], 'Overview'); expect(m.find(r => r.label === 'Total outbound transfers')?.value).toBe(2000); });
  it('financial canonical feed discards duplicate placeholder transfers', () => { const rows = mergeTxns(INITIAL_LEDGER, transfersStore.get(), payoutsStore.get(), INITIAL_ACCOUNTS); expect(rows.filter(r => r.type === 'Transfer')).toHaveLength(16); expect(rows.filter(r => r.type === 'Payout')).toHaveLength(22); });
  it('commerce gross sales are merchandise only, never tax/shipping or collection amounts', () => { expect(commerceMetrics([order({})])[0]?.value).toBe(2000); expect(commerceMetrics([order({})])[1]?.value).toBe(1900); });
  it('commerce stays NGN-only instead of silently treating orders as USD', () => { expect(filterOrders(orderStore.get(), { ...DEFAULT_ANALYTICS, ...w, currency: 'USD' }, CUSTOMERS, 'Africa/Lagos')).toHaveLength(0); });
  it('customer count uses a unified customer ID and excludes anonymous receipts', () => { const orders = [order({}), order({ id: 'o2' }), order({ id: 'guest', customerId: '' })]; const m = customerAnalytics(orders, orders, CUSTOMERS, w, 'Africa/Lagos'); expect(m.metrics.find(r => r.label === 'Active customers')?.value).toBe(1); expect(m.metrics.find(r => r.label === 'Repeat purchase rate')?.value).toBe(100); expect(m.unknown).toBe(1); });
  it('returning customer needs observed history before selected period', () => { const past = order({ id: 'old', date: '2026-09-20T10:00:00Z' }); const now = order({}); const m = customerAnalytics([now], [past, now], CUSTOMERS, w, 'Africa/Lagos'); expect(m.newIds).toHaveLength(0); expect(m.returning).toEqual(['cus_01']); });
  it('empty daily buckets are retained and chart reconciles to successful volume', () => { const points = series([txn({}), txn({ status: 'Failed', amount: 9000 })], [], { from: '2026-10-20', to: '2026-10-22' }, 'Payment volume', 'Daily', 'Africa/Lagos'); expect(points).toEqual([{ key: '2026-10-20', value: 0 }, { key: '2026-10-21', value: 0 }, { key: '2026-10-22', value: 1000 }]); });
  it('does not invent processing or reconciliation measurements', () => { const m = financeMetrics([txn({ type: 'Settlement' })], 'Settlements'); expect(m.find(r => r.label === 'Average processing time')?.value).toBeNull(); expect(m.find(r => r.label === 'Reconciliation exceptions')?.value).toBeNull(); });
  it('invalid or reversed custom dates are rejected', () => { expect(validWindow({ from: 'invalid', to: '2026-10-22' })).toBe(false); expect(validWindow({ from: '2026-10-22', to: '2026-10-01' })).toBe(false); });
  it('pending settlement breakdown preserves the recorded pending amount', () => { const rows = breakdown([txn({ type: 'Settlement', status: 'Pending', amount: 4500 })], r => r.status, false); expect(rows[0]?.amount).toBe(4500); });
  it('highlights do not claim a success-rate increase without a previous cohort', () => { const h = businessHighlights([txn({})], [], w, previousWindow(w)); expect(h.find(r => r.title === 'Payment success rate')?.change).toBeNull(); });
});