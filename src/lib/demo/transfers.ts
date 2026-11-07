// SAMPLE DATA — internal account movements for Nova Retail Ltd., Lagos.
// Records come from the shared simulation layer and reference real balance accounts.
import { createSimStore } from "@/lib/sim/store";
import { getDataset } from "@/lib/sim/dataset";
import type { Currency } from "@/lib/money";
export type Transfer = {
  id: string;
  source: string;
  destination: string;
  amount: number;
  currency: Currency;
  reference: string;
  status: "Successful" | "Pending" | "Failed";
  date: string;
  completed?: string;
  reason?: string;
};
export const transfersStore = createSimStore<Transfer[]>(
  "transfers",
  (env) => getDataset(env).transfers,
  { overlay: true },
);
