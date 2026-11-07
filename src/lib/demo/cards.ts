// SAMPLE DATA — card programme demo. No real cards, PANs, CVVs or provider calls exist here.
// Cards, their transactions, funding records and activity come from the shared simulation
// layer (src/lib/sim): card totals are derived from the card's own records, and completed
// funding debits the same balance accounts the Balances page shows.
// Money movements (funding) never reach a final success state client-side; they stay
// "Processing" until a real issuer/ledger confirms, per the project's demo-money rule.
import { makeRef } from "@/lib/demo-store";
import { createSimStore } from "@/lib/sim/store";
import { getDataset } from "@/lib/sim/dataset";
import { nowIso } from "@/lib/dates";
import type { Currency } from "@/lib/money";

export type CardNetwork = "Visa" | "Mastercard" | "Verve";
export type CardStatus = "Active" | "Paused" | "Pending" | "Terminated" | "Expired";
export type CardKind = "Virtual" | "Physical";
export type IssueSource = "Dashboard" | "API";
export type FundingModel = "Prefunded" | "Linked balance";

export type SpendingLimits = { perTransaction: number; daily: number; monthly: number };
export type CardRestrictions = { categories: string[]; countries: string[]; channels: ("Online" | "In-store" | "ATM")[] };
export type AutoFundingRule = {
  enabled: boolean;
  threshold: number;
  topUp: number;
  source: string;
  maxPerTopUp: number;
  dailyCap: number;
  monthlyCap: number;
  minIntervalHours: number;
};

export type DemoCardFull = {
  id: string;
  nickname: string;
  holder: string;
  holderKind: "user" | "org";
  last4: string;
  network: CardNetwork;
  kind: CardKind;
  currency: Currency;
  status: CardStatus;
  available: number;
  held: number;
  totalFunded: number;
  totalSpent: number;
  totalFees: number;
  source: IssueSource;
  createdBy: string;
  createdAt: string;
  providerRef: string;
  issueRef: string;
  fundingModel: FundingModel;
  fundingSource: string;
  limits: SpendingLimits;
  restrictions: CardRestrictions;
  autoFunding: AutoFundingRule;
  limitsModifiedBy: string;
  limitsModifiedAt: string;
  terminatedAt?: string | undefined;
  terminatedBy?: string | undefined;
  terminateReason?: string | undefined;
};

export type CardTxnType = "Authorization" | "Capture" | "Reversal" | "Refund" | "Decline" | "Adjustment" | "Fee";
export type CardTransaction = {
  id: string;
  cardId: string;
  date: string;
  merchant: string;
  category: string;
  type: CardTxnType;
  amount: number;
  currency: Currency;
  fee: number;
  status: "Approved" | "Settled" | "Declined" | "Reversed" | "Refunded";
  ref: string;
  settleAmount?: number | undefined;
  settleCurrency?: Currency | undefined;
  declineReason?: string | undefined;
};

export type FundingRecord = {
  id: string;
  cardId: string;
  date: string;
  amount: number;
  currency: Currency;
  source: string;
  method: "Balance transfer";
  initiatedBy: string;
  channel: "Dashboard" | "API" | "Automatic rule";
  status: "Completed" | "Processing" | "Failed";
  linkedTxn: string;
};

export type CardActivity = {
  id: string;
  cardId: string;
  time: string;
  type: string;
  actor: string;
  channel: "Dashboard" | "API" | "Automatic rule" | "Issuer webhook";
  description: string;
  ref?: string | undefined;
  correlationId: string;
  kind: "financial" | "operational";
};

const NO_AUTO: AutoFundingRule = { enabled: false, threshold: 0, topUp: 0, source: "", maxPerTopUp: 0, dailyCap: 0, monthlyCap: 0, minIntervalHours: 24 };
const ALL_CHANNELS: CardRestrictions["channels"] = ["Online", "In-store", "ATM"];

function card(partial: Partial<DemoCardFull> & Pick<DemoCardFull, "id" | "nickname" | "holder" | "last4" | "network" | "kind" | "currency" | "status" | "createdAt">): DemoCardFull {
  return {
    holderKind: "user", available: 0, held: 0, totalFunded: 0, totalSpent: 0, totalFees: 0,
    source: "Dashboard", createdBy: "Ada Okafor", providerRef: `iss_${partial.id.slice(5)}`, issueRef: `TXN-ISS-${partial.last4}`,
    fundingModel: "Prefunded", fundingSource: "NGN business balance",
    limits: { perTransaction: 100000, daily: 300000, monthly: 1000000 },
    restrictions: { categories: [], countries: [], channels: ALL_CHANNELS },
    autoFunding: NO_AUTO, limitsModifiedBy: "Ada Okafor", limitsModifiedAt: partial.createdAt,
    ...partial,
  };
}

