// SAMPLE DATA — card programme demo. No real cards, PANs, CVVs or provider calls exist here.
// Money movements (funding) never reach a final success state client-side; they stay
// "Processing" until a real issuer/ledger confirms, per the project's demo-money rule.
import { createDemoStore, makeRef } from "@/lib/demo-store";
import { daysAgo, nowIso } from "@/lib/dates";
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

const INITIAL_CARDS: DemoCardFull[] = [
  card({ id: "card_0101", nickname: "Business expenses", holder: "Ada Okafor", last4: "2048", network: "Visa", kind: "Virtual", currency: "NGN", status: "Active", createdAt: daysAgo(210, 9), available: 412500, held: 38000, totalFunded: 2400000, totalSpent: 1945500, totalFees: 42000, limits: { perTransaction: 250000, daily: 500000, monthly: 2000000 } }),
  card({ id: "card_0102", nickname: "Online subscriptions", holder: "Ada Okafor", last4: "8012", network: "Mastercard", kind: "Virtual", currency: "USD", status: "Paused", createdAt: daysAgo(180, 11), available: 311, totalFunded: 900, totalSpent: 589, totalFees: 12, fundingSource: "USD business balance", autoFunding: { ...NO_AUTO, enabled: true, threshold: 50, topUp: 200, source: "USD business balance", maxPerTopUp: 200, dailyCap: 200, monthlyCap: 600, minIntervalHours: 24 } }),
  card({ id: "card_0103", nickname: "Logistics fuel card", holder: "Coastline Logistics", holderKind: "org", last4: "5541", network: "Verve", kind: "Physical", currency: "NGN", status: "Active", createdAt: daysAgo(160, 8), available: 96500, totalFunded: 800000, totalSpent: 703500, totalFees: 9500, restrictions: { categories: ["Fuel", "Tolls"], countries: ["Nigeria"], channels: ["In-store", "ATM"] } }),
  card({ id: "card_0104", nickname: "Marketing spend", holder: "Tunde Bakare", last4: "3390", network: "Visa", kind: "Virtual", currency: "USD", status: "Active", createdAt: daysAgo(140, 14), source: "API", createdBy: "nova-ads-service (API key ••••7f2a)", available: 1240, totalFunded: 5000, totalSpent: 3760, totalFees: 55, fundingSource: "USD business balance" }),
  card({ id: "card_0105", nickname: "Office supplies", holder: "Funmi Adeyemi", last4: "7723", network: "Mastercard", kind: "Physical", currency: "NGN", status: "Active", createdAt: daysAgo(120, 10), available: 58000, held: 12500, totalFunded: 350000, totalSpent: 279500, totalFees: 6100 }),
  card({ id: "card_0106", nickname: "Travel & accommodation", holder: "Ada Okafor", last4: "9182", network: "Visa", kind: "Physical", currency: "NGN", status: "Active", createdAt: daysAgo(110, 16), available: 210000, totalFunded: 600000, totalSpent: 390000, totalFees: 7200 }),
  card({ id: "card_0107", nickname: "Cloud infrastructure", holder: "nova-infra (API)", holderKind: "org", last4: "4455", network: "Mastercard", kind: "Virtual", currency: "USD", status: "Active", createdAt: daysAgo(96, 12), source: "API", createdBy: "nova-infra-service (API key ••••c41d)", available: 640, totalFunded: 3200, totalSpent: 2560, totalFees: 38, fundingSource: "USD business balance", autoFunding: { ...NO_AUTO, enabled: true, threshold: 100, topUp: 500, source: "USD business balance", maxPerTopUp: 500, dailyCap: 500, monthlyCap: 1500, minIntervalHours: 48 } }),
  card({ id: "card_0108", nickname: "Procurement — Accra", holder: "Kofi Mensah", last4: "6208", network: "Visa", kind: "Virtual", currency: "GHS", status: "Active", createdAt: daysAgo(88, 9), available: 4200, totalFunded: 15000, totalSpent: 10800, totalFees: 210, fundingSource: "GHS business balance" }),
  card({ id: "card_0109", nickname: "Nairobi operations", holder: "Wanjiru Njoroge", last4: "1174", network: "Mastercard", kind: "Virtual", currency: "KES", status: "Active", createdAt: daysAgo(80, 13), available: 88500, totalFunded: 400000, totalSpent: 311500, totalFees: 5200, fundingSource: "KES business balance" }),
  card({ id: "card_0110", nickname: "Events & activations", holder: "Funmi Adeyemi", last4: "2850", network: "Verve", kind: "Physical", currency: "NGN", status: "Paused", createdAt: daysAgo(75, 15), available: 34000, totalFunded: 250000, totalSpent: 216000, totalFees: 4100 }),
  card({ id: "card_0111", nickname: "Software tooling", holder: "Ibrahim Musa", last4: "9034", network: "Visa", kind: "Virtual", currency: "USD", status: "Active", createdAt: daysAgo(68, 10), available: 175, totalFunded: 1200, totalSpent: 1025, totalFees: 18, fundingSource: "USD business balance" }),
  card({ id: "card_0112", nickname: "Cape Town suppliers", holder: "Pieter van Wyk", last4: "5519", network: "Mastercard", kind: "Virtual", currency: "ZAR", status: "Active", createdAt: daysAgo(60, 11), available: 9200, totalFunded: 30000, totalSpent: 20800, totalFees: 380, fundingSource: "ZAR business balance" }),
  card({ id: "card_0113", nickname: "Petty cash — Lekki store", holder: "Nova Retail Ltd.", holderKind: "org", last4: "3367", network: "Verve", kind: "Physical", currency: "NGN", status: "Active", createdAt: daysAgo(55, 9), available: 15000, totalFunded: 120000, totalSpent: 105000, totalFees: 1800, limits: { perTransaction: 20000, daily: 50000, monthly: 150000 } }),
  card({ id: "card_0114", nickname: "Ads — Meta & Google", holder: "Tunde Bakare", last4: "7841", network: "Visa", kind: "Virtual", currency: "USD", status: "Active", createdAt: daysAgo(48, 14), source: "API", createdBy: "nova-ads-service (API key ••••7f2a)", available: 890, held: 120, totalFunded: 4500, totalSpent: 3490, totalFees: 62, fundingSource: "USD business balance" }),
  card({ id: "card_0115", nickname: "Team meals", holder: "Nova Retail Ltd.", holderKind: "org", last4: "2290", network: "Mastercard", kind: "Virtual", currency: "NGN", status: "Active", createdAt: daysAgo(40, 12), available: 46000, totalFunded: 150000, totalSpent: 104000, totalFees: 1500, limits: { perTransaction: 30000, daily: 60000, monthly: 200000 } }),
  card({ id: "card_0116", nickname: "Old travel card", holder: "Ada Okafor", last4: "6013", network: "Visa", kind: "Physical", currency: "NGN", status: "Expired", createdAt: daysAgo(720, 10), available: 0, totalFunded: 900000, totalSpent: 887500, totalFees: 12500 }),
  card({ id: "card_0117", nickname: "Q1 campaign card", holder: "Tunde Bakare", last4: "8456", network: "Mastercard", kind: "Virtual", currency: "USD", status: "Terminated", createdAt: daysAgo(300, 9), available: 0, totalFunded: 2000, totalSpent: 2000, totalFees: 30, terminatedAt: daysAgo(95, 17), terminatedBy: "Ada Okafor", terminateReason: "Campaign ended" }),
  card({ id: "card_0118", nickname: "Former staff card", holder: "Chidi Eze", last4: "1102", network: "Verve", kind: "Physical", currency: "NGN", status: "Terminated", createdAt: daysAgo(400, 11), available: 0, totalFunded: 300000, totalSpent: 214000, totalFees: 4300, terminatedAt: daysAgo(120, 10), terminatedBy: "Ada Okafor", terminateReason: "Staff exit — remaining ₦86,000 returned to NGN balance by issuer settlement" }),
  card({ id: "card_0119", nickname: "Pilot API card", holder: "nova-sandbox (API)", holderKind: "org", last4: "9987", network: "Visa", kind: "Virtual", currency: "USD", status: "Terminated", createdAt: daysAgo(250, 13), source: "API", createdBy: "nova-sandbox (API key ••••09be)", available: 0, totalFunded: 500, totalSpent: 480, totalFees: 8, terminatedAt: daysAgo(200, 9), terminatedBy: "nova-sandbox (API)", terminateReason: "Pilot complete" }),
  card({ id: "card_0120", nickname: "Warehouse fuel", holder: "Ibrahim Musa", last4: "4471", network: "Verve", kind: "Physical", currency: "NGN", status: "Active", createdAt: daysAgo(30, 8), available: 72000, totalFunded: 200000, totalSpent: 128000, totalFees: 2400, restrictions: { categories: ["Fuel"], countries: ["Nigeria"], channels: ["In-store", "ATM"] } }),
  card({ id: "card_0121", nickname: "New joiner — design", holder: "Zara Ahmed", last4: "", network: "Visa", kind: "Virtual", currency: "NGN", status: "Pending", createdAt: daysAgo(2, 10) }),
  card({ id: "card_0122", nickname: "New joiner — engineering", holder: "Emeka Obi", last4: "", network: "Mastercard", kind: "Virtual", currency: "USD", status: "Pending", createdAt: daysAgo(1, 15), source: "API", createdBy: "nova-hr-service (API key ••••3aa1)", fundingSource: "USD business balance" }),
  card({ id: "card_0123", nickname: "Photography shoots", holder: "Amina Bello", last4: "6630", network: "Visa", kind: "Virtual", currency: "NGN", status: "Active", createdAt: daysAgo(22, 12), available: 28500, totalFunded: 100000, totalSpent: 71500, totalFees: 1100 }),
  card({ id: "card_0124", nickname: "Kumasi market runs", holder: "Kofi Mensah", last4: "3822", network: "Mastercard", kind: "Physical", currency: "GHS", status: "Paused", createdAt: daysAgo(18, 9), available: 1100, totalFunded: 6000, totalSpent: 4900, totalFees: 95, fundingSource: "GHS business balance" }),
  card({ id: "card_0125", nickname: "Mombasa deliveries", holder: "Wanjiru Njoroge", last4: "7546", network: "Visa", kind: "Physical", currency: "KES", status: "Active", createdAt: daysAgo(12, 14), available: 41000, totalFunded: 150000, totalSpent: 109000, totalFees: 1900, fundingSource: "KES business balance" }),
  card({ id: "card_0126", nickname: "Joburg client visits", holder: "Pieter van Wyk", last4: "2218", network: "Mastercard", kind: "Virtual", currency: "ZAR", status: "Active", createdAt: daysAgo(8, 11), available: 5600, totalFunded: 12000, totalSpent: 6400, totalFees: 110, fundingSource: "ZAR business balance" }),
  card({ id: "card_0127", nickname: "Packaging samples", holder: "Funmi Adeyemi", last4: "5093", network: "Visa", kind: "Virtual", currency: "NGN", status: "Active", createdAt: daysAgo(5, 10), available: 60000, totalFunded: 80000, totalSpent: 20000, totalFees: 400 }),
];

