import { describe, expect, it } from "vitest";
import { cardBehaviour, detectBrand, formatCardNumber, luhn, validateCard } from "@/lib/checkout/card";
import { configErrors, defaultConfig, switchCountry } from "@/lib/checkout/demo-config";
import { type CheckoutAction, type CheckoutSession, canTransition, checkoutReducer, createSession, webhookPayload } from "@/lib/checkout/machine";
import { formatMinor, parseToMinor } from "@/lib/checkout/money";
import { channelEligibility, configurableChannels, defaultChannels, validatePhone, visibleChannels, type EligibilityContext } from "@/lib/checkout/registry";

const ctx = (over: Partial<EligibilityContext> = {}): EligibilityContext => ({ country: "NG", currency: "NGN", amountMinor: 2_500_000, device: "iphone_safari", walletReady: true, ...over });

describe("country and channel eligibility", () => {
  it("offers USSD, bank transfer and pay-with-bank only in Nigeria", () => {
    for (const c of ["ussd", "pay_with_bank"] as const) {
      expect(channelEligibility(c, ctx()).eligible).toBe(true);
      expect(channelEligibility(c, ctx({ country: "GH", currency: "GHS" })).eligible).toBe(false);
    }
  });
  it("offers M-PESA only in Kenya and EFT / Capitec Pay only in South Africa", () => {
    expect(configurableChannels("KE")).toContain("mpesa");
    expect(configurableChannels("NG")).not.toContain("mpesa");
    expect(configurableChannels("ZA")).toEqual(expect.arrayContaining(["eft", "capitec_pay", "qr"]));
    expect(configurableChannels("GH")).not.toContain("eft");
  });
  it("in Nigeria, USD payments only offer card and Apple Pay", () => {
    const usd = visibleChannels(configurableChannels("NG"), ctx({ currency: "USD", amountMinor: 5000 }));
    expect(usd.sort()).toEqual(["apple_pay", "card"]);
  });
  it("hides Apple Pay off Apple devices or with an empty wallet, and Google Pay off Chrome", () => {
    expect(channelEligibility("apple_pay", ctx({ device: "android_chrome" })).eligible).toBe(false);
    expect(channelEligibility("apple_pay", ctx({ walletReady: false })).eligible).toBe(false);
    expect(channelEligibility("google_pay", ctx({ device: "iphone_safari" })).eligible).toBe(false);
    expect(channelEligibility("google_pay", ctx({ device: "android_chrome" })).status).toBe("experimental");
  });
  it("never switches on unverified or merchant-activated methods by default", () => {
    expect(defaultChannels("NG")).not.toContain("google_pay");
    expect(defaultChannels("NG")).not.toContain("payattitude");
    expect(defaultChannels("GH")).not.toContain("bank_transfer");
  });
  it("disabled channels are never shown, even when eligible", () => {
    expect(visibleChannels(["card"], ctx())).toEqual(["card"]);
  });
  it("respects channel amount limits", () => {
    expect(channelEligibility("bank_transfer", ctx({ amountMinor: 5000 })).eligible).toBe(false);
  });
});

describe("money in minor units", () => {
  it("parses without floating-point drift", () => {
    expect(parseToMinor("0.29", "NGN")).toBe(29);
    expect(parseToMinor("12,500.50", "NGN")).toBe(1_250_050);
    expect(parseToMinor("1.005", "NGN")).toBeNull();
  });
  it("XOF has no decimals", () => {
    expect(parseToMinor("15000", "XOF")).toBe(15000);
    expect(parseToMinor("15000.5", "XOF")).toBeNull();
    expect(formatMinor(15000, "XOF")).toBe("CFA 15,000");
  });
  it("formats each currency with its own symbol", () => {
    expect(formatMinor(2_500_000, "NGN")).toBe("₦25,000.00");
    expect(formatMinor(35000, "GHS")).toBe("GH₵350.00");
    expect(formatMinor(65000, "ZAR")).toBe("R 650.00");
  });
});

describe("input validation", () => {
  const now = new Date("2026-11-03T12:00:00Z");
  it("checks card number, brand, expiry and CVV", () => {
    expect(luhn("4242424242424242")).toBe(true);
    expect(luhn("4242424242424241")).toBe(false);
    expect(detectBrand("5061000000000005")).toBe("verve");
    expect(detectBrand("378282246310005")).toBe("amex");
    expect(formatCardNumber("378282246310005")).toBe("3782 822463 10005");
    expect(validateCard({ number: "4242 4242 4242 4242", expiry: "12/30", cvv: "123" }, now).valid).toBe(true);
    expect(validateCard({ number: "4242 4242 4242 4242", expiry: "10/26", cvv: "123" }, now).errors.expiry).toBe("This card has expired.");
    expect(validateCard({ number: "378282246310005", expiry: "12/30", cvv: "123" }, now).errors.cvv).toBeDefined();
  });
  it("test cards drive authentication, and 'authentication required' forces a code", () => {
    expect(cardBehaviour("4242424242424242", false)).toBe("frictionless");
    expect(cardBehaviour("4242424242424242", true)).toBe("otp");
    expect(cardBehaviour("4000000000000002", false)).toBe("declined");
  });
  it("validates local phone formats", () => {
    expect(validatePhone("NG", "0803 000 0000")).toBeNull();
    expect(validatePhone("NG", "+234 803 000 0000")).toBeNull();
    expect(validatePhone("KE", "0712 000 000")).toBeNull();
    expect(validatePhone("GH", "12345")).not.toBeNull();
  });
  it("demo config needs at least one usable method and a valid amount", () => {
    expect(configErrors({ ...defaultConfig(), enabled: [] }).errors.channels).toBeDefined();
    expect(configErrors({ ...defaultConfig(), amount: "abc" }).errors.amount).toBeDefined();
    const ci = switchCountry(defaultConfig(), "CI");
    expect(ci.currency).toBe("XOF");
    expect(configErrors(ci).valid).toBe(true);
  });
});