export const cardsStore = createSimStore<DemoCardFull[]>("cards", (env) => getDataset(env).cards, { overlay: true });
export const cardTxnsStore = createSimStore<CardTransaction[]>("card-txns", (env) => getDataset(env).cardTransactions, { overlay: true });
export const cardFundingStore = createSimStore<FundingRecord[]>("card-funding", (env) => getDataset(env).cardFunding, { overlay: true });
export const cardActivityStore = createSimStore<CardActivity[]>("card-activity", (env) => getDataset(env).cardActivity, { overlay: true });

export const getCard = (id: string) => cardsStore.get().find(c => c.id === id);
export const cardTxns = (id: string) => cardTxnsStore.get().filter(t => t.cardId === id);
export const cardFunding = (id: string) => cardFundingStore.get().filter(f => f.cardId === id);
export const cardActivity = (id: string) => cardActivityStore.get().filter(a => a.cardId === id);

function logActivity(cardId: string, type: string, actor: string, channel: CardActivity["channel"], description: string, kind: CardActivity["kind"], ref?: string) {
  const event: CardActivity = { id: makeRef("act"), cardId, time: nowIso(), type, actor, channel, description, ref, correlationId: makeRef("req").toLowerCase(), kind };
  cardActivityStore.set(all => [event, ...all]);
}

/* ---------- Actions (demo service — realistic state transitions, labelled as sample) ---------- */

export function issueCard(input: {
  nickname: string; holder: string; kind: CardKind; network: CardNetwork; currency: Currency;
  fundingModel: FundingModel; fundingSource: string; initialFunding: number; limits: SpendingLimits; createdBy: string;
}) {
  if (!input.nickname.trim()) throw new Error("Enter a card nickname.");
  if (!input.holder.trim()) throw new Error("Enter a cardholder.");
  if (input.initialFunding < 0) throw new Error("Initial funding can't be negative.");
  const c = card({
    id: makeRef("card").toLowerCase().replace("card-", "card_"), nickname: input.nickname.trim(), holder: input.holder.trim(),
    last4: "", network: input.network, kind: input.kind, currency: input.currency, status: "Pending", createdAt: nowIso(),
    createdBy: input.createdBy, fundingModel: input.fundingModel, fundingSource: input.fundingSource, limits: input.limits,
  });
  cardsStore.set(all => [c, ...all]);
  logActivity(c.id, "Issuance requested", input.createdBy, "Dashboard", "Issuance request sent to the demo issuer. The card activates when the issuer confirms.", "operational", c.issueRef);
  if (input.initialFunding > 0) {
    const f: FundingRecord = {
      id: makeRef("fund").toLowerCase().replace("fund-", "fund_"), cardId: c.id, date: nowIso(), amount: input.initialFunding,
      currency: input.currency, source: input.fundingSource, method: "Balance transfer", initiatedBy: input.createdBy,
      channel: "Dashboard", status: "Processing", linkedTxn: makeRef("TXN-FND"),
    };
    cardFundingStore.set(all => [f, ...all]);
    logActivity(c.id, "Initial funding initiated", input.createdBy, "Dashboard", "Initial funding is processing and completes only when the issuer confirms.", "financial", f.linkedTxn);
  }
  return c;
}

/** Funding never completes client-side — it stays Processing until a real issuer/ledger confirms. */
export function fundCard(cardId: string, amount: number, source: string, actor: string, reference?: string) {
  const c = getCard(cardId);
  if (!c) throw new Error("Card not found.");
  if (c.status === "Terminated" || c.status === "Expired") throw new Error("This card can no longer be funded.");
  if (c.status === "Pending") throw new Error("This card isn't active yet — funding starts once the issuer confirms it.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter an amount greater than zero.");
  if (amount < (c.currency === "USD" ? 5 : 1000)) throw new Error(`Minimum funding is ${c.currency === "USD" ? "$5" : "1,000"} in the card's currency.`);
  if (source !== c.fundingSource && !source.endsWith("business balance")) throw new Error("Funding source currency must match the card currency.");
  const f: FundingRecord = {
    id: makeRef("fund").toLowerCase().replace("fund-", "fund_"), cardId, date: nowIso(), amount, currency: c.currency,
    source, method: "Balance transfer", initiatedBy: actor, channel: "Dashboard", status: "Processing",
    linkedTxn: reference?.trim() || makeRef("TXN-FND"),
  };
  cardFundingStore.set(all => [f, ...all]);
  logActivity(cardId, "Funding initiated", actor, "Dashboard", `Funding of ${amount} ${c.currency} from ${source} is processing. It completes only on issuer confirmation.`, "financial", f.linkedTxn);
  return f;
}

