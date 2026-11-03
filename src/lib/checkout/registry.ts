/**
 * Central, typed registry of demo markets, payment channels and providers for Griv Checkout.
 * Components never hardcode availability — they ask this file. Coverage was modelled on public
 * payment-provider documentation for the initial demo only; it is NOT proof of what Griv
 * supports in production. Edit entries here to change the checkout without touching the UI.
 */
import type { CheckoutCurrency } from "./money";

export type CountryCode = "NG" | "GH" | "KE" | "CI" | "ZA";
export type ChannelId =
  | "card" | "bank_transfer" | "pay_with_bank" | "ussd" | "qr" | "mobile_money" | "mpesa"
  | "eft" | "capitec_pay" | "payattitude" | "apple_pay" | "google_pay";
export type Availability = "supported" | "unavailable" | "experimental";

/** How the customer authorises a payment for a provider. */
export type AuthKind =
  | "card" | "transfer" | "otp" | "app_approval" | "token" | "ussd_dial" | "qr_scan"
  | "phone_prompt" | "voucher" | "ussd_otp" | "stk_push" | "till" | "bank_redirect"
  | "wallet_sheet" | "payattitude_prompt";

export type FieldId = "card" | "account_number" | "dob" | "phone" | "identifier" | "voucher" | "bank";

export type Provider = {
  id: string;
  name: string;
  auth: AuthKind;
  /** Extra fields this provider needs before the payment can start. */
  fields?: FieldId[];
  status?: Availability;
  /** Short instruction shown to the customer. */
  hint?: string;
  /** Demo-only code shown for USSD-style flows. Never a real bank code. */
  demoCode?: string;
};

export type DeviceId = "iphone_safari" | "mac_safari" | "android_chrome" | "desktop_chrome" | "desktop_firefox";
export const DEVICES: { id: DeviceId; label: string }[] = [
  { id: "iphone_safari", label: "iPhone · Safari" },
  { id: "mac_safari", label: "Mac · Safari" },
  { id: "android_chrome", label: "Android · Chrome" },
  { id: "desktop_chrome", label: "Windows · Chrome" },
  { id: "desktop_firefox", label: "Windows · Firefox" },
];

export type ChannelEntry = {
  channel: ChannelId;
  status: Availability;
  currencies: CheckoutCurrency[];
  providers: Provider[];
  /** Demo limits in minor units. */
  minMinor?: number;
  maxMinor?: number;
  devices?: DeviceId[];
  /** Needs a card saved in the device wallet (Apple Pay / Google Pay). */
  needsWallet?: boolean;
  merchantEligibility?: string;
  customerEligibility?: string;
  /** Channel-specific simulation outcomes on top of the shared ones. */
  extraScenarios?: string[];
  note?: string;
};

export type Country = {
  code: CountryCode;
  name: string;
  flag: string;
  currency: CheckoutCurrency;
  currencies: CheckoutCurrency[];
  dialCode: string;
  /** National significant number (without leading 0). */
  phone: { digits: number; pattern: RegExp; example: string };
  channels: ChannelEntry[];
};

export const CHANNEL_INFO: Record<ChannelId, { label: string; description: string }> = {
  card: { label: "Card", description: "Visa, Mastercard and local cards" },
  bank_transfer: { label: "Bank transfer", description: "Send to a one-time account" },
  pay_with_bank: { label: "Pay with bank", description: "Approve from your bank account" },
  ussd: { label: "USSD", description: "Dial a code on any phone" },
  qr: { label: "QR code", description: "Scan with a banking or wallet app" },
  mobile_money: { label: "Mobile money", description: "Approve on your phone" },
  mpesa: { label: "M-PESA", description: "STK push or Till number" },
  eft: { label: "Instant EFT", description: "Pay from your online banking" },
  capitec_pay: { label: "Capitec Pay", description: "Approve in the Capitec app" },
  payattitude: { label: "PayAttitude", description: "Pay with your phone number" },
  apple_pay: { label: "Apple Pay", description: "Pay with your Apple wallet" },
  google_pay: { label: "Google Pay", description: "Pay with your Google wallet" },
};

