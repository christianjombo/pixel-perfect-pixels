/**
 * SHARED SIMULATION LAYER — the single source of sample data for the whole Griv prototype.
 *
 * `generateDataset(seed)` deterministically builds one interconnected "world" for the
 * primary demo business (Nova Retail Ltd., Lagos): customers, balance accounts, the
 * financial ledger, transfers, payouts, cards with their transactions and funding, and
 * settlement batches. Every page (Transactions, Balances, Cards, Insights, Dashboard)
 * and the Griv AI tools read from this dataset, so figures agree across modules.
 *
 * Rules enforced here:
 * - Deterministic: same seed → identical records (no Math.random / Date.now).
 * - Referential integrity: ledger rows reference real customers and accounts; refunds
 *   reference their original payment; card transactions and funding reference real cards;
 *   transfers and payouts reference real balance accounts.
 * - Derived, never invented: account balances are computed from ledger movements; card
 *   totals come from the card's own transactions and funding records.
 * - Amounts are never summed across currencies by this layer (see src/lib/money.ts).
 */
import { rngFor, int, float, pick, chance, weighted, seqId, type Rng } from "./rng";
import { DEMO_TODAY, daysAgo } from "@/lib/dates";
import type { Currency } from "@/lib/money";
import type { LedgerEntry } from "@/lib/demo/ledger";
import type { BalanceAccount } from "@/lib/demo/accounts";
import type { Transfer } from "@/lib/demo/transfers";
import type { Payout, Recipient } from "@/lib/demo/payouts";
import type { Customer } from "@/lib/demo/customers";
import type {
  DemoCardFull,
  CardTransaction,
  FundingRecord,
  CardActivity,
} from "@/lib/demo/cards";

/** Payout fee schedule — defined here so the generator and the payouts module share it. */
export const payoutFee = (amount: number, currency: Currency = "NGN") =>
  currency === "NGN"
    ? amount <= 5000
      ? 10.75
      : amount <= 50000
        ? 26.88
        : 53.75
    : currency === "GHS"
      ? 2
      : 30;

export type SimEnv = "live" | "test";

export type SimDataset = {
  env: SimEnv;
  customers: Customer[];
  accounts: BalanceAccount[];
  ledger: LedgerEntry[];
  transfers: Transfer[];
  recipients: Recipient[];
  payouts: Payout[];
  cards: DemoCardFull[];
  cardTransactions: CardTransaction[];
  cardFunding: FundingRecord[];
  cardActivity: CardActivity[];
};

/* ------------------------------- name pools ------------------------------- */

const FIRST = [
  "Ada", "Tunde", "Ama", "Wanjiku", "Chidi", "Fatima", "Kemi", "Emeka", "Ngozi", "Ibrahim",
  "Funmi", "Halima", "Segun", "Tola", "Adaeze", "Kwame", "Akosua", "Wanjiru", "Otieno", "Grace",
  "Yusuf", "Femi", "Chioma", "Amaka", "Kola", "Bola", "Uche", "Zainab", "Kofi", "Efua",
  "Mutiso", "Achieng", "Damilola", "Yetunde", "Obinna", "Nneka", "Sola", "Bisi", "Jide", "Rukayat",
];
const LAST = [
  "Okafor", "Bakare", "Mensah", "Mwangi", "Eze", "Bello", "Ajayi", "Obi", "Adeyemi", "Musa",
  "Yusuf", "Adeleke", "Martins", "Nnamdi", "Boateng", "Kamau", "Ochieng", "Okon", "Coker", "Lawal",
  "Adebayo", "Okonkwo", "Asante", "Nyong", "Diallo", "Ogunleye", "Chukwu", "Ibrahim", "Sanni", "Owusu",
];
const ORG_A = [
  "Bluefin", "Greenfield", "Zenith", "Pearl", "Amaka", "Kola", "Lagoon", "Savanna", "Hibiscus", "Cedar",
  "Orbit", "Palm", "Riverine", "Sunrise", "Delta", "Atlas", "Meadow", "Falcon", "Coral", "Ember",
];
const ORG_B = [
  "Hotels Ltd.", "Schools", "Events Co.", "Clinic", "Stores", "Law Firm", "Logistics", "Foods Ltd.",
  "Pharmacy", "Textiles", "Motors", "Farms", "Media", "Travels", "Hardware", "Bakery", "Fashions", "Electronics",
];
const CITIES: Array<[string, Customer["country"]]> = [
  ["Lagos", "Nigeria"], ["Ibadan", "Nigeria"], ["Abuja", "Nigeria"], ["Kano", "Nigeria"],
  ["Port Harcourt", "Nigeria"], ["Enugu", "Nigeria"], ["Onitsha", "Nigeria"], ["Kaduna", "Nigeria"],
  ["Accra", "Ghana"], ["Kumasi", "Ghana"], ["Nairobi", "Kenya"], ["Mombasa", "Kenya"],
  ["Johannesburg", "South Africa"], ["New York", "United States"], ["London", "United Kingdom"],
];

