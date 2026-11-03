/**
 * Checkout money is held in integer minor units (kobo, pesewas, cents…) so totals never drift
 * through floating-point maths. XOF has no minor unit, so 1 XOF = 1 minor unit.
 */
export const CHECKOUT_CURRENCIES = ["NGN", "GHS", "KES", "XOF", "ZAR", "USD"] as const;
export type CheckoutCurrency = (typeof CHECKOUT_CURRENCIES)[number];

const META: Record<CheckoutCurrency, { decimals: number; symbol: string; name: string }> = {
  NGN: { decimals: 2, symbol: "₦", name: "Nigerian naira" },
  GHS: { decimals: 2, symbol: "GH₵", name: "Ghanaian cedi" },
  KES: { decimals: 2, symbol: "KSh ", name: "Kenyan shilling" },
  XOF: { decimals: 0, symbol: "CFA ", name: "West African CFA franc" },
  ZAR: { decimals: 2, symbol: "R ", name: "South African rand" },
  USD: { decimals: 2, symbol: "$", name: "US dollar" },
};

export const currencyDecimals = (c: CheckoutCurrency) => META[c].decimals;
export const currencyName = (c: CheckoutCurrency) => META[c].name;

/**
 * Parse what a person typed ("12,500.5") into minor units without floats.
 * Returns null when the text isn't a valid amount for the currency (e.g. decimals on XOF).
 */
export function parseToMinor(input: string, currency: CheckoutCurrency): number | null {
  const clean = input.replace(/[\s,]/g, "");
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const [whole = "0", frac = ""] = clean.split(".");
  const d = META[currency].decimals;
  if (frac.length > d) return null;
  const minor = Number(whole) * 10 ** d + Number((frac + "0".repeat(d)).slice(0, d) || "0");
  return Number.isSafeInteger(minor) ? minor : null;
}

/** "₦12,500.50" from 1250050 minor units. */
export function formatMinor(minor: number, currency: CheckoutCurrency) {
  const d = META[currency].decimals;
  const neg = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const whole = Math.floor(abs / 10 ** d);
  const frac = d ? String(abs % 10 ** d).padStart(d, "0") : "";
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "−" : ""}${META[currency].symbol}${grouped}${d ? "." + frac : ""}`;
}

/** Plain decimal text for inputs: 1250050 NGN → "12500.50". */
export function minorToInput(minor: number, currency: CheckoutCurrency) {
  const d = META[currency].decimals;
  if (!d) return String(minor);
  return `${Math.floor(minor / 10 ** d)}.${String(minor % 10 ** d).padStart(d, "0")}`;
}
