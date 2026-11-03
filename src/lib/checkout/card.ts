/**
 * Card checks for the demo form. Card numbers and CVVs only ever live in component state while
 * typing; they are never stored, logged or sent anywhere. A production build must collect cards
 * through a PCI-compliant hosted field or provider tokenisation instead.
 */
export type CardBrand = "visa" | "mastercard" | "verve" | "amex" | "unknown";

export const BRAND_LABEL: Record<CardBrand, string> = {
  visa: "Visa", mastercard: "Mastercard", verve: "Verve", amex: "American Express", unknown: "Card",
};

export function detectBrand(raw: string): CardBrand {
  const n = raw.replace(/\D/g, "");
  if (/^(5060|5061|5078|5079|6500)/.test(n)) return "verve";
  if (/^3[47]/.test(n)) return "amex";
  if (/^4/.test(n)) return "visa";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return "mastercard";
  return "unknown";
}

export const cardLengths = (b: CardBrand) => (b === "amex" ? [15] : b === "verve" ? [16, 18, 19] : [16]);
export const cvvLength = (b: CardBrand) => (b === "amex" ? 4 : 3);

export function luhn(raw: string) {
  const n = raw.replace(/\D/g, "");
  if (n.length < 12) return false;
  let sum = 0;
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

/** "4242 4242 4242 4242" or Amex "3782 822463 10005". */
export function formatCardNumber(raw: string) {
  const n = raw.replace(/\D/g, "").slice(0, 19);
  if (detectBrand(n) === "amex") return [n.slice(0, 4), n.slice(4, 10), n.slice(10, 15)].filter(Boolean).join(" ");
  return n.replace(/(.{4})/g, "$1 ").trim();
}

export function formatExpiry(raw: string) {
  const n = raw.replace(/\D/g, "").slice(0, 4);
  return n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n;
}

export function validateCard(input: { number: string; expiry: string; cvv: string }, now: Date) {
  const errors: Partial<Record<"number" | "expiry" | "cvv", string>> = {};
  const n = input.number.replace(/\D/g, "");
  const brand = detectBrand(n);
  if (!n) errors.number = "Enter your card number.";
  else if (!cardLengths(brand).includes(n.length) || !luhn(n)) errors.number = "This card number isn't valid.";
  const m = /^(\d{2})\/(\d{2})$/.exec(input.expiry);
  if (!m) errors.expiry = "Use MM/YY.";
  else {
    const month = Number(m[1]); const year = 2000 + Number(m[2]);
    if (month < 1 || month > 12) errors.expiry = "Month must be 01–12.";
    else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) errors.expiry = "This card has expired.";
  }
  if (!new RegExp(`^\\d{${cvvLength(brand)}}$`).test(input.cvv)) errors.cvv = `Enter the ${cvvLength(brand)}-digit security code.`;
  return { brand, errors, valid: Object.keys(errors).length === 0 };
}

export type CardBehaviour = "frictionless" | "otp" | "3ds_challenge" | "3ds_redirect" | "declined" | "auth_failed";

/** Fictional test cards. They only work in this demo. */
export const TEST_CARDS: { number: string; brand: CardBrand; behaviour: CardBehaviour; label: string }[] = [
  { number: "4242424242424242", brand: "visa", behaviour: "frictionless", label: "Approves without extra checks" },
  { number: "5555555555554444", brand: "mastercard", behaviour: "otp", label: "Asks for a one-time code" },
  { number: "5061000000000005", brand: "verve", behaviour: "otp", label: "Verve · asks for a one-time code" },
  { number: "4000000000003220", brand: "visa", behaviour: "3ds_challenge", label: "3-D Secure challenge" },
  { number: "378282246310005", brand: "amex", behaviour: "3ds_redirect", label: "3-D Secure redirect" },
  { number: "4000000000000069", brand: "visa", behaviour: "auth_failed", label: "Authentication fails" },
  { number: "4000000000000002", brand: "visa", behaviour: "declined", label: "Declined by the bank" },
];

export const DEMO_OTP = "123456";

export function cardBehaviour(number: string, forceAuth: boolean): CardBehaviour {
  const n = number.replace(/\D/g, "");
  const hit = TEST_CARDS.find((c) => c.number === n)?.behaviour ?? "frictionless";
  return hit === "frictionless" && forceAuth ? "otp" : hit;
}

export const last4 = (number: string) => number.replace(/\D/g, "").slice(-4);