/** The original 24 literal customers stay first so existing flows/tests keep their identities. */
export const BASE_CUSTOMERS: Customer[] = [
  { id: "cus_01", name: "Chioma Eze", email: "chioma.eze@example.com", phone: "+234 803 412 7781", city: "Lagos", country: "Nigeria", kind: "user" },
  { id: "cus_02", name: "Bluefin Hotels Ltd.", email: "accounts@bluefinhotels.example", phone: "+234 809 220 1145", city: "Lagos", country: "Nigeria", kind: "org" },
  { id: "cus_03", name: "Tunde Bakare", email: "tunde.b@example.com", phone: "+234 802 671 9903", city: "Ibadan", country: "Nigeria", kind: "user" },
  { id: "cus_04", name: "Amaka Stores", email: "hello@amakastores.example", phone: "+234 816 300 4471", city: "Onitsha", country: "Nigeria", kind: "org" },
  { id: "cus_05", name: "Ngozi Adeyemi", email: "ngozi.adeyemi@example.com", phone: "+234 805 118 2290", city: "Abuja", country: "Nigeria", kind: "user" },
  { id: "cus_06", name: "Ibrahim Musa", email: "ibrahim.musa@example.com", phone: "+234 703 554 8812", city: "Kano", country: "Nigeria", kind: "user" },
  { id: "cus_07", name: "Kemi Ajayi", email: "kemi.ajayi@example.com", phone: "+234 810 442 0017", city: "Lagos", country: "Nigeria", kind: "user" },
  { id: "cus_08", name: "Emeka Obi", email: "emeka.obi@example.com", phone: "+234 806 993 3104", city: "Enugu", country: "Nigeria", kind: "user" },
  { id: "cus_09", name: "Greenfield Schools", email: "bursar@greenfield.example", phone: "+234 908 210 7765", city: "Port Harcourt", country: "Nigeria", kind: "org" },
  { id: "cus_10", name: "Zenith Events Co.", email: "finance@zenithevents.example", phone: "+234 813 776 2201", city: "Lagos", country: "Nigeria", kind: "org" },
  { id: "cus_11", name: "Funmi Bello", email: "funmi.bello@example.com", phone: "+234 802 330 6618", city: "Lagos", country: "Nigeria", kind: "user" },
  { id: "cus_12", name: "Halima Yusuf", email: "halima.y@example.com", phone: "+234 701 228 4490", city: "Kaduna", country: "Nigeria", kind: "user" },
  { id: "cus_13", name: "Segun Adeleke", email: "segun.adeleke@example.com", phone: "+234 807 665 1123", city: "Abeokuta", country: "Nigeria", kind: "user" },
  { id: "cus_14", name: "Pearl Clinic", email: "billing@pearlclinic.example", phone: "+234 909 118 5540", city: "Abuja", country: "Nigeria", kind: "org" },
  { id: "cus_15", name: "Tola Martins", email: "tola.martins@example.com", phone: "+234 812 904 7720", city: "Lagos", country: "Nigeria", kind: "user" },
  { id: "cus_16", name: "Adaeze Nnamdi", email: "adaeze.n@example.com", phone: "+234 806 501 3398", city: "Owerri", country: "Nigeria", kind: "user" },
  { id: "cus_17", name: "Kwame Mensah", email: "kwame.mensah@example.com", phone: "+233 24 410 7721", city: "Accra", country: "Ghana", kind: "user" },
  { id: "cus_18", name: "Akosua Boateng", email: "akosua.b@example.com", phone: "+233 20 655 1180", city: "Kumasi", country: "Ghana", kind: "user" },
  { id: "cus_19", name: "Wanjiru Kamau", email: "wanjiru.k@example.com", phone: "+254 712 330 448", city: "Nairobi", country: "Kenya", kind: "user" },
  { id: "cus_20", name: "Otieno Ochieng", email: "otieno.o@example.com", phone: "+254 722 901 116", city: "Mombasa", country: "Kenya", kind: "user" },
  { id: "cus_21", name: "Kola Law Firm", email: "accounts@kolalaw.example", phone: "+234 814 220 9076", city: "Lagos", country: "Nigeria", kind: "org" },
  { id: "cus_22", name: "Grace Okon", email: "grace.okon@example.com", phone: "+234 803 778 2215", city: "Uyo", country: "Nigeria", kind: "user" },
  { id: "cus_23", name: "Yusuf Bello", email: "yusuf.bello@example.com", phone: "+234 705 330 1879", city: "Ilorin", country: "Nigeria", kind: "user" },
  { id: "cus_24", name: "Femi Coker", email: "femi.coker@example.com", phone: "+234 802 115 6604", city: "Lagos", country: "Nigeria", kind: "user" },
];