export const CHANNEL_ORDER: ChannelId[] = [
  "card", "bank_transfer", "pay_with_bank", "ussd", "mobile_money", "mpesa", "qr",
  "eft", "capitec_pay", "payattitude", "apple_pay", "google_pay",
];

const APPLE: DeviceId[] = ["iphone_safari", "mac_safari"];
const GOOGLE: DeviceId[] = ["android_chrome", "desktop_chrome"];
const TRANSFER_SCENARIOS = ["exact", "underpaid", "overpaid", "duplicate", "late", "delayed"];

const card = (brands: [string, Availability][], currencies: CheckoutCurrency[], minMinor: number): ChannelEntry => ({
  channel: "card", status: "supported", currencies, minMinor,
  providers: brands.map(([name, status]) => ({ id: name.toLowerCase().replace(/\s/g, "_"), name, auth: "card", fields: ["card"], status })),
  extraScenarios: ["otp", "3ds_redirect", "3ds_challenge", "auth_failed", "declined"],
});
const applePay = (status: Availability, currencies: CheckoutCurrency[]): ChannelEntry => ({
  channel: "apple_pay", status, currencies, devices: APPLE, needsWallet: true,
  providers: [{ id: "apple_pay", name: "Apple Pay", auth: "wallet_sheet" }],
  merchantEligibility: "Merchant domain must be verified for Apple Pay.",
  customerEligibility: "Safari on an Apple device with a card in Wallet.",
});
const googlePay = (currencies: CheckoutCurrency[]): ChannelEntry => ({
  channel: "google_pay", status: "experimental", currencies, devices: GOOGLE, needsWallet: true,
  providers: [{ id: "google_pay", name: "Google Pay", auth: "wallet_sheet" }],
  merchantEligibility: "Needs merchant activation and a provider that supports Google Pay in this market.",
  customerEligibility: "Chrome on Android or desktop with a supported card saved to Google Pay.",
  note: "Not confirmed for this market — shown for preview only.",
});
const off = (channel: ChannelId): ChannelEntry => ({ channel, status: "unavailable", currencies: [], providers: [] });

