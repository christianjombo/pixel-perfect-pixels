/**
 * Griv Checkout lifecycle. One checkout SESSION holds many payment ATTEMPTS. The reducer is pure
 * (ids and timestamps arrive in actions) and refuses invalid transitions, so e.g. an expired
 * session can never be marked paid and a repeated callback never creates a second success.
 */
import type { CheckoutCurrency } from "./money";
import type { ChannelId, CountryCode } from "./registry";

export type CheckoutStatus =
  | "CREATED" | "READY" | "METHOD_SELECTED" | "DETAILS_REQUIRED" | "INITIATING"
  | "AWAITING_AUTHORIZATION" | "AWAITING_PAYMENT" | "PROCESSING" | "PENDING"
  | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";

const T: Record<CheckoutStatus, CheckoutStatus[]> = {
  CREATED: ["READY", "EXPIRED", "CANCELLED"],
  READY: ["METHOD_SELECTED", "DETAILS_REQUIRED", "EXPIRED", "CANCELLED"],
  METHOD_SELECTED: ["METHOD_SELECTED", "DETAILS_REQUIRED", "INITIATING", "READY", "EXPIRED", "CANCELLED"],
  DETAILS_REQUIRED: ["METHOD_SELECTED", "DETAILS_REQUIRED", "INITIATING", "READY", "EXPIRED", "CANCELLED"],
  INITIATING: ["AWAITING_AUTHORIZATION", "AWAITING_PAYMENT", "PROCESSING", "FAILED", "EXPIRED", "CANCELLED"],
  AWAITING_AUTHORIZATION: ["PROCESSING", "PENDING", "FAILED", "EXPIRED", "CANCELLED", "METHOD_SELECTED", "DETAILS_REQUIRED"],
  AWAITING_PAYMENT: ["PROCESSING", "PENDING", "SUCCEEDED", "FAILED", "EXPIRED", "CANCELLED", "METHOD_SELECTED", "DETAILS_REQUIRED"],
  PROCESSING: ["PENDING", "SUCCEEDED", "FAILED", "EXPIRED"],
  PENDING: ["SUCCEEDED", "FAILED", "EXPIRED"],
  SUCCEEDED: [],
  FAILED: ["METHOD_SELECTED", "DETAILS_REQUIRED", "READY"],
  CANCELLED: [],
  EXPIRED: [],
};

export const canTransition = (from: CheckoutStatus, to: CheckoutStatus) => T[from].includes(to);
export const isFinal = (s: CheckoutStatus) => s === "SUCCEEDED" || s === "CANCELLED" || s === "EXPIRED";
/** Customer may still change method without abandoning a submitted payment. */
export const canSwitchMethod = (s: CheckoutStatus) =>
  ["READY", "METHOD_SELECTED", "DETAILS_REQUIRED", "AWAITING_AUTHORIZATION", "AWAITING_PAYMENT", "FAILED"].includes(s);

export type AttemptStatus =
  | "initiated" | "awaiting_authorization" | "awaiting_payment" | "processing" | "pending"
  | "succeeded" | "failed" | "cancelled" | "expired" | "abandoned";

export type Reconciliation = {
  outcome: "matched" | "underpaid" | "overpaid" | "late";
  expectedMinor: number;
  receivedMinor: number;
  note: string;
};

export type PaymentAttempt = {
  id: string;
  reference: string;
  channel: ChannelId;
  provider: string;
  status: AttemptStatus;
  createdAt: string;
  updatedAt: string;
  /** What the customer must do to authorise (e.g. "otp", "stk_push"). */
  auth?: string;
  /** Safe description only, e.g. "Visa •••• 4242". Never full card or PIN data. */
  summary?: string;
  failureReason?: string;
  reconciliation?: Reconciliation;
  expiresAt?: string;
};

export type CheckoutEvent = {
  id: string;
  at: string;
  name: string;
  channel?: ChannelId;
  attemptRef?: string;
  result?: string;
};

export type SessionInput = {
  merchantId: string;
  merchantName: string;
  country: CountryCode;
  currency: CheckoutCurrency;
  amountMinor: number;
  description: string;
  customer: { name: string; email: string; phone: string };
  reference?: string;
  orderReference?: string;
  enabledChannels: ChannelId[];
};