/** Account identities are stable across environments; only the money movements differ. */
const ACCOUNT_SKELETONS: Array<Omit<BalanceAccount, "available" | "pending" | "reserved">> = [
  { id: "acc_ngn_main", name: "Main NGN", kind: "Main", currency: "NGN", walletId: "GRV-NG-20481937", settlementBank: "GTBank ••4821" },
  { id: "acc_ngn_payroll", name: "Payroll NGN", kind: "Payroll", currency: "NGN", walletId: "GRV-NG-20481952", settlementBank: "Access Bank ••1290" },
  { id: "acc_ngn_reserve", name: "Tax reserve NGN", kind: "Reserve", currency: "NGN", walletId: "GRV-NG-20482011", settlementBank: "GTBank ••4821" },
  { id: "acc_usd", name: "USD wallet", kind: "Collections", currency: "USD", walletId: "GRV-US-70014420", settlementBank: "Zenith Bank (Dom.) ••0917" },
  { id: "acc_ghs", name: "Accra GHS", kind: "Collections", currency: "GHS", walletId: "GRV-GH-31007768", settlementBank: "Ecobank Ghana ••5530" },
  { id: "acc_kes", name: "Nairobi KES", kind: "Collections", currency: "KES", walletId: "GRV-KE-41002291", settlementBank: "Equity Bank ••7712" },
];

const TEAM = ["Ada Okafor", "Tunde Bakare", "Chidi Eze", "Fatima Bello", "Kemi Ajayi"];
const BANKS = ["Access Bank", "GTBank", "Zenith Bank", "First Bank", "UBA", "Moniepoint"];
const CHANNELS = ["Card", "Bank transfer", "USSD", "Virtual account", "Payment link", "POS"] as const;
const SOURCE_CHANNELS = ["Checkout", "API", "Dashboard"] as const;
const FAIL_REASONS = [
  "Transaction declined by issuing bank.",
  "Insufficient funds in the customer's account.",
  "Card authentication timed out.",
  "3D Secure authentication failed.",
  "Do not honor (issuer refusal).",
];
const CARD_MERCHANTS = [
  ["AWS EMEA", "Software"], ["Google Workspace", "Software"], ["Jumia", "Shopping"],
  ["Konga", "Shopping"], ["Uber", "Transport"], ["Bolt", "Transport"],
  ["Chicken Republic", "Food"], ["Shoprite", "Groceries"], ["DHL Express", "Logistics"],
  ["Meta Ads", "Marketing"], ["Namecheap", "Software"], ["TotalEnergies", "Fuel"],
] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ----------------------------- generator ------------------------------ */

