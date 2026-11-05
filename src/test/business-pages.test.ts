import { describe, expect, it } from "vitest";
import { businessStats, requestCard, requestCredit, cardsStore, toggleDemoCard, closeDemoCard } from "@/lib/demo/business-pages";
import { INITIAL_LEDGER, type LedgerEntry } from "@/lib/demo/ledger";

const row = (patch: Partial<LedgerEntry>): LedgerEntry => ({ id: "test", date: "2026-10-22T10:00:00Z", customer: "Customer", email: "test@example.com", type: "Payment", channel: "Card", currency: "NGN", amount: 100, fee: 2, status: "Successful", sourceChannel: "Checkout", accountId: "demo", ...patch });
describe("Business page safeguards", () => {
  it("never combines currencies in collection totals", () => {
    const result = businessStats([row({}), row({ currency: "USD", amount: 500 })], "NGN", "All time");
    expect(result.collected).toBe(100); expect(result.net).toBe(98);
  });
  it("excludes funding and unconfirmed payments from collected money", () => {
    const result = businessStats([row({}), row({ status: "Pending" }), row({ status: "Failed" }), row({ payinType: "Funding", amount: 1000 })], "NGN", "All time");
    expect(result.collected).toBe(100); expect(result.successRate).toBeCloseTo(100 / 3);
  });
  it("period selection excludes older records", () => {
    expect(businessStats([row({ date: "2026-09-01T10:00:00Z" }), row({})], "NGN", "Last 7 days").collected).toBe(100);
  });
  it("card requests never issue a real card or assign spending money", () => {
    const card = requestCard("Team expenses", "Chidi", "NGN");
    expect(card.status).toBe("Pending"); expect(card.last4).toBe(""); expect(card.limit).toBe(0);
  });
  it("closed demo cards cannot be resumed", () => {
    const initial = cardsStore.get(); const first = initial[0]; if (!first) throw new Error("Missing fixture");
    closeDemoCard(first.id); toggleDemoCard(first.id);
    expect(cardsStore.get().find(c => c.id === first.id)?.status).toBe("Closed"); cardsStore.set(initial);
  });
  it("credit requests remain pending without lender confirmation", () => {
    expect(requestCredit(250000, 3, "Buy stock").status).toBe("Pending");
  });
  it("rejects invalid credit amounts", () => {
    expect(() => requestCredit(0, 3, "Buy stock")).toThrow(); expect(() => requestCredit(NaN, 3, "Buy stock")).toThrow();
  });
  it("requires a valid credit term and purpose", () => {
    expect(() => requestCredit(1000, 13, "Stock")).toThrow(); expect(() => requestCredit(1000, 1, " ")).toThrow();
  });
  it("empty insights return finite zero metrics", () => {
    expect(businessStats(INITIAL_LEDGER, "ZAR", "All time").successRate).toBe(0);
  });
});