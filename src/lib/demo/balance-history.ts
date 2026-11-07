// SAMPLE DATA — balance movements derived from the shared simulation ledger and payouts, with
// running balances that close on the current available total. Internal transfers between Nova
// Retail's own accounts move money between wallets without changing the currency-level balance,
// so they are excluded here. Pending items are excluded too: a movement only posts once it settles.
import { daysAgo } from "@/lib/dates";
import { ledgerStore } from "./ledger";
import { accountsStore } from "./accounts";
import { payoutsStore } from "./payouts";
import type { Currency } from "@/lib/money";

export type BalanceMove = {
  id: string;
  date: string;
  details: string;
  reference: string;
  currency: Currency;
  /** Signed: positive credits the balance, negative debits it. */
  amount: number;
  balanceAfter: number;
};

type Movement = { date: string; details: string; reference: string; amount: number };

function movementsFor(currency: Currency): Movement[] {
  const out: Movement[] = [];
  for (const r of ledgerStore.get()) {
    if (r.currency !== currency) continue;
    if (r.type === "Payment" && r.status === "Successful")
      out.push({ date: r.date, details: "Customer payment", reference: r.id, amount: r.amount });
    if (r.type === "Fee" && r.status === "Successful")
      out.push({ date: r.date, details: "Griv processing fees", reference: r.id, amount: -r.amount });
    if (r.type === "Settlement" && r.status === "Successful")
      out.push({ date: r.date, details: "Settlement batch posted", reference: r.id, amount: r.amount });
    if (r.type === "Refund" && r.status === "Refunded")
      out.push({
        date: r.date,
        details: `Refund of ${r.parentId ?? r.id}`,
        reference: r.id,
        amount: -r.amount,
      });
    if (r.type === "Reversal" && r.status === "Successful")
      out.push({ date: r.date, details: "Reversal processed", reference: r.id, amount: r.amount });
  }
  for (const p of payoutsStore.get()) {
    if (p.currency !== currency || p.status !== "Successful") continue;
    out.push({
      date: p.date,
      details: `Payout to ${p.recipient.name}`,
      reference: p.id,
      amount: -(p.amount + p.fee),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const cache = new Map<Currency, BalanceMove[]>();
// Any change to the underlying stores (including a Test/Live switch) invalidates the cache.
for (const s of [ledgerStore, accountsStore, payoutsStore]) s.subscribe(() => cache.clear());

/** Newest first. Running balances are mathematically consistent and close on today's available total. */
export function balanceHistory(currency: Currency): BalanceMove[] {
  const cached = cache.get(currency);
  if (cached) return cached;
  const closing = accountsStore
    .get()
    .filter((a) => a.currency === currency)
    .reduce((s, a) => s + a.available, 0);
  const moves = movementsFor(currency);
  const net = moves.reduce((s, m) => s + m.amount, 0);
  let running = closing - net;
  const rows = moves.map((m, i) => {
    running = Math.round((running + m.amount) * 100) / 100;
    return { ...m, id: `BH-${currency}-${String(i + 1).padStart(3, "0")}`, currency, balanceAfter: running };
  });
  rows.reverse();
  cache.set(currency, rows);
  return rows;
}

// PROTOTYPE SAMPLE DATA — lien management is not implemented in Griv yet; these rows only
// illustrate what the Lien History tab would show once it exists.
export type Lien = {
  id: string;
  date: string;
  reason: string;
  currency: Currency;
  amount: number;
  status: "Held" | "Released";
};

export const LIENS: Lien[] = [
  { id: "LIEN-NG-1041", date: daysAgo(1, 9, 15), reason: "Chargeback investigation", currency: "NGN", amount: 185000, status: "Held" },
  { id: "LIEN-NG-1038", date: daysAgo(3, 16, 40), reason: "Regulatory compliance review", currency: "NGN", amount: 64000, status: "Held" },
  { id: "LIEN-NG-1033", date: daysAgo(6, 11, 5), reason: "Chargeback investigation", currency: "NGN", amount: 92500, status: "Released" },
  { id: "LIEN-NG-1029", date: daysAgo(9, 14, 30), reason: "Settlement discrepancy check", currency: "NGN", amount: 230000, status: "Released" },
  { id: "LIEN-NG-1024", date: daysAgo(14, 10, 20), reason: "Regulatory compliance review", currency: "NGN", amount: 47500, status: "Released" },
  { id: "LIEN-GH-1012", date: daysAgo(4, 13, 10), reason: "Chargeback investigation", currency: "GHS", amount: 3100, status: "Held" },
  { id: "LIEN-KE-1009", date: daysAgo(8, 15, 45), reason: "Settlement discrepancy check", currency: "KES", amount: 15400, status: "Released" },
  { id: "LIEN-USD-1004", date: daysAgo(12, 12, 0), reason: "Regulatory compliance review", currency: "USD", amount: 420, status: "Held" },
];

export const liensFor = (currency: Currency) => LIENS.filter((l) => l.currency === currency);