type Scale = { customers: number; payments: number; transfers: number; payouts: number; cards: number; cardTxns: number; funding: number; settlements: number };
const LIVE_SCALE: Scale = { customers: 2000, payments: 10000, transfers: 1000, payouts: 400, cards: 150, cardTxns: 1500, funding: 500, settlements: 500 };
const TEST_SCALE: Scale = { customers: 240, payments: 1200, transfers: 120, payouts: 60, cards: 24, cardTxns: 220, funding: 70, settlements: 60 };

function makeCustomers(rng: Rng, count: number): Customer[] {
  const out: Customer[] = [...BASE_CUSTOMERS];
  const used = new Set(out.map((c) => c.name));
  let i = out.length;
  while (out.length < count) {
    const isOrg = chance(rng, 0.22);
    let name = isOrg
      ? `${pick(rng, ORG_A)} ${pick(rng, ORG_B)}`
      : `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
    // Name pools are finite; disambiguate duplicates with a branch/unit suffix.
    let n = 2;
    while (used.has(name)) name = `${isOrg ? `${pick(rng, ORG_A)} ${pick(rng, ORG_B)}` : `${pick(rng, FIRST)} ${pick(rng, LAST)}`} ${isOrg ? `(${n++})` : String.fromCharCode(64 + n++) + "."}`;
    used.add(name);
    const [city, country] = pick(rng, CITIES);
    const slug = name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");
    out.push({
      id: seqId("cus", i, 4),
      name,
      email: isOrg ? `billing@${slug.replace(/\./g, "")}.example` : `${slug}@example.com`,
      phone: `+234 8${int(rng, 0, 9)}${int(rng, 100, 999)} ${int(rng, 1000, 9999)}`,
      city,
      country,
      kind: isOrg ? "org" : "user",
    });
    i++;
  }
  return out;
}

/** Per-day volume weights: September 2026 growth month, recency bias, weekend lift. */
function dayWeights() {
  const w: number[] = [];
  for (let d = 0; d < 365; d++) {
    const date = new Date(DEMO_TODAY);
    date.setDate(date.getDate() - d);
    const month = date.getMonth(); // 8 = September
    const dow = date.getDay();
    let weight = 1 + (d < 30 ? 0.35 : 0); // recent months busier
    if (month === 8) weight *= 1.7; // the strong-growth month
    if (dow === 0 || dow === 6) weight *= 1.25; // weekend sales pattern
    w.push(weight);
  }
  const total = w.reduce((s, x) => s + x, 0);
  const cum: number[] = [];
  let acc = 0;
  for (const x of w) cum.push((acc += x) / total);
  return cum;
}

function sampleDay(rng: Rng, cum: number[]): number {
  const roll = rng();
  let lo = 0, hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid]! < roll) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const CUR_WEIGHTS: Array<readonly [Currency, number]> = [
  ["NGN", 88], ["USD", 4], ["GHS", 4], ["KES", 4],
];
const accountFor = (c: Currency) =>
  c === "NGN" ? "acc_ngn_main" : (`acc_${c.toLowerCase()}` as string);

function amountFor(rng: Rng, currency: Currency, channel: string, day: number): number {
  const date = new Date(DEMO_TODAY);
  date.setDate(date.getDate() - day);
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const boost = weekend && (channel === "POS" || channel === "Payment link") ? 1.4 : 1;
  let base: number;
  switch (currency) {
    case "NGN": base = float(rng, 2500, 850000); break;
    case "USD": base = float(rng, 20, 2500); break;
    case "GHS": base = float(rng, 100, 8000); break;
    case "KES": base = float(rng, 500, 60000); break;
    default: base = float(rng, 100, 10000);
  }
  return round2(base * boost);
}

function feeFor(amount: number, currency: Currency): number {
  // Local collections 1.5% capped ₦2,000; international 3.5%.
  if (currency === "NGN") return round2(Math.min(amount * 0.015, 2000));
  return round2(amount * 0.035);
}

export function generateDataset(env: SimEnv): SimDataset {
  const scale = env === "live" ? LIVE_SCALE : TEST_SCALE;
  const rng = rngFor(`griv-sim:${env}:v1`);
  const customers = makeCustomers(rng, scale.customers);
  const cum = dayWeights();

  /* ---- ledger: payments, refunds, fees, settlements, reversals ---- */
  const ledger: LedgerEntry[] = [];
  const successfulPayments: LedgerEntry[] = [];
  let ref = 802400;
  for (let i = 0; i < scale.payments; i++) {
    const day = sampleDay(rng, cum);
    const currency = weighted(rng, CUR_WEIGHTS);
    const channel = pick(rng, CHANNELS);
    const customer = pick(rng, customers);
    const amount = amountFor(rng, currency, channel, day);
    // Scenario: card payments failed at 28% during the week of Oct 5–11 (day 11–17).
    const spikeWeek = channel === "Card" && day >= 11 && day <= 17;
    const failP = spikeWeek ? 0.28 : 0.06;
    let status: string = "Successful";
    let reason: string | undefined;
    const roll = rng();
    if (roll < failP) {
      status = "Failed";
      reason = pick(rng, FAIL_REASONS);
    } else if (roll < failP + 0.03 && day < 4) {
      status = "Pending";
    } else if (roll < failP + 0.05 && day < 2) {
      status = "Processing";
    }
    const entry: LedgerEntry = {
      id: `GRV-${ref++}`,
      date: daysAgo(day, int(rng, 8, 21), int(rng, 0, 59)),
      customer: customer.name,
      email: customer.email,
      type: "Payment",
      channel,
      currency,
      amount,
      fee: feeFor(amount, currency),
      status,
      ...(reason ? { reason } : {}),
      sourceChannel: pick(rng, SOURCE_CHANNELS),
      payinType: chance(rng, 0.04) ? "Funding" : "Pay-in",
      accountId: accountFor(currency),
      customerId: customer.id,
    };
    ledger.push(entry);
    if (status === "Successful") successfulPayments.push(entry);
  }
  // Refunds: ~2.5% of successful payments, referencing their parent.
  const refundCount = Math.floor(successfulPayments.length * 0.025);
  for (let i = 0; i < refundCount; i++) {
    const parent = successfulPayments[int(rng, 0, successfulPayments.length - 1)]!;
    ledger.push({
      id: `RFD-${ref++}`,
      date: daysAgo(Math.max(0, int(rng, 0, 10)), int(rng, 9, 18), int(rng, 0, 59)),
      customer: parent.customer,
      email: parent.email,
      type: "Refund",
      channel: parent.channel,
      currency: parent.currency,
      amount: parent.amount,
      fee: 0,
      status: chance(rng, 0.2) ? "Refund pending" : "Refunded",
      sourceChannel: "Dashboard",
      accountId: parent.accountId,
      parentId: parent.id,
      ...(parent.customerId ? { customerId: parent.customerId } : {}),
    });
  }
  // Monthly processing-fee rows per account.
  for (const skel of ACCOUNT_SKELETONS) {
    for (let m = 0; m < 12; m++) {
      const amount = skel.currency === "NGN" ? int(rng, 40000, 260000) : int(rng, 40, 900);
      ledger.push({
        id: `FEE-${ref++}`,
        date: daysAgo(m * 30 + int(rng, 1, 5), 6, 0),
        customer: "Griv",
        email: "billing@griv.example",
        type: "Fee",
        channel: "Bank transfer",
        currency: skel.currency,
        amount,
        fee: 0,
        status: "Successful",
        sourceChannel: "API",
        accountId: skel.id,
      });
    }
  }
  // Settlement batches sweeping to bank; three recent ones stay Pending (delayed scenario).
  for (let i = 0; i < scale.settlements; i++) {
    const skel = pick(rng, ACCOUNT_SKELETONS);
    const day = int(rng, 0, 340);
    const delayed = i < 3;
    ledger.push({
      id: `STL-${ref++}`,
      date: daysAgo(delayed ? int(rng, 1, 3) : day, 5, 30),
      customer: skel.settlementBank,
      email: "settlements@griv.example",
      type: "Settlement",
      channel: "Bank transfer",
      currency: skel.currency,
      amount: skel.currency === "NGN" ? int(rng, 500000, 6000000) : int(rng, 500, 20000),
      fee: 0,
      status: delayed ? "Pending" : "Successful",
      sourceChannel: "API",
      accountId: skel.id,
    });
  }
  ledger.sort((a, b) => b.date.localeCompare(a.date));

  /* ---- transfers between same-currency accounts ---- */
  const ngnAccounts = ["acc_ngn_main", "acc_ngn_payroll", "acc_ngn_reserve"];
  const TRANSFER_REFS = ["October payroll funding", "Weekly tax provision", "Store operations float", "Team expense allocation", "Supplier prepayment", "Petty cash top-up"];
  const transfers: Transfer[] = Array.from({ length: scale.transfers }, (_, i) => {
    const source = pick(rng, ngnAccounts);
    let destination = pick(rng, ngnAccounts);
    if (destination === source) destination = ngnAccounts[(ngnAccounts.indexOf(source) + 1) % 3]!;
    const day = sampleDay(rng, cum);
    const status: Transfer["status"] = chance(rng, 0.06) ? "Failed" : chance(rng, 0.08) ? "Pending" : "Successful";
    return {
      id: `TRF-NR-${2048 + i}`,
      source,
      destination,
      amount: int(rng, 150000, 3200000),
      currency: "NGN",
      reference: pick(rng, TRANSFER_REFS),
      status,
      date: daysAgo(day, int(rng, 9, 16), int(rng, 0, 59)),
      ...(status === "Successful" ? { completed: daysAgo(day, int(rng, 9, 16), int(rng, 0, 59)) } : {}),
      ...(status === "Failed" ? { reason: "The source account was temporarily unavailable. No funds were moved." } : {}),
    };
  });

  /* ---- recipients + payouts ---- */
  const recipients: Recipient[] = Array.from({ length: 40 }, (_, i) => {
    const currency = weighted(rng, [["NGN", 80], ["GHS", 10], ["KES", 10]] as const);
    const isMomo = currency !== "NGN" && chance(rng, 0.5);
    const name = chance(rng, 0.5)
      ? `${pick(rng, ORG_A)} ${pick(rng, ORG_B)}`.toUpperCase()
      : `${pick(rng, FIRST)} ${pick(rng, LAST)}`.toUpperCase();
    return {
      id: seqId("rec", i, 3),
      name,
      bank: isMomo ? (currency === "GHS" ? "MTN MoMo" : "M-Pesa") : pick(rng, BANKS),
      account: String(int(rng, 100000000, 999999999)),
      currency,
      channel: isMomo ? "Mobile money" : "Bank transfer",
    };
  });
  const NARRATIONS = ["Supplier payment", "Logistics settlement", "Inventory restock", "Contractor fees", "Equipment purchase", "Rent"];
  const payouts: Payout[] = Array.from({ length: scale.payouts }, (_, i) => {
    const recipient = pick(rng, recipients);
    const source = accountFor(recipient.currency);
    const amount = recipient.currency === "NGN" ? int(rng, 50000, 2400000) : int(rng, 200, 15000);
    const status: Payout["status"] = chance(rng, 0.05) ? "Failed" : chance(rng, 0.1) ? "Pending" : chance(rng, 0.04) ? "Scheduled" : "Successful";
    const day = sampleDay(rng, cum);
    return {
      id: `PAY-NR-${5000 + i}`,
      recipient,
      source,
      amount,
      fee: payoutFee(amount, recipient.currency),
      currency: recipient.currency,
      status,
      date: daysAgo(day, int(rng, 9, 17), int(rng, 0, 59)),
      narration: pick(rng, NARRATIONS),
      ...(status === "Failed" ? { reason: "The recipient bank rejected the transfer. No funds were moved." } : {}),
    };
  });

  /* ---- cards, card transactions, funding, activity ---- */
  const cards: DemoCardFull[] = [];
  const cardTransactions: CardTransaction[] = [];
  const cardFunding: FundingRecord[] = [];
  const cardActivity: CardActivity[] = [];
  const NICKNAMES = ["Business expenses", "Marketing spend", "Logistics", "Travel", "Office supplies", "Software subscriptions", "Fuel", "Procurement"];
  let cardRef = 900000;
  for (let i = 0; i < scale.cards; i++) {
    const currency = weighted(rng, [["NGN", 85], ["USD", 15]] as const);
    const holder = pick(rng, TEAM);
    const createdDay = int(rng, 60, 400);
    const status: DemoCardFull["status"] = chance(rng, 0.08) ? "Paused" : chance(rng, 0.05) ? "Terminated" : chance(rng, 0.04) ? "Pending" : "Active";
    const id = seqId("card", i, 4);
    const perTxn = currency === "NGN" ? int(rng, 50000, 500000) : int(rng, 100, 2000);
    const cardObj: DemoCardFull = {
      id,
      nickname: `${pick(rng, NICKNAMES)} ${i % 9 === 0 ? "card" : ""}`.trim(),
      holder,
      holderKind: "user",
      last4: String(int(rng, 1000, 9999)),
      network: pick(rng, ["Visa", "Mastercard", "Verve"] as const),
      kind: chance(rng, 0.7) ? "Virtual" : "Physical",
      currency,
      status,
      available: 0, // derived below
      held: 0,
      totalFunded: 0,
      totalSpent: 0,
      totalFees: 0,
      source: chance(rng, 0.2) ? "API" : "Dashboard",
      createdBy: "Ada Okafor",
      createdAt: daysAgo(createdDay, 9, 0),
      providerRef: `iss_${id.slice(5)}`,
      issueRef: `TXN-ISS-${cardRef++}`,
      fundingModel: "Prefunded",
      fundingSource: currency === "NGN" ? "NGN business balance" : "USD business balance",
      limits: { perTransaction: perTxn, daily: perTxn * 3, monthly: perTxn * 12 },
      restrictions: { categories: [], countries: [], channels: ["Online", "In-store", "ATM"] },
      autoFunding: { enabled: false, threshold: 0, topUp: 0, source: "", maxPerTopUp: 0, dailyCap: 0, monthlyCap: 0, minIntervalHours: 24 },
      limitsModifiedBy: "Ada Okafor",
      limitsModifiedAt: daysAgo(Math.max(0, createdDay - int(rng, 5, 60)), 11, 0),
    };

    // Funding events for this card (Completed unless very recent).
    const fundCount = Math.max(1, Math.round((scale.funding / scale.cards) * float(rng, 0.5, 1.5)));
    let funded = 0;
    for (let f = 0; f < fundCount; f++) {
      const day = int(rng, 0, createdDay);
      const amount = currency === "NGN" ? int(rng, 50000, 800000) : int(rng, 50, 3000);
      const fStatus: FundingRecord["status"] = day < 2 && chance(rng, 0.4) ? "Processing" : chance(rng, 0.03) ? "Failed" : "Completed";
      if (fStatus === "Completed") funded += amount;
      cardFunding.push({
        id: `FND-${cardRef++}`,
        cardId: id,
        date: daysAgo(day, int(rng, 8, 18), int(rng, 0, 59)),
        amount,
        currency,
        source: cardObj.fundingSource,
        method: "Balance transfer",
        initiatedBy: pick(rng, TEAM),
        channel: chance(rng, 0.2) ? "API" : "Dashboard",
        status: fStatus,
        linkedTxn: `TXN-FND-${cardRef}`,
      });
    }
    // Card spend: settled captures + a few declines.
    const txnCount = Math.max(1, Math.round((scale.cardTxns / scale.cards) * float(rng, 0.5, 1.6)));
    let spent = 0, fees = 0, held = 0;
    for (let t = 0; t < txnCount; t++) {
      const day = int(rng, 0, createdDay);
      const [merchant, category] = pick(rng, CARD_MERCHANTS);
      const amount = currency === "NGN" ? int(rng, 2000, 180000) : int(rng, 5, 800);
      const declined = chance(rng, 0.08);
      const pendingHold = !declined && day < 1 && chance(rng, 0.5);
      const fee = round2(amount * 0.01);
      if (declined) {
        // declined: no money moved
      } else if (pendingHold) {
        held += amount;
      } else {
        spent += amount;
        fees += fee;
      }
      cardTransactions.push({
        id: `CTX-${cardRef++}`,
        cardId: id,
        date: daysAgo(day, int(rng, 7, 22), int(rng, 0, 59)),
        merchant,
        category,
        type: declined ? "Decline" : pendingHold ? "Authorization" : "Capture",
        amount,
        currency,
        fee: declined ? 0 : fee,
        status: declined ? "Declined" : pendingHold ? "Approved" : "Settled",
        ref: `CRD-${cardRef}`,
        ...(declined ? { declineReason: pick(rng, FAIL_REASONS) } : {}),
      });
    }
    cardObj.totalFunded = round2(funded);
    cardObj.totalSpent = round2(spent);
    cardObj.totalFees = round2(fees);
    cardObj.held = round2(held);
    cardObj.available = round2(Math.max(0, funded - spent - held));
    if (status === "Terminated") {
      cardObj.terminatedAt = daysAgo(int(rng, 5, 50), 12, 0);
      cardObj.terminatedBy = "Ada Okafor";
      cardObj.terminateReason = "Card no longer needed";
    }
    cards.push(cardObj);
    cardActivity.push({
      id: `ACT-${cardRef++}`,
      cardId: id,
      time: cardObj.createdAt,
      type: "Card issued",
      actor: cardObj.createdBy,
      channel: cardObj.source,
      description: `${cardObj.kind} ${cardObj.network} card issued for ${holder}`,
      correlationId: `cor_${id}`,
      kind: "operational",
    });
  }

  /* ---- accounts derived from the movements above ---- */
  const accounts: BalanceAccount[] = ACCOUNT_SKELETONS.map((skel) => {
    let net = 0;
    let pending = 0;
    for (const e of ledger) {
      if (e.accountId !== skel.id) continue;
      const inflow = e.type === "Payment";
      const outflow = e.type === "Refund" || e.type === "Fee" || e.type === "Settlement" || e.type === "Reversal";
      const value = inflow ? e.amount - e.fee : outflow ? e.amount : 0;
      if (e.status === "Successful" || e.status === "Refunded" || e.status === "Reversed") {
        net += inflow ? value : -value;
      } else if (e.status === "Pending" || e.status === "Processing" || e.status === "Refund pending") {
        pending += inflow ? value : -value;
      }
    }
    for (const t of transfers) {
      if (t.status !== "Successful") continue;
      if (t.source === skel.id) net -= t.amount;
      if (t.destination === skel.id) net += t.amount;
    }
    for (const p of payouts) {
      if (p.source !== skel.id) continue;
      if (p.status === "Successful") net -= p.amount + p.fee;
      else if (p.status === "Pending") pending -= p.amount + p.fee;
    }
    for (const f of cardFunding) {
      // Funding sources are display labels ("NGN business balance"); map back to the account.
      if (accountFor(f.currency) !== skel.id) continue;
      if (f.status === "Completed") net -= f.amount;
      else if (f.status === "Processing") pending -= f.amount;
    }
    // Opening balance chosen so the derived available lands on a plausible target.
    const target =
      skel.id === "acc_ngn_main" ? 24_850_000
      : skel.id === "acc_ngn_payroll" ? 6_200_000
      : skel.id === "acc_ngn_reserve" ? 3_400_000
      : skel.id === "acc_usd" ? 18_420.5
      : skel.id === "acc_ghs" ? 86_300
      : 412_500;
    const opening = Math.max(0, round2(target - net));
    return {
      ...skel,
      available: round2(opening + net),
      pending: round2(Math.max(0, pending)),
      reserved: skel.kind === "Reserve" ? 3_400_000 : 0,
    };
  });

  return { env, customers, accounts, ledger, transfers, recipients, payouts, cards, cardTransactions, cardFunding, cardActivity };
}

/* ------------------------------ caching ------------------------------ */

const cache = new Map<SimEnv, SimDataset>();

/** Memoized per environment; generation is deterministic so caching is safe. */
export function getDataset(env: SimEnv): SimDataset {
  let d = cache.get(env);
  if (!d) {
    d = generateDataset(env);
    cache.set(env, d);
  }
  return d;
}
