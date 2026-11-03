/**
 * The contract every future payment backend must meet. Griv Checkout only talks to this
 * interface, so it never needs to know which processor, bank or wallet sits behind it.
 * Only the in-browser demo adapter exists today — it calls no real endpoint and moves no money.
 */
import { DEMO_OTP } from "./card";
import { type CheckoutSession, type PaymentAttempt, type SessionInput, createSession, currentAttempt } from "./machine";
import { type AuthKind, type ChannelId, type EligibilityContext, CHANNEL_INFO, getEntry, visibleChannels } from "./registry";

export type InitiateRequest = { channel: ChannelId; providerId: string; summary?: string };
export type NextStep = { kind: "authorize"; auth: AuthKind | string } | { kind: "await_payment"; windowMinutes: number } | { kind: "process" };
export type InitiateResult = { attemptId: string; reference: string; provider: string; next: NextStep };
export type Receipt = {
  reference: string; amountMinor: number; currency: CheckoutSession["currency"]; merchant: string;
  method: string; provider: string; detail?: string; paidAt: string; sessionId: string;
};

export interface CheckoutAdapter {
  createSession(input: SessionInput, ttlMinutes: number): Promise<CheckoutSession>;
  getPaymentMethods(session: CheckoutSession, ctx: EligibilityContext): Promise<ChannelId[]>;
  initiatePayment(session: CheckoutSession, req: InitiateRequest & { forceAuth?: boolean; windowMinutes: number }): Promise<InitiateResult>;
  /** Only data a checkout may legitimately receive (OTPs from the demo, vouchers) — never PINs or passwords. */
  submitAuthorization(session: CheckoutSession, data: { otp?: string; voucher?: string; token?: string }): Promise<{ accepted: boolean; error?: string }>;
  checkStatus(session: CheckoutSession): Promise<PaymentAttempt["status"] | null>;
  cancelPayment(session: CheckoutSession): Promise<void>;
  retryPayment(session: CheckoutSession): Promise<void>;
  getReceipt(session: CheckoutSession): Promise<Receipt | null>;
}

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function demoId(prefix: string, len = 10) {
  let s = "";
  for (let i = 0; i < len; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return `${prefix}_${s.toLowerCase()}`;
}
export function demoReference() {
  let s = "";
  for (let i = 0; i < 8; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return `GRV-DEMO-${s}`;
}

export function buildReceipt(s: CheckoutSession): Receipt | null {
  const att = currentAttempt(s);
  if (s.status !== "SUCCEEDED" || !att) return null;
  return {
    reference: att.reference, amountMinor: s.amountMinor, currency: s.currency, merchant: s.merchantName,
    method: CHANNEL_INFO[att.channel].label, provider: att.provider, ...(att.summary ? { detail: att.summary } : {}),
    paidAt: s.completedAt ?? att.updatedAt, sessionId: s.id,
  };
}

/** Browser-only simulation. Nothing leaves the page. */
export const demoAdapter: CheckoutAdapter = {
  async createSession(input, ttl) {
    return createSession(input, { sessionId: demoId("cs_demo"), eventId: demoId("ev", 8) }, new Date().toISOString(), ttl);
  },
  async getPaymentMethods(session, ctx) {
    return visibleChannels(session.enabledChannels, ctx);
  },
  async initiatePayment(session, req) {
    const entry = getEntry(session.country, req.channel);
    const provider = entry.providers.find((p) => p.id === req.providerId) ?? entry.providers[0];
    const auth = provider?.auth ?? "card";
    const next: NextStep =
      auth === "transfer" || auth === "ussd_dial" || auth === "qr_scan" || auth === "till"
        ? { kind: "await_payment", windowMinutes: req.windowMinutes }
        : auth === "card" ? (req.forceAuth ? { kind: "authorize", auth: "otp" } : { kind: "process" })
        : { kind: "authorize", auth };
    return { attemptId: demoId("pa_demo"), reference: session.reference?.trim() || demoReference(), provider: provider?.name ?? "Demo provider", next };
  },
  async submitAuthorization(_s, data) {
    if (data.otp != null) return data.otp === DEMO_OTP ? { accepted: true } : { accepted: false, error: `That code isn't right. In this demo the code is ${DEMO_OTP}.` };
    if (data.voucher != null) return /^\d{6}$/.test(data.voucher) ? { accepted: true } : { accepted: false, error: "Vouchers are 6 digits." };
    if (data.token != null) return /^\d{6,8}$/.test(data.token) ? { accepted: true } : { accepted: false, error: "Token codes are 6 to 8 digits." };
    return { accepted: false, error: "Nothing to check." };
  },
  async checkStatus(s) { return currentAttempt(s)?.status ?? null; },
  async cancelPayment() {},
  async retryPayment() {},
  async getReceipt(s) { return buildReceipt(s); },
};
