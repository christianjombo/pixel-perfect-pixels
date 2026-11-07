import { describe, it, expect } from "vitest";
import { generateDataset, getDataset } from "./dataset";
import { mergeTxns } from "@/lib/demo/unified";

describe("shared simulation dataset", () => {
  const live = getDataset("live");
  const test = getDataset("test");

  it("is deterministic: same seed produces identical records", () => {
    const a = generateDataset("live");
    const b = generateDataset("live");
    expect(a.ledger.length).toBe(b.ledger.length);
    expect(a.ledger[0]).toEqual(b.ledger[0]);
    expect(a.cards[5]).toEqual(b.cards[5]);
    expect(a.accounts).toEqual(b.accounts);
  });

  it("isolates Test and Live datasets", () => {
    expect(live.ledger.length).toBeGreaterThan(test.ledger.length);
    expect(live.ledger[0]!.id).not.toBe(test.ledger[0]!.id);
    expect(live.customers.length).toBeGreaterThan(test.customers.length);
  });

  it("every ledger payment references a real customer and account", () => {
    const customerIds = new Set(live.customers.map((c) => c.id));
    const accountIds = new Set(live.accounts.map((a) => a.id));
    for (const e of live.ledger) {
      expect(accountIds.has(e.accountId)).toBe(true);
      if (e.type === "Payment") expect(customerIds.has(e.customerId ?? "")).toBe(true);
    }
  });

  it("every refund references an existing successful payment", () => {
    const byId = new Map(live.ledger.map((e) => [e.id, e]));
    for (const e of live.ledger) {
      if (e.type !== "Refund") continue;
      const parent = byId.get(e.parentId ?? "");
      expect(parent, `refund ${e.id} parent`).toBeDefined();
      expect(parent!.type).toBe("Payment");
      expect(parent!.status).toBe("Successful");
      expect(parent!.amount).toBe(e.amount);
    }
  });

  it("every transfer and payout references real accounts and recipients", () => {
    const accountIds = new Set(live.accounts.map((a) => a.id));
    const recipientIds = new Set(live.recipients.map((r) => r.id));
    for (const t of live.transfers) {
      expect(accountIds.has(t.source)).toBe(true);
      expect(accountIds.has(t.destination)).toBe(true);
      expect(t.source).not.toBe(t.destination);
    }
    for (const p of live.payouts) {
      expect(accountIds.has(p.source)).toBe(true);
      expect(recipientIds.has(p.recipient.id)).toBe(true);
    }
  });

  it("card transactions and funding reference real cards, and card totals are derived", () => {
    const cardIds = new Set(live.cards.map((c) => c.id));
    for (const t of live.cardTransactions) expect(cardIds.has(t.cardId)).toBe(true);
    for (const f of live.cardFunding) expect(cardIds.has(f.cardId)).toBe(true);
    for (const c of live.cards) {
      const funded = live.cardFunding
        .filter((f) => f.cardId === c.id && f.status === "Completed")
        .reduce((s, f) => s + f.amount, 0);
      const spent = live.cardTransactions
        .filter((t) => t.cardId === c.id && t.status === "Settled")
        .reduce((s, t) => s + t.amount, 0);
      expect(c.totalFunded).toBeCloseTo(funded, 2);
      expect(c.totalSpent).toBeCloseTo(spent, 2);
      expect(c.available).toBeCloseTo(Math.max(0, c.totalFunded - c.totalSpent - c.held), 2);
    }
  });

  it("account balances reconcile with the ledger movements", () => {
    // Recompute each account's net movement independently and check available - net
    // is a non-negative constant opening balance (never invented per page).
    for (const a of live.accounts) {
      let net = 0;
      for (const e of live.ledger) {
        if (e.accountId !== a.id) continue;
        const settled = ["Successful", "Refunded", "Reversed"].includes(e.status);
        if (!settled) continue;
        if (e.type === "Payment") net += e.amount - e.fee;
        else net -= e.amount;
      }
      for (const t of live.transfers) {
        if (t.status !== "Successful") continue;
        if (t.source === a.id) net -= t.amount;
        if (t.destination === a.id) net += t.amount;
      }
      for (const p of live.payouts) {
        if (p.source === a.id && p.status === "Successful") net -= p.amount + p.fee;
      }
      for (const f of live.cardFunding) {
        const src = f.currency === "NGN" ? "acc_ngn_main" : `acc_${f.currency.toLowerCase()}`;
        if (src === a.id && f.status === "Completed") net -= f.amount;
      }
      const opening = a.available - net;
      expect(opening).toBeGreaterThanOrEqual(0);
    }
  });

  it("Insights-style collections equal the sum of the same ledger rows (Scenario A)", () => {
    // October 2026 NGN collections via the unified projection must match a direct ledger sum.
    const merged = mergeTxns(live.ledger, live.transfers, live.payouts, live.accounts);
    const inOctober = (iso: string) => iso.slice(0, 7) === "2026-10";
    const viaProjection = merged
      .filter((r) => r.type === "Payment" && r.status === "Successful" && r.currency === "NGN" && inOctober(r.date))
      .reduce((s, r) => s + r.amount, 0);
    const viaLedger = live.ledger
      .filter((r) => r.type === "Payment" && r.status === "Successful" && r.currency === "NGN" && inOctober(r.date))
      .reduce((s, r) => s + r.amount, 0);
    expect(viaProjection).toBeCloseTo(viaLedger, 2);
    expect(viaProjection).toBeGreaterThan(0);
  });

  it("bakes in the business scenarios: September growth and the October card-failure spike", () => {
    const month = (iso: string) => iso.slice(0, 7);
    const sep = live.ledger.filter((e) => e.type === "Payment" && month(e.date) === "2026-09").length;
    const aug = live.ledger.filter((e) => e.type === "Payment" && month(e.date) === "2026-08").length;
    expect(sep).toBeGreaterThan(aug);
    const spike = live.ledger.filter(
      (e) => e.channel === "Card" && e.date.slice(0, 10) >= "2026-10-05" && e.date.slice(0, 10) <= "2026-10-11",
    );
    const baseline = live.ledger.filter(
      (e) => e.channel === "Card" && e.date.slice(0, 10) >= "2026-09-05" && e.date.slice(0, 10) <= "2026-09-11",
    );
    const failRate = (rows: typeof spike) => rows.filter((r) => r.status === "Failed").length / Math.max(1, rows.length);
    expect(failRate(spike)).toBeGreaterThan(failRate(baseline) * 2);
  });

  it("never mixes currencies in a single account", () => {
    for (const a of live.accounts) {
      for (const e of live.ledger) {
        if (e.accountId === a.id) expect(e.currency).toBe(a.currency);
      }
    }
  });
});