/* ---------- state machine ---------- */
let n = 0;
const t = () => new Date(Date.UTC(2026, 10, 3, 12, 0, n++)).toISOString();
const run = (s: CheckoutSession, ...actions: Omit<CheckoutAction, "now" | "eventId">[]) =>
  actions.reduce((acc, a) => checkoutReducer(acc, { ...a, now: t(), eventId: `e${n}` } as CheckoutAction), s);
const fresh = () => run(createSession({
  merchantId: "m1", merchantName: "Acme", country: "NG", currency: "NGN", amountMinor: 100000, description: "",
  customer: { name: "", email: "", phone: "" }, enabledChannels: ["card", "bank_transfer"],
}, { sessionId: "cs1", eventId: "e0" }, t()), { type: "OPEN" });
const paying = (channel: "card" | "bank_transfer" = "card", attemptId = "pa1") =>
  run(fresh(), { type: "SELECT_METHOD", channel, needsDetails: true }, { type: "INITIATE", attemptId, reference: `REF-${attemptId}`, provider: "Visa" });

describe("checkout state machine", () => {
  it("an expired session can never become successful", () => {
    const s = run(paying(), { type: "AUTHORIZE", attemptId: "pa1" }, { type: "EXPIRE" }, { type: "CALLBACK", attemptId: "pa1", callbackId: "c1", result: "succeeded" });
    expect(s.status).toBe("EXPIRED");
    expect(s.events.at(-1)?.name).toBe("payment.late_payment_flagged");
    expect(canTransition("EXPIRED", "SUCCEEDED")).toBe(false);
  });
  it("a repeated callback does not create a second success", () => {
    const s = run(paying(), { type: "AUTHORIZE", attemptId: "pa1" },
      { type: "CALLBACK", attemptId: "pa1", callbackId: "c1", result: "succeeded" },
      { type: "CALLBACK", attemptId: "pa1", callbackId: "c1", result: "succeeded" },
      { type: "CALLBACK", attemptId: "pa1", callbackId: "c2", result: "succeeded" });
    expect(s.status).toBe("SUCCEEDED");
    expect(s.events.filter((e) => e.name === "payment.succeeded")).toHaveLength(1);
    expect(s.events.filter((e) => e.name === "payment.duplicate_callback_ignored")).toHaveLength(2);
  });
  it("returning from a redirect only moves to processing, never to success", () => {
    const s = run(paying(), { type: "REQUIRE_AUTH", attemptId: "pa1", auth: "3ds_redirect" }, { type: "AUTHORIZE", attemptId: "pa1", via: "redirect_return" });
    expect(s.status).toBe("PROCESSING");
  });
  it("a failed attempt needs an explicit retry, and the retry is a new attempt", () => {
    let s = run(paying(), { type: "AUTHORIZE", attemptId: "pa1" }, { type: "CALLBACK", attemptId: "pa1", callbackId: "c1", result: "failed", reason: "Declined" });
    expect(s.status).toBe("FAILED");
    expect(run(s, { type: "INITIATE", attemptId: "pa2", reference: "R2", provider: "Visa" }).status).toBe("FAILED");
    s = run(s, { type: "RETRY", needsDetails: true }, { type: "INITIATE", attemptId: "pa2", reference: "R2", provider: "Visa" });
    expect(s.status).toBe("INITIATING");
    expect(s.attempts.map((a) => a.id)).toEqual(["pa1", "pa2"]);
    expect(s.attempts[0]?.status).toBe("failed");
  });
  it("switching method abandons the waiting attempt and ignores its late actions", () => {
    let s = run(paying("bank_transfer"), { type: "AWAIT_PAYMENT", attemptId: "pa1" }, { type: "SELECT_METHOD", channel: "card", needsDetails: true });
    expect(s.status).toBe("DETAILS_REQUIRED");
    expect(s.currentAttemptId).toBeNull();
    expect(s.attempts[0]?.status).toBe("abandoned");
    s = run(s, { type: "AUTHORIZE", attemptId: "pa1" });
    expect(s.status).toBe("DETAILS_REQUIRED");
  });
  it("cannot switch method once the payment is processing", () => {
    const s = run(paying(), { type: "AUTHORIZE", attemptId: "pa1" }, { type: "SELECT_METHOD", channel: "bank_transfer", needsDetails: false });
    expect(s.status).toBe("PROCESSING");
    expect(s.channel).toBe("card");
  });
  it("authentication failure fails the attempt with its reason", () => {
    const s = run(paying(), { type: "REQUIRE_AUTH", attemptId: "pa1", auth: "otp" }, { type: "AUTH_FAILED", attemptId: "pa1", reason: "Too many wrong codes" });
    expect(s.status).toBe("FAILED");
    expect(s.attempts[0]?.failureReason).toBe("Too many wrong codes");
  });
  it("underpaid transfers stay pending, never successful", () => {
    const s = run(paying("bank_transfer"), { type: "AWAIT_PAYMENT", attemptId: "pa1" },
      { type: "CALLBACK", attemptId: "pa1", callbackId: "c1", result: "pending", reconciliation: { outcome: "underpaid", expectedMinor: 100000, receivedMinor: 60000, note: "" } });
    expect(s.status).toBe("PENDING");
    expect(webhookPayload(s)?.data.reconciliation?.outcome).toBe("underpaid");
  });
  it("a reset replaces the session entirely", () => {
    const other = fresh();
    expect(checkoutReducer(paying(), { type: "REPLACE", session: other })).toBe(other);
  });
});