export const COUNTRIES: Country[] = [
  {
    code: "NG", name: "Nigeria", flag: "🇳🇬", currency: "NGN", currencies: ["NGN", "USD"], dialCode: "+234",
    phone: { digits: 10, pattern: /^[789][01]\d{8}$/, example: "803 000 0000" },
    channels: [
      card([["Visa", "supported"], ["Mastercard", "supported"], ["Verve", "supported"], ["American Express", "experimental"]], ["NGN", "USD"], 5000),
      {
        channel: "bank_transfer", status: "supported", currencies: ["NGN"], minMinor: 10000, maxMinor: 1_000_000_000,
        providers: [{ id: "griv_demo_settlement", name: "Griv Demo Settlement Bank", auth: "transfer" }],
        extraScenarios: TRANSFER_SCENARIOS,
      },
      {
        channel: "pay_with_bank", status: "supported", currencies: ["NGN"], minMinor: 10000,
        providers: [
          { id: "lagoon", name: "Lagoon Demo Bank", auth: "otp", fields: ["account_number"], hint: "We'll text a one-time code to the phone on your account." },
          { id: "kola", name: "Kola Demo Bank", auth: "app_approval", fields: ["account_number"], hint: "Approve the request in your bank app." },
          { id: "harmattan", name: "Harmattan Demo Bank", auth: "token", fields: ["account_number"], hint: "Enter the code from your hardware or soft token." },
          { id: "baobab", name: "Baobab Demo Bank", auth: "otp", fields: ["account_number", "dob"], hint: "Confirm your date of birth, then enter the code we text you." },
        ],
      },
      {
        channel: "ussd", status: "supported", currencies: ["NGN"], minMinor: 10000, maxMinor: 100_000_000,
        providers: [
          { id: "lagoon", name: "Lagoon Demo Bank", auth: "ussd_dial", demoCode: "*000*101" },
          { id: "kola", name: "Kola Demo Bank", auth: "ussd_dial", demoCode: "*000*202" },
          { id: "harmattan", name: "Harmattan Demo Bank", auth: "ussd_dial", demoCode: "*000*303" },
        ],
      },
      { channel: "qr", status: "supported", currencies: ["NGN"], providers: [{ id: "visa_qr", name: "Visa QR", auth: "qr_scan", hint: "Scan with any banking app that supports Visa QR." }] },
      off("mobile_money"), off("mpesa"), off("eft"), off("capitec_pay"),
      {
        channel: "payattitude", status: "supported", currencies: ["NGN"],
        providers: [{ id: "payattitude", name: "PayAttitude", auth: "payattitude_prompt", fields: ["phone"], hint: "Use the phone number linked to your PayAttitude-enabled bank account." }],
        merchantEligibility: "Must be switched on for the merchant.",
      },
      applePay("supported", ["NGN", "USD"]),
      googlePay(["NGN"]),
    ],
  },
  {
    code: "GH", name: "Ghana", flag: "🇬🇭", currency: "GHS", currencies: ["GHS"], dialCode: "+233",
    phone: { digits: 9, pattern: /^[235]\d{8}$/, example: "24 000 0000" },
    channels: [
      card([["Visa", "supported"], ["Mastercard", "supported"]], ["GHS"], 100),
      {
        channel: "bank_transfer", status: "experimental", currencies: ["GHS"], minMinor: 100,
        providers: [{ id: "griv_demo_settlement", name: "Griv Demo Settlement Bank", auth: "transfer" }],
        extraScenarios: TRANSFER_SCENARIOS, note: "Not confirmed for Ghana — shown for preview only.",
      },
      off("pay_with_bank"), off("ussd"), off("qr"),
      {
        channel: "mobile_money", status: "supported", currencies: ["GHS"], minMinor: 100, maxMinor: 1_000_000,
        providers: [
          { id: "mtn_gh", name: "MTN Mobile Money", auth: "phone_prompt", fields: ["phone"], hint: "A prompt will appear on your phone. Enter your MoMo PIN there, never here." },
          { id: "telecel", name: "Telecel Cash", auth: "voucher", fields: ["phone"], hint: "Generate a payment voucher on your phone, then enter it here." },
          { id: "atmoney", name: "AT Money", auth: "phone_prompt", fields: ["phone"], status: "experimental", hint: "Approve the prompt on your phone." },
        ],
        extraScenarios: ["rejected", "wrong_number", "timeout"],
      },
      off("mpesa"), off("eft"), off("capitec_pay"), off("payattitude"),
      applePay("supported", ["GHS"]),
      googlePay(["GHS"]),
    ],
  },
  {
    code: "KE", name: "Kenya", flag: "🇰🇪", currency: "KES", currencies: ["KES"], dialCode: "+254",
    phone: { digits: 9, pattern: /^[17]\d{8}$/, example: "712 000 000" },
    channels: [
      card([["Visa", "supported"], ["Mastercard", "supported"], ["American Express", "experimental"]], ["KES"], 1000),
      off("bank_transfer"), off("pay_with_bank"), off("ussd"), off("qr"),
      {
        channel: "mobile_money", status: "experimental", currencies: ["KES"],
        providers: [{ id: "airtel_ke", name: "Airtel Money", auth: "phone_prompt", fields: ["phone"], status: "experimental", hint: "Approve the prompt on your phone." }],
        note: "Not confirmed for Kenya — shown for preview only.",
      },
      {
        channel: "mpesa", status: "supported", currencies: ["KES"], minMinor: 100, maxMinor: 25_000_000,
        providers: [
          { id: "mpesa_stk", name: "M-PESA (STK push)", auth: "stk_push", fields: ["phone"], hint: "We'll send a prompt to your phone. Enter your M-PESA PIN there, never here." },
          { id: "mpesa_till", name: "M-PESA Till number", auth: "till", hint: "Pay from the M-PESA menu using Lipa na M-PESA → Buy Goods." },
        ],
        extraScenarios: ["declined", "timeout", "duplicate"],
      },
      off("eft"), off("capitec_pay"), off("payattitude"),
      applePay("supported", ["KES"]),
      googlePay(["KES"]),
    ],
  },
  {
    code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", currency: "XOF", currencies: ["XOF"], dialCode: "+225",
    phone: { digits: 10, pattern: /^0[157]\d{8}$/, example: "07 00 00 00 00" },
    channels: [
      card([["Visa", "supported"], ["Mastercard", "supported"]], ["XOF"], 100),
      off("bank_transfer"), off("pay_with_bank"), off("ussd"), off("qr"),
      {
        channel: "mobile_money", status: "supported", currencies: ["XOF"], minMinor: 100, maxMinor: 2_000_000,
        providers: [
          { id: "orange_ci", name: "Orange Money", auth: "ussd_otp", fields: ["phone"], demoCode: "#000*82#", hint: "Dial the code on your Orange line to get a one-time code, then enter it here." },
          { id: "mtn_ci", name: "MTN Mobile Money", auth: "phone_prompt", fields: ["phone"], hint: "A prompt will appear on your phone. Enter your PIN there, never here." },
          { id: "wave_ci", name: "Wave", auth: "app_approval", fields: ["phone"], hint: "Open the Wave app and approve the payment." },
        ],
        extraScenarios: ["rejected", "wrong_number", "timeout"],
      },
      off("mpesa"), off("eft"), off("capitec_pay"), off("payattitude"),
      off("apple_pay"),
      googlePay(["XOF"]),
    ],
  },
  {
    code: "ZA", name: "South Africa", flag: "🇿🇦", currency: "ZAR", currencies: ["ZAR"], dialCode: "+27",
    phone: { digits: 9, pattern: /^[6-8]\d{8}$/, example: "82 000 0000" },
    channels: [
      card([["Visa", "supported"], ["Mastercard", "supported"], ["American Express", "experimental"]], ["ZAR"], 100),
      off("bank_transfer"), off("pay_with_bank"), off("ussd"),
      {
        channel: "qr", status: "supported", currencies: ["ZAR"],
        providers: [
          { id: "scan_to_pay", name: "Scan to Pay", auth: "qr_scan", hint: "Scan with a banking app that supports Scan to Pay." },
          { id: "snapscan", name: "SnapScan", auth: "qr_scan", hint: "Scan with the SnapScan app." },
        ],
      },
      off("mobile_money"), off("mpesa"),
      {
        channel: "eft", status: "supported", currencies: ["ZAR"],
        providers: [{ id: "instant_eft", name: "Instant EFT partner (simulated)", auth: "bank_redirect", fields: ["bank"] }],
        customerEligibility: "Needs online banking with a supported South African bank.",
      },
      {
        channel: "capitec_pay", status: "supported", currencies: ["ZAR"],
        providers: [{ id: "capitec", name: "Capitec Pay", auth: "app_approval", fields: ["identifier"], hint: "Approve the request in the Capitec app." }],
        extraScenarios: ["declined", "timeout", "cancelled"],
      },
      off("payattitude"),
      applePay("supported", ["ZAR"]),
      googlePay(["ZAR"]),
    ],
  },
];

