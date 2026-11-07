// SAMPLE DATA — Nova Retail Ltd., Lagos. The collection and treasury ledger now comes from
// the shared simulation layer (src/lib/sim), so Transactions, Balances, Insights and Griv AI
// all read the same interconnected records.
import { makeRef } from "@/lib/demo-store";
import { createSimStore } from "@/lib/sim/store";
import { getDataset } from "@/lib/sim/dataset";
import { daysAgo } from "@/lib/dates";
import type { Currency } from "@/lib/money";
export type LedgerEntry = {
  id: string;
  date: string;
  customer: string;
  email: string;
  /** References the shared customer directory (src/lib/demo/customers). */
  customerId?: string;
  type: string;
  channel: string;
  currency: Currency;
  amount: number;
  fee: number;
  status: string;
  /** Why the provider declined it, for failed transactions. */
  reason?: string;
  /** Where the transaction was initiated from. */
  sourceChannel: "Dashboard" | "Checkout" | "API";
  /** Only for payments: a customer pay-in or the merchant funding their own balance. */
  payinType?: "Pay-in" | "Funding";
  accountId: string;
  parentId?: string;
};
export const CHANNELS = ["Card", "Bank transfer", "USSD", "Virtual account", "Payment link", "POS"];

/** Live-environment base data, for tests and one-off derivations. */
export const INITIAL_LEDGER: LedgerEntry[] = getDataset("live").ledger;

export const ledgerStore = createSimStore<LedgerEntry[]>(
  "ledger",
  (env) => getDataset(env).ledger,
  { overlay: true },
);
export const useLedger = () => ledgerStore.use();
export const canRefund = (r: LedgerEntry, rows: LedgerEntry[]) =>
  r.type === "Payment" && r.status === "Successful" && !rows.some((x) => x.parentId === r.id);
export function requestRefund(id: string) {
  const rows = ledgerStore.get();
  const entry = rows.find((r) => r.id === id);
  if (!entry || !canRefund(entry, rows)) return;
  ledgerStore.append({
    ...entry,
    id: makeRef("RFD"),
    date: daysAgo(0, 14),
    type: "Refund",
    status: "Refund pending",
    fee: 0,
    parentId: entry.id,
  });
}
export function retryPayment(id: string) {
  const entry = ledgerStore.get().find((r) => r.id === id);
  if (!entry || entry.status !== "Failed") return;
  ledgerStore.append({ ...entry, id: makeRef("TRY"), date: daysAgo(0, 14), status: "Pending", parentId: entry.id });
}