export function pauseCard(cardId: string, actor: string) {
  const c = getCard(cardId);
  if (!c || c.status !== "Active") throw new Error("Only an active card can be paused.");
  cardsStore.set(all => all.map(x => x.id === cardId ? { ...x, status: "Paused" } : x));
  logActivity(cardId, "Card paused", actor, "Dashboard", "New authorizations are declined while paused.", "operational");
}

export function resumeCard(cardId: string, actor: string) {
  const c = getCard(cardId);
  if (!c || c.status !== "Paused") throw new Error("Only a paused card can be resumed. Terminated cards can never be resumed.");
  cardsStore.set(all => all.map(x => x.id === cardId ? { ...x, status: "Active" } : x));
  logActivity(cardId, "Card resumed", actor, "Dashboard", "Card is active again.", "operational");
}

export function terminateCard(cardId: string, actor: string, reason: string) {
  const c = getCard(cardId);
  if (!c) throw new Error("Card not found.");
  if (c.status === "Terminated") throw new Error("This card is already terminated.");
  if (!reason.trim()) throw new Error("Record a reason for terminating this card.");
  cardsStore.set(all => all.map(x => x.id === cardId ? { ...x, status: "Terminated", terminatedAt: nowIso(), terminatedBy: actor, terminateReason: reason.trim() } : x));
  logActivity(cardId, "Card terminated", actor, "Dashboard", `Terminated: ${reason.trim()}. Any remaining balance is settled by the issuer's refund workflow, not moved automatically.`, "operational");
}

export function renameCard(cardId: string, nickname: string, actor: string) {
  if (!nickname.trim()) throw new Error("Enter a nickname.");
  cardsStore.set(all => all.map(x => x.id === cardId ? { ...x, nickname: nickname.trim() } : x));
  logActivity(cardId, "Nickname changed", actor, "Dashboard", `Renamed to "${nickname.trim()}".`, "operational");
}

export function updateLimits(cardId: string, limits: SpendingLimits, actor: string) {
  if (limits.perTransaction <= 0 || limits.daily <= 0 || limits.monthly <= 0) throw new Error("Limits must be greater than zero.");
  if (limits.perTransaction > limits.daily || limits.daily > limits.monthly) throw new Error("Per-transaction limit can't exceed the daily limit, and daily can't exceed monthly.");
  cardsStore.set(all => all.map(x => x.id === cardId ? { ...x, limits, limitsModifiedBy: actor, limitsModifiedAt: nowIso() } : x));
  logActivity(cardId, "Spending limit changed", actor, "Dashboard", `Per-transaction ${limits.perTransaction}, daily ${limits.daily}, monthly ${limits.monthly}.`, "operational");
}

export function setAutoFunding(cardId: string, rule: AutoFundingRule, actor: string) {
  if (rule.enabled) {
    if (rule.threshold <= 0 || rule.topUp <= 0) throw new Error("Set a threshold and top-up amount greater than zero.");
    if (rule.topUp > rule.maxPerTopUp) throw new Error("Top-up amount can't exceed the maximum per top-up.");
    if (rule.maxPerTopUp > rule.dailyCap || rule.dailyCap > rule.monthlyCap) throw new Error("Per-top-up max can't exceed the daily cap, and daily can't exceed monthly.");
    if (rule.minIntervalHours < 1) throw new Error("Minimum interval must be at least 1 hour to prevent funding loops.");
  }
  cardsStore.set(all => all.map(x => x.id === cardId ? { ...x, autoFunding: rule } : x));
  logActivity(cardId, rule.enabled ? "Automatic funding configured" : "Automatic funding disabled", actor, "Dashboard",
    rule.enabled ? `Top up ${rule.topUp} when balance falls below ${rule.threshold}. Caps: ${rule.dailyCap}/day, ${rule.monthlyCap}/month, min ${rule.minIntervalHours}h between top-ups.` : "Automatic funding rule turned off.", "operational");
}

/* ---------- CSV export — sensitive data (full PAN/CVV) is never stored, so never exported ---------- */
export function cardExportRows(cards: DemoCardFull[]) {
  return cards.map(c => ({
    "Card ID": c.id, Nickname: c.nickname, Cardholder: c.holder, "Last 4": c.last4 || "—", Network: c.network,
    Type: c.kind, Currency: c.currency, Status: c.status, "Available balance": c.available, "Total spend": c.totalSpent,
    Source: c.source, "Created by": c.createdBy, "Created at": c.createdAt,
  }));
}