export const EFT_DEMO_BANKS = ["Fynbos Demo Bank", "Karoo Demo Bank", "Protea Demo Bank"];
export const CAPITEC_IDENTIFIERS = [
  { id: "mobile", label: "Mobile number" },
  { id: "id_number", label: "SA ID number" },
  { id: "account", label: "Account number" },
] as const;

export const getCountry = (code: CountryCode) => COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0]!;
export const getEntry = (code: CountryCode, channel: ChannelId) =>
  getCountry(code).channels.find((e) => e.channel === channel) ?? off(channel);

export type EligibilityContext = {
  country: CountryCode;
  currency: CheckoutCurrency;
  amountMinor: number;
  device: DeviceId;
  walletReady: boolean;
};

export type Eligibility = { eligible: boolean; status: Availability; reason?: string };

/** Can this channel be offered to this customer right now? */
export function channelEligibility(channel: ChannelId, ctx: EligibilityContext): Eligibility {
  const e = getEntry(ctx.country, channel);
  const name = getCountry(ctx.country).name;
  if (e.status === "unavailable") return { eligible: false, status: e.status, reason: `${CHANNEL_INFO[channel].label} isn't available in ${name}.` };
  if (!e.currencies.includes(ctx.currency)) return { eligible: false, status: e.status, reason: `${CHANNEL_INFO[channel].label} doesn't accept ${ctx.currency} payments.` };
  if (e.minMinor != null && ctx.amountMinor < e.minMinor) return { eligible: false, status: e.status, reason: "The amount is below this method's minimum." };
  if (e.maxMinor != null && ctx.amountMinor > e.maxMinor) return { eligible: false, status: e.status, reason: "The amount is above this method's maximum." };
  if (e.devices && !e.devices.includes(ctx.device)) return { eligible: false, status: e.status, reason: "Not supported on this device or browser." };
  if (e.needsWallet && !ctx.walletReady) return { eligible: false, status: e.status, reason: "The customer has no eligible card in their wallet." };
  return { eligible: true, status: e.status };
}

