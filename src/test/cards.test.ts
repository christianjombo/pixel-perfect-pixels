import { describe, expect, it } from "vitest";
import {
  cardExportRows, cardsStore, cardFundingStore, fundCard, issueCard, pauseCard, resumeCard,
  terminateCard, updateLimits, setAutoFunding,
} from "@/lib/demo/cards";

const firstActive = () => cardsStore.get().find(c => c.status === "Active")!;

describe("cards demo rules", () => {
  it("funding never completes client-side — it stays Processing", () => {
    const c = firstActive();
    const f = fundCard(c.id, 5000, c.fundingSource, "Test User");
    expect(f.status).toBe("Processing");
    expect(cardFundingStore.get().find(x => x.id === f.id)?.status).toBe("Processing");
  });

  it("terminated cards can never be resumed or funded", () => {
    const c = issueCard({ nickname: "Rule test", holder: "Test User", kind: "Virtual", network: "Visa", currency: "NGN", fundingModel: "Prefunded", fundingSource: "NGN business balance", initialFunding: 0, limits: { perTransaction: 1, daily: 2, monthly: 3 }, createdBy: "Test User" });
    terminateCard(c.id, "Test User", "Rule check");
    expect(() => resumeCard(c.id, "Test User")).toThrow(/never/i);
    expect(() => fundCard(c.id, 1000, "NGN business balance", "Test User")).toThrow(/funded/i);
  });

  it("pause only works on active cards and resume only on paused", () => {
    const c = firstActive();
    pauseCard(c.id, "Test User");
    expect(cardsStore.get().find(x => x.id === c.id)?.status).toBe("Paused");
    expect(() => pauseCard(c.id, "Test User")).toThrow();
    resumeCard(c.id, "Test User");
    expect(cardsStore.get().find(x => x.id === c.id)?.status).toBe("Active");
  });

  it("limits must be ordered per-transaction ≤ daily ≤ monthly", () => {
    const c = firstActive();
    expect(() => updateLimits(c.id, { perTransaction: 500, daily: 100, monthly: 1000 }, "Test User")).toThrow();
    expect(() => updateLimits(c.id, { perTransaction: 100, daily: 500, monthly: 1000 }, "Test User")).not.toThrow();
  });

  it("auto funding caps must be ordered and loop-safe", () => {
    const c = firstActive();
    expect(() => setAutoFunding(c.id, { enabled: true, threshold: 10, topUp: 500, source: "x", maxPerTopUp: 100, dailyCap: 1000, monthlyCap: 2000, minIntervalHours: 24 }, "Test User")).toThrow();
    expect(() => setAutoFunding(c.id, { enabled: true, threshold: 10, topUp: 100, source: "x", maxPerTopUp: 100, dailyCap: 1000, monthlyCap: 2000, minIntervalHours: 0 }, "Test User")).toThrow();
  });

  it("export excludes full card numbers and security codes", () => {
    const rows = cardExportRows(cardsStore.get());
    const keys = Object.keys(rows[0]!).join(" ").toLowerCase();
    expect(keys).not.toMatch(/pan|cvv|card number/);
    expect(JSON.stringify(rows)).not.toMatch(/\d{12,}/);
  });

  it("sample data covers required variety", () => {
    const cards = cardsStore.get();
    expect(cards.length).toBeGreaterThanOrEqual(25);
    for (const s of ["Active", "Paused", "Pending", "Terminated", "Expired"]) expect(cards.some(c => c.status === s)).toBe(true);
    expect(cards.some(c => c.source === "API")).toBe(true);
    expect(new Set(cards.map(c => c.currency)).size).toBeGreaterThan(2);
    expect(new Set(cards.map(c => c.network)).size).toBeGreaterThan(1);
    expect(cards.some(c => c.autoFunding.enabled)).toBe(true);
  });
});
