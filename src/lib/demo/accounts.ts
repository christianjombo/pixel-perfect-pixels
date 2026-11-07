// SAMPLE DATA — Nova Retail Ltd.'s Griv balances. Amounts are derived from the shared
// simulation layer's ledger movements, so Balances always reconciles with Transactions.
import { createSimStore } from "@/lib/sim/store";
import { getDataset } from "@/lib/sim/dataset";
import type { Currency } from "@/lib/money";

/** SAMPLE DATA — Nova Retail Ltd.'s Griv balances. Not real accounts. */
export type BalanceAccount = {
  id: string;
  name: string;
  kind: "Main" | "Payroll" | "Reserve" | "Collections";
  currency: Currency;
  /** Griv wallet identifier shown to the merchant. */
  walletId: string;
  /** Settlement bank account the wallet pays out to. */
  settlementBank: string;
  available: number;
  pending: number;
  reserved: number;
};

/** Live-environment base data, for tests and one-off derivations. */
export const INITIAL_ACCOUNTS: BalanceAccount[] = getDataset("live").accounts;

/** Shared so Transfers and Payouts reserve money from the same balances Balances shows. */
export const accountsStore = createSimStore<BalanceAccount[]>(
  "accounts",
  (env) => getDataset(env).accounts,
  { overlay: true },
);
export const useAccounts = () => accountsStore.use();
export const getAccount = (id: string) => accountsStore.get().find((a) => a.id === id);

/** Move money from available to pending (used when a demo transfer/payout is initiated, never "completed"). */
export function holdFunds(accountId: string, amount: number) {
  accountsStore.set((list) => list.map((a) => (a.id === accountId ? { ...a, available: a.available - amount, pending: a.pending + amount } : a)));
}
