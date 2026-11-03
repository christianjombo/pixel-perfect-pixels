/** Settings for the Checkout Demo page and how they turn into a checkout session. */
import type { SessionInput } from "./machine";
import { parseToMinor, type CheckoutCurrency } from "./money";
import { type ChannelId, type CountryCode, type DeviceId, type EligibilityContext, defaultChannels, getCountry, visibleChannels } from "./registry";
import type { Scenario } from "./useCheckoutEngine";

export type DemoConfig = {
  merchantName: string;
  merchantEmail: string;
  merchantRef: string;
  country: CountryCode;
  amount: string;
  currency: CheckoutCurrency;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  txnRef: string;
  orderRef: string;
  enabled: ChannelId[];
  scenario: Scenario;
  delaySec: number;
  windowMinutes: number;
  device: DeviceId;
  walletReady: boolean;
};

const DEFAULT_AMOUNT: Record<CountryCode, string> = { NG: "25000", GH: "350", KE: "4500", CI: "15000", ZA: "650" };

export function defaultConfig(country: CountryCode = "NG"): DemoConfig {
  const c = getCountry(country);
  return {
    merchantName: "Acme Store",
    merchantEmail: "support@acmestore.example",
    merchantRef: "ACME-001",
    country,
    amount: DEFAULT_AMOUNT[country],
    currency: c.currency,
    description: "Order #1042 — 2 items",
    customerName: "Ada Obi",
    customerEmail: "ada@example.com",
    customerPhone: "",
    txnRef: "",
    orderRef: "ORD-1042",
    enabled: defaultChannels(country),
    scenario: "success",
    delaySec: 2,
    windowMinutes: 10,
    device: "iphone_safari",
    walletReady: true,
  };
}

/** Changing country resets currency, amount and channels to that market's defaults; merchant details stay. */
export function switchCountry(cfg: DemoConfig, country: CountryCode): DemoConfig {
  const d = defaultConfig(country);
  return { ...cfg, country, currency: d.currency, amount: d.amount, enabled: d.enabled, customerPhone: "" };
}

export const eligibilityContext = (cfg: DemoConfig, amountMinor: number): EligibilityContext => ({
  country: cfg.country, currency: cfg.currency, amountMinor, device: cfg.device, walletReady: cfg.walletReady,
});

export function configErrors(cfg: DemoConfig) {
  const e: Partial<Record<"amount" | "merchantName" | "customerEmail" | "merchantEmail" | "channels", string>> = {};
  const minor = parseToMinor(cfg.amount, cfg.currency);
  if (minor == null) e.amount = cfg.currency === "XOF" ? "Enter a whole number — XOF has no decimals." : "Enter an amount with up to 2 decimals.";
  else if (minor <= 0) e.amount = "Amount must be more than zero.";
  if (!cfg.merchantName.trim()) e.merchantName = "Enter a merchant name.";
  if (cfg.customerEmail && !/^\S+@\S+\.\S+$/.test(cfg.customerEmail)) e.customerEmail = "Enter a valid email.";
  if (!/^\S+@\S+\.\S+$/.test(cfg.merchantEmail)) e.merchantEmail = "Enter a valid email.";
  if (minor != null && minor > 0 && visibleChannels(cfg.enabled, eligibilityContext(cfg, minor)).length === 0) {
    e.channels = "Switch on at least one method that works for this amount, currency and device.";
  }
  return { errors: e, amountMinor: minor ?? 0, valid: Object.keys(e).length === 0 };
}

export function toSessionInput(cfg: DemoConfig, amountMinor: number): SessionInput {
  return {
    merchantId: `mrc_demo_${cfg.merchantRef.toLowerCase().replace(/[^a-z0-9]+/g, "_") || "merchant"}`,
    merchantName: cfg.merchantName.trim() || "Merchant",
    country: cfg.country,
    currency: cfg.currency,
    amountMinor,
    description: cfg.description,
    customer: { name: cfg.customerName, email: cfg.customerEmail, phone: cfg.customerPhone },
    ...(cfg.txnRef.trim() ? { reference: cfg.txnRef.trim() } : {}),
    ...(cfg.orderRef.trim() ? { orderReference: cfg.orderRef.trim() } : {}),
    enabledChannels: cfg.enabled,
  };
}