/** Channels the merchant can switch on in this market (regardless of amount/device). */
export const configurableChannels = (country: CountryCode) =>
  CHANNEL_ORDER.filter((c) => getEntry(country, c).status !== "unavailable");

/** Default switched-on channels: everything confirmed, minus channels that need merchant activation. */
export const defaultChannels = (country: CountryCode): ChannelId[] =>
  configurableChannels(country).filter((c) => getEntry(country, c).status === "supported" && c !== "payattitude");

/** Methods the customer actually sees: switched on by the merchant AND eligible in this context. */
export const visibleChannels = (enabled: ChannelId[], ctx: EligibilityContext) =>
  CHANNEL_ORDER.filter((c) => enabled.includes(c) && channelEligibility(c, ctx).eligible);

/** Providers for a channel that aren't switched off in the registry. */
export const channelProviders = (country: CountryCode, channel: ChannelId) =>
  getEntry(country, channel).providers.filter((p) => p.status !== "unavailable");

/** Phone number check for the country (accepts spaces and a leading 0 or dial code). */
export function normalisePhone(country: CountryCode, raw: string) {
  const c = getCountry(country);
  let d = raw.replace(/[^\d+]/g, "");
  const dial = c.dialCode.replace("+", "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith(dial) && d.length > c.phone.digits) d = d.slice(dial.length);
  if (country !== "CI" && d.startsWith("0") && d.length === c.phone.digits + 1) d = d.slice(1);
  return d;
}
export function validatePhone(country: CountryCode, raw: string): string | null {
  if (!raw.trim()) return "Enter a phone number.";
  const c = getCountry(country);
  const d = normalisePhone(country, raw);
  if (d.length !== c.phone.digits || !c.phone.pattern.test(d)) return `Enter a valid ${c.name} number, like ${c.phone.example}.`;
  return null;
}
export const maskPhone = (country: CountryCode, raw: string) => {
  const d = normalisePhone(country, raw);
  return `${getCountry(country).dialCode} ••• ••• ${d.slice(-3)}`;
};