const MERCHANTS: [string, string][] = [
  ["Jumia Nigeria", "E-commerce"], ["Uber for Business", "Transport"], ["AWS EMEA", "Cloud services"],
  ["Google Ads", "Advertising"], ["Meta Platforms", "Advertising"], ["Total Energies", "Fuel"],
  ["Shoprite", "Office supplies"], ["Bolt Business", "Transport"], ["Verve Coffee Co.", "Meals"],
  ["DHL Express", "Logistics"], ["Canva", "Software"], ["Namecheap", "Software"],
];

function txnsFor(c: DemoCardFull, count: number): CardTransaction[] {
  if (c.status === "Pending" || !c.last4) return [];
  const out: CardTransaction[] = [];
  for (let i = 0; i < count; i++) {
    const [merchant, category] = MERCHANTS[(i + c.last4.charCodeAt(0)) % MERCHANTS.length]!;
    const day = 1 + ((i * 3 + c.last4.charCodeAt(1)) % 25);
    const base = c.currency === "USD" ? 8 + i * 7 : c.currency === "NGN" ? 4500 + i * 3200 : 300 + i * 140;
    const declined = i % 7 === 3;
    const refunded = i % 9 === 5;
    const type: CardTxnType = declined ? "Decline" : refunded ? "Refund" : i % 5 === 4 ? "Authorization" : "Capture";
    out.push({
      id: `ctxn_${c.id.slice(5)}_${String(i + 1).padStart(2, "0")}`,
      cardId: c.id, date: daysAgo(day, 9 + (i % 9), (i * 17) % 60), merchant, category, type,
      amount: refunded ? -Math.round(base / 2) : base, currency: c.currency,
      fee: type === "Capture" ? Math.round(base * 0.012 * 100) / 100 : 0,
      status: declined ? "Declined" : refunded ? "Refunded" : type === "Authorization" ? "Approved" : "Settled",
      ref: `TXN-CRD-${c.last4}${String(i + 1).padStart(2, "0")}`,
      declineReason: declined ? (i % 2 ? "Insufficient card balance" : "Merchant category not allowed") : undefined,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

function fundingFor(c: DemoCardFull): FundingRecord[] {
  if (c.status === "Pending" || c.totalFunded === 0) return [];
  const parts = c.totalFunded >= 1000000 ? 4 : c.totalFunded >= 100000 ? 3 : 2;
  const out: FundingRecord[] = [];
  let remaining = c.totalFunded;
  for (let i = 0; i < parts; i++) {
    const amount = i === parts - 1 ? remaining : Math.round(c.totalFunded / parts);
    remaining -= amount;
    const automatic = c.autoFunding.enabled && i > 0;
    out.push({
      id: `fund_${c.id.slice(5)}_${i + 1}`, cardId: c.id, date: daysAgo(4 + i * 21, 8 + i, 15),
      amount, currency: c.currency, source: c.fundingSource, method: "Balance transfer",
      initiatedBy: automatic ? "Automatic rule" : c.source === "API" ? c.createdBy : "Ada Okafor",
      channel: automatic ? "Automatic rule" : c.source, status: "Completed",
      linkedTxn: `TXN-FND-${c.last4}${i + 1}`,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

function activityFor(c: DemoCardFull, txns: CardTransaction[], funds: FundingRecord[]): CardActivity[] {
  const events: CardActivity[] = [{
    id: `act_${c.id}_issue`, cardId: c.id, time: c.createdAt, type: "Card issued", actor: c.createdBy, channel: c.source,
    description: `${c.kind} ${c.network} card issued (${c.fundingModel.toLowerCase()} funding).`, ref: c.issueRef,
    correlationId: `req_${c.id.slice(5)}_issue`, kind: "operational",
  }];
  for (const f of funds) events.push({
    id: `act_${f.id}`, cardId: c.id, time: f.date, type: f.channel === "Automatic rule" ? "Automatic funding rule triggered" : "Card funded",
    actor: f.initiatedBy, channel: f.channel, description: `${f.status === "Completed" ? "Funded" : "Funding"} from ${f.source}.`,
    ref: f.linkedTxn, correlationId: `req_${f.id}`, kind: "financial",
  });
  for (const t of txns.filter(t => t.type === "Decline").slice(0, 2)) events.push({
    id: `act_${t.id}`, cardId: c.id, time: t.date, type: "Authorization declined", actor: "Card issuer", channel: "Issuer webhook",
    description: `${t.merchant}: ${t.declineReason}.`, ref: t.ref, correlationId: `req_${t.id}`, kind: "financial",
  });
  if (c.status === "Paused") events.push({
    id: `act_${c.id}_pause`, cardId: c.id, time: daysAgo(6, 16), type: "Card paused", actor: "Ada Okafor", channel: "Dashboard",
    description: "Card paused from the dashboard.", correlationId: `req_${c.id.slice(5)}_pause`, kind: "operational",
  });
  if (c.status === "Terminated" && c.terminatedAt) events.push({
    id: `act_${c.id}_term`, cardId: c.id, time: c.terminatedAt, type: "Card terminated", actor: c.terminatedBy ?? "Ada Okafor", channel: c.source,
    description: `Terminated: ${c.terminateReason ?? "No reason recorded"}.`, correlationId: `req_${c.id.slice(5)}_term`, kind: "operational",
  });
  return events.sort((a, b) => b.time.localeCompare(a.time));
}

const INITIAL_TXNS = INITIAL_CARDS.flatMap(c => txnsFor(c, 8));
const INITIAL_FUNDING = INITIAL_CARDS.flatMap(fundingFor);
const INITIAL_ACTIVITY = INITIAL_CARDS.flatMap(c => activityFor(c, INITIAL_TXNS.filter(t => t.cardId === c.id), INITIAL_FUNDING.filter(f => f.cardId === c.id)));

export const cardsStore = createDemoStore<DemoCardFull[]>(INITIAL_CARDS);
export const cardTxnsStore = createDemoStore<CardTransaction[]>(INITIAL_TXNS);
export const cardFundingStore = createDemoStore<FundingRecord[]>(INITIAL_FUNDING);
export const cardActivityStore = createDemoStore<CardActivity[]>(INITIAL_ACTIVITY);

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
