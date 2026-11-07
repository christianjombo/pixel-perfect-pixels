// SAMPLE DATA — external payouts and fictional recipients for Nova Retail Ltd., Lagos.
// Records come from the shared simulation layer and reference real balance accounts.
import { createSimStore } from "@/lib/sim/store";
import { getDataset, payoutFee } from "@/lib/sim/dataset";
import type { Currency } from "@/lib/money";
export type Recipient = {
  id: string;
  name: string;
  bank: string;
  account: string;
  currency: Currency;
  channel: "Bank transfer" | "Mobile money";
};
export const BANKS = ["Access Bank", "GTBank", "Zenith Bank", "First Bank", "UBA", "Moniepoint"];
export { payoutFee };
export type Payout = {
  id: string;
  recipient: Recipient;
  source: string;
  amount: number;
  fee: number;
  currency: Currency;
  status: "Successful" | "Pending" | "Failed" | "Scheduled";
  date: string;
  narration: string;
  schedule?: string;
  reason?: string;
  retryOf?: string;
};
export const recipientStore = createSimStore<Recipient[]>(
  "recipients",
  (env) => getDataset(env).recipients,
  { overlay: true },
);
export const payoutsStore = createSimStore<Payout[]>(
  "payouts",
  (env) => getDataset(env).payouts,
  { overlay: true },
);
export type BulkRow = {
  line: number;
  name: string;
  bank: string;
  account: string;
  amount: number;
  narration: string;
  error: string;
};
/** RFC-4180 style quoted fields; all uploaded rows are explicitly NGN bank payouts. */
export function parsePayoutCsv(text: string): BulkRow[] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, ""); // strips a leading BOM
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) records.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("Unclosed quoted field. Check the CSV formatting.");
  row.push(cell);
  if (row.some((v) => v.trim())) records.push(row);
  const header = records.shift()?.map((s) => s.trim().toLowerCase());
  const expected = ["name", "bank", "account", "amount", "narration"];
  if (!header || expected.some((h, i) => header[i] !== h) || header.length !== 5)
    throw new Error("Use the template columns: name,bank,account,amount,narration.");
  if (records.length > 500) throw new Error("Upload at most 500 payouts per batch.");
  return records.map((r, i) => {
    const [name = "", bank = "", account = "", raw = "", narration = ""] = r.map((v) => v.trim());
    const amount = Number(raw);
    const errors = [
      r.length !== 5 ? "Expected five columns" : "",
      !name ? "Recipient name required" : "",
      !BANKS.includes(bank) ? "Unsupported bank" : "",
      !/^\d{10}$/.test(account) ? "Account must be a 10-digit NUBAN" : "",
      !Number.isFinite(amount) || amount <= 0 || !/^\d+(\.\d{1,2})?$/.test(raw)
        ? "Amount must be positive with up to two decimals"
        : "",
      !narration ? "Narration required" : "",
    ].filter(Boolean);
    return { line: i + 2, name, bank, account, amount, narration, error: errors.join("; ") };
  });
}