export type CheckoutSession = SessionInput & {
  id: string;
  status: CheckoutStatus;
  channel: ChannelId | null;
  attempts: PaymentAttempt[];
  currentAttemptId: string | null;
  events: CheckoutEvent[];
  processedCallbacks: string[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  completedAt?: string;
};

export type CheckoutAction =
  | { type: "OPEN"; now: string; eventId: string }
  | { type: "SELECT_METHOD"; channel: ChannelId; needsDetails: boolean; now: string; eventId: string }
  | { type: "INITIATE"; attemptId: string; reference: string; provider: string; summary?: string; now: string; eventId: string }
  | { type: "REQUIRE_AUTH"; attemptId: string; auth: string; now: string; eventId: string }
  | { type: "AWAIT_PAYMENT"; attemptId: string; expiresAt?: string; now: string; eventId: string }
  | { type: "AUTHORIZE"; attemptId: string; via?: "customer" | "redirect_return"; now: string; eventId: string }
  | { type: "AUTH_FAILED"; attemptId: string; reason: string; now: string; eventId: string }
  | { type: "CALLBACK"; attemptId: string; callbackId: string; result: "succeeded" | "failed" | "pending"; reason?: string; reconciliation?: Reconciliation; now: string; eventId: string }
  | { type: "EXPIRE"; now: string; eventId: string }
  | { type: "CANCEL"; reason?: string; now: string; eventId: string }
  | { type: "RETRY"; needsDetails: boolean; now: string; eventId: string }
  | { type: "CHOOSE_ANOTHER"; now: string; eventId: string }
  | { type: "REPLACE"; session: CheckoutSession };

export function createSession(input: SessionInput, ids: { sessionId: string; eventId: string }, now: string, ttlMinutes = 30): CheckoutSession {
  return {
    ...input,
    id: ids.sessionId,
    status: "CREATED",
    channel: null,
    attempts: [],
    currentAttemptId: null,
    events: [{ id: ids.eventId, at: now, name: "checkout.created" }],
    processedCallbacks: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(new Date(now).getTime() + ttlMinutes * 60_000).toISOString(),
  };
}

export const currentAttempt = (s: CheckoutSession) => s.attempts.find((a) => a.id === s.currentAttemptId) ?? null;

const ATTEMPT_FOR: Partial<Record<CheckoutStatus, AttemptStatus>> = {
  INITIATING: "initiated", AWAITING_AUTHORIZATION: "awaiting_authorization", AWAITING_PAYMENT: "awaiting_payment",
  PROCESSING: "processing", PENDING: "pending", SUCCEEDED: "succeeded", FAILED: "failed", CANCELLED: "cancelled", EXPIRED: "expired",
};

function move(s: CheckoutSession, to: CheckoutStatus, now: string, event: Omit<CheckoutEvent, "at" | "channel" | "attemptRef"> & { attemptRef?: string }, patch: Partial<PaymentAttempt> = {}): CheckoutSession {
  if (!canTransition(s.status, to)) return s;
  const att = currentAttempt(s);
  const attStatus = ATTEMPT_FOR[to];
  const attempts = att && attStatus
    ? s.attempts.map((a) => (a.id === att.id ? { ...a, ...patch, status: attStatus, updatedAt: now } : a))
    : s.attempts;
  return {
    ...s,
    status: to,
    attempts,
    updatedAt: now,
    ...(isFinal(to) ? { completedAt: now } : {}),
    events: [...s.events, { ...event, at: now, ...(s.channel ? { channel: s.channel } : {}), ...(att ? { attemptRef: att.reference } : {}) }],
  };
}

const log = (s: CheckoutSession, now: string, e: Omit<CheckoutEvent, "at">): CheckoutSession =>
  ({ ...s, updatedAt: now, events: [...s.events, { ...e, at: now }] });

/** Mark the live attempt abandoned (method switch / choose another) so no stale details survive. */
function abandon(s: CheckoutSession, now: string): CheckoutSession {
  const att = currentAttempt(s);
  if (!att || ["succeeded", "failed", "cancelled", "expired"].includes(att.status)) return { ...s, currentAttemptId: null };
  return { ...s, currentAttemptId: null, attempts: s.attempts.map((a) => (a.id === att.id ? { ...a, status: "abandoned", updatedAt: now } : a)) };
}

export function checkoutReducer(s: CheckoutSession, a: CheckoutAction): CheckoutSession {
  if (a.type === "REPLACE") return a.session;
  const id = a.eventId;
  // Actions about a specific attempt are ignored once that attempt is no longer current.
  if ("attemptId" in a && a.type !== "CALLBACK" && a.attemptId !== s.currentAttemptId && a.type !== "INITIATE") return s;

  switch (a.type) {
    case "OPEN":
      return move(s, "READY", a.now, { id, name: "checkout.ready" });

    case "SELECT_METHOD": {
      const to = a.needsDetails ? "DETAILS_REQUIRED" : "METHOD_SELECTED";
      if (!canSwitchMethod(s.status) || !canTransition(s.status, to)) return s;
      const cleared = abandon(s, a.now);
      return { ...cleared, status: to, channel: a.channel, updatedAt: a.now,
        events: [...s.events, { id, at: a.now, name: "checkout.method_selected", channel: a.channel }] };
    }

    case "INITIATE": {
      if (!canTransition(s.status, "INITIATING") || !s.channel) return s;
      const att: PaymentAttempt = {
        id: a.attemptId, reference: a.reference, channel: s.channel, provider: a.provider, status: "initiated",
        createdAt: a.now, updatedAt: a.now, ...(a.summary ? { summary: a.summary } : {}),
      };
      return { ...s, status: "INITIATING", currentAttemptId: att.id, attempts: [...s.attempts, att], updatedAt: a.now,
        events: [...s.events, { id, at: a.now, name: "payment.initiated", channel: s.channel, attemptRef: att.reference }] };
    }

    case "REQUIRE_AUTH":
      return move(s, "AWAITING_AUTHORIZATION", a.now, { id, name: "payment.authorization_required", result: a.auth }, { auth: a.auth });

    case "AWAIT_PAYMENT":
      return move(s, "AWAITING_PAYMENT", a.now, { id, name: "payment.awaiting_payment" }, a.expiresAt ? { expiresAt: a.expiresAt } : {});

    case "AUTHORIZE":
      // Coming back from a redirect only means "check the result" — never success by itself.
      return move(s, "PROCESSING", a.now, { id, name: a.via === "redirect_return" ? "checkout.returned_from_redirect" : "payment.authorized" });

    case "AUTH_FAILED":
      return move(s, "FAILED", a.now, { id, name: "payment.failed", result: a.reason }, { failureReason: a.reason });

    case "CALLBACK": {
      const att = s.attempts.find((x) => x.id === a.attemptId);
      if (!att) return s;
      if (s.processedCallbacks.includes(a.callbackId) || (att.status === "succeeded" && a.result === "succeeded")) {
        return log(s, a.now, { id, name: "payment.duplicate_callback_ignored", channel: att.channel, attemptRef: att.reference, result: a.result });
      }
      if (a.attemptId !== s.currentAttemptId || isFinal(s.status)) {
        // Late money after expiry/cancel, or a callback for an old attempt: record it, change nothing.
        const late = a.result === "succeeded" && (s.status === "EXPIRED" || s.status === "CANCELLED");
        const withNote = late && a.reconciliation
          ? { ...s, attempts: s.attempts.map((x) => (x.id === att.id ? { ...x, reconciliation: a.reconciliation! } : x)) }
          : s;
        return log({ ...withNote, processedCallbacks: [...s.processedCallbacks, a.callbackId] }, a.now, {
          id, name: late ? "payment.late_payment_flagged" : "payment.stale_callback_ignored", channel: att.channel, attemptRef: att.reference, result: a.result,
        });
      }
      const to = a.result === "succeeded" ? "SUCCEEDED" : a.result === "failed" ? "FAILED" : "PENDING";
      if (!canTransition(s.status, to)) return s;
      const patch: Partial<PaymentAttempt> = {
        ...(a.reason ? { failureReason: a.reason } : {}),
        ...(a.reconciliation ? { reconciliation: a.reconciliation } : {}),
      };
      const next = move(s, to, a.now, { id, name: `payment.${a.result}`, ...(a.reason ? { result: a.reason } : {}) }, patch);
      return { ...next, processedCallbacks: [...next.processedCallbacks, a.callbackId] };
    }

    case "EXPIRE":
      return move(s, "EXPIRED", a.now, { id, name: "payment.expired" });

    case "CANCEL":
      return move(s, "CANCELLED", a.now, { id, name: "payment.cancelled", ...(a.reason ? { result: a.reason } : {}) });

    case "RETRY": {
      if (s.status !== "FAILED" || !s.channel) return s;
      const to = a.needsDetails ? "DETAILS_REQUIRED" : "METHOD_SELECTED";
      return { ...s, status: to, currentAttemptId: null, updatedAt: a.now,
        events: [...s.events, { id, at: a.now, name: "checkout.retry", channel: s.channel }] };
    }

    case "CHOOSE_ANOTHER": {
      if (!canSwitchMethod(s.status) || !canTransition(s.status, "READY")) return s;
      return { ...abandon(s, a.now), status: "READY", channel: null, updatedAt: a.now,
        events: [...s.events, { id, at: a.now, name: "checkout.choose_another_method" }] };
    }
  }
}

/** Griv demo webhook payload for the latest payment event (names are Griv's, not any provider's schema). */
export function webhookPayload(s: CheckoutSession) {
  const ev = [...s.events].reverse().find((e) => e.name.startsWith("payment."));
  if (!ev) return null;
  const att = s.attempts.find((a) => a.reference === ev.attemptRef) ?? currentAttempt(s);
  return {
    id: `evt_${ev.id}`,
    type: ev.name,
    created_at: ev.at,
    livemode: false,
    data: {
      session_id: s.id,
      payment_id: att?.id ?? null,
      merchant_id: s.merchantId,
      reference: att?.reference ?? s.reference ?? null,
      amount: s.amountMinor,
      currency: s.currency,
      status: att?.status ?? s.status.toLowerCase(),
      channel: att?.channel ?? s.channel,
      provider: att?.provider ?? null,
      ...(att?.failureReason ? { failure_reason: att.failureReason } : {}),
      ...(att?.reconciliation ? { reconciliation: att.reconciliation } : {}),
    },
  };
}

/** Session as shown in the inspector — no credentials exist in the session to begin with. */
export function inspectSession(s: CheckoutSession) {
  return {
    session_id: s.id,
    merchant_id: s.merchantId,
    status: s.status,
    customer: s.customer,
    amount_minor: s.amountMinor,
    currency: s.currency,
    country: s.country,
    reference: s.reference ?? null,
    order_reference: s.orderReference ?? null,
    enabled_channels: s.enabledChannels,
    selected_channel: s.channel,
    attempts: s.attempts,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    expires_at: s.expiresAt,
    completed_at: s.completedAt ?? null,
  };
}
