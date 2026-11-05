import { createDemoStore, makeRef } from "@/lib/demo-store";
import { inRange, type DateRange } from "@/lib/dates";
import type { Currency } from "@/lib/money";
import type { Customer } from "./customers";
import type { LedgerEntry } from "./ledger";

export type Supplier = Customer & { category: string; notes: string };
export const suppliersStore = createDemoStore<Supplier[]>([
  { id: "sup_01", name: "Lagoon Packaging", email: "orders@lagoon.example", phone: "+234 800 000 0101", city: "Lagos", country: "Nigeria", kind: "org", category: "Packaging", notes: "Paper bags and takeaway containers." },
  { id: "sup_02", name: "Green Basket Wholesale", email: "sales@greenbasket.example", phone: "+234 800 000 0102", city: "Ibadan", country: "Nigeria", kind: "org", category: "Stock", notes: "Weekly produce orders." },
  { id: "sup_03", name: "Amina Bello", email: "amina@supplier.example", phone: "+234 800 000 0103", city: "Abuja", country: "Nigeria", kind: "user", category: "Services", notes: "Photography and catalogue services." },
  { id: "sup_04", name: "Coastline Logistics", email: "dispatch@coastline.example", phone: "+234 800 000 0104", city: "Lagos", country: "Nigeria", kind: "org", category: "Logistics", notes: "Local deliveries." },
]);
export function saveSupplier(input: Omit<Supplier, "id">, id?: string) {
  const supplier = { ...input, id: id ?? makeRef("sup") };
  suppliersStore.set(all => id ? all.map(s => s.id === id ? supplier : s) : [supplier, ...all]);
  return supplier;
}

export type DemoCard = { id: string; name: string; holder: string; last4: string; currency: Currency; status: "Active" | "Paused" | "Closed" | "Pending"; limit: number; spent: number };
export const cardsStore = createDemoStore<DemoCard[]>([
  { id: "card_01", name: "Business expenses", holder: "Ada Okafor", last4: "2048", currency: "NGN", status: "Active", limit: 250000, spent: 48500 },
  { id: "card_02", name: "Online subscriptions", holder: "Ada Okafor", last4: "8012", currency: "USD", status: "Paused", limit: 500, spent: 89 },
]);
export const cardRequestsStore = createDemoStore<DemoCard[]>([]);
export function requestCard(name: string, holder: string, currency: Currency) {
  if (!name.trim() || !holder.trim()) throw new Error("Enter a card name and cardholder.");
  const card: DemoCard = { id: makeRef("card"), name: name.trim(), holder: holder.trim(), last4: "", currency, status: "Pending", limit: 0, spent: 0 };
  cardRequestsStore.set(all => [card, ...all]);
  return card;
}
export function toggleDemoCard(id: string) {
  cardsStore.set(all => all.map(c => c.id === id && (c.status === "Active" || c.status === "Paused") ? { ...c, status: c.status === "Active" ? "Paused" : "Active" } : c));
}
export function closeDemoCard(id: string) {
  cardsStore.set(all => all.map(c => c.id === id ? { ...c, status: "Closed" } : c));
}

export type CreditApplication = { id: string; amount: number; purpose: string; months: number; status: "Pending"; date: string };
export const creditApplicationsStore = createDemoStore<CreditApplication[]>([]);
export function requestCredit(amount: number, months: number, purpose: string) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter an amount greater than zero.");
  if (!Number.isInteger(months) || months < 1 || months > 12) throw new Error("Select a term from 1 to 12 months.");
  if (!purpose.trim()) throw new Error("Enter the purpose of your request.");
  const application: CreditApplication = { id: makeRef("CRD"), amount, months, purpose: purpose.trim(), status: "Pending", date: new Date().toISOString() };
  creditApplicationsStore.set(all => [application, ...all]);
  return application;
}

export function businessStats(rows: LedgerEntry[], currency: Currency, range: DateRange) {
  const payments = rows.filter(r => r.currency === currency && r.type === "Payment" && r.payinType !== "Funding" && inRange(r.date, range));
  const successful = payments.filter(r => r.status === "Successful");
  const collected = successful.reduce((s, r) => s + r.amount, 0);
  const fees = successful.reduce((s, r) => s + r.fee, 0);
  const channels = [...new Set(payments.map(r => r.channel))].map(name => {
    const subset = successful.filter(r => r.channel === name);
    return { name, count: subset.length, amount: subset.reduce((s, r) => s + r.amount, 0) };
  }).sort((a, b) => b.amount - a.amount);
  const customers = [...new Set(successful.map(r => r.customer))].map(name => {
    const subset = successful.filter(r => r.customer === name);
    return { name, count: subset.length, amount: subset.reduce((s, r) => s + r.amount, 0) };
  }).sort((a, b) => b.amount - a.amount);
  const daily = new Map<string, number>();
  for (const r of successful) { const key = r.date.slice(0, 10); daily.set(key, (daily.get(key) ?? 0) + r.amount); }
  return { payments, successful, collected, fees, net: collected - fees, average: successful.length ? collected / successful.length : 0, successRate: payments.length ? successful.length / payments.length * 100 : 0, channels, customers, series: [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ key, value })) };
}