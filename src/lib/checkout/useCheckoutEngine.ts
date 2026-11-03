/**
 * React driver for the checkout: owns one session, runs the simulated provider timers and
 * cleans every timer up on restart/unmount. Timers check the session and attempt they were
 * scheduled for, so a late timer can never touch a newer session or attempt.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { type CheckoutAdapter, demoAdapter, demoId } from "./adapter";
import { type CheckoutAction, type CheckoutSession, type Reconciliation, type SessionInput, checkoutReducer, currentAttempt } from "./machine";
import { formatMinor } from "./money";
import type { ChannelId } from "./registry";

export type Scenario = "success" | "failure" | "pending_success" | "pending_failure" | "manual" | "expired" | "cancelled" | "auth_required";
export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "success", label: "Automatic success" },
  { id: "failure", label: "Automatic failure" },
  { id: "pending_success", label: "Pending, then success" },
  { id: "pending_failure", label: "Pending, then failure" },
  { id: "manual", label: "Manual completion" },
  { id: "expired", label: "Expired payment" },
  { id: "cancelled", label: "Customer cancels" },
  { id: "auth_required", label: "Authentication required" },
];

export type EngineOptions = { scenario: Scenario; delayMs: number; sessionMinutes: number; windowMinutes: number; adapter?: CheckoutAdapter };
type Act = CheckoutAction extends infer A ? A extends { now: string; eventId: string } ? Omit<A, "now" | "eventId"> : never : never;

export function useCheckoutEngine(input: SessionInput, opts: EngineOptions) {
  const adapter = opts.adapter ?? demoAdapter;
  const ref = useRef<CheckoutSession | null>(null);
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const optsRef = useRef(opts); optsRef.current = opts;
  const inputRef = useRef(input); inputRef.current = input;
  const lastCallback = useRef<{ attemptId: string; callbackId: string; result: "succeeded" | "failed" | "pending" } | null>(null);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current.clear(); };

  const dispatch = useCallback((a: Act) => {
    if (!ref.current) return null;
    const next = checkoutReducer(ref.current, { ...a, now: new Date().toISOString(), eventId: demoId("ev", 8) } as CheckoutAction);
    ref.current = next;
    setSession(next);
    return next;
  }, []);

  /** Run fn later, but only if the same session (and attempt, when given) is still current. */
  const later = useCallback((ms: number, fn: () => void, attemptId?: string) => {
    const sid = ref.current?.id;
    const t = setTimeout(() => {
      timers.current.delete(t);
      const s = ref.current;
      if (!s || s.id !== sid) return;
      if (attemptId && s.currentAttemptId !== attemptId) return;
      fn();
    }, ms);
    timers.current.add(t);
  }, []);

  const callback = useCallback((result: "succeeded" | "failed" | "pending", extra: { reason?: string; reconciliation?: Reconciliation; attemptId?: string } = {}) => {
    const s = ref.current; const attemptId = extra.attemptId ?? s?.currentAttemptId;
    if (!s || !attemptId) return;
    const callbackId = demoId("cb", 8);
    lastCallback.current = { attemptId, callbackId, result };
    dispatch({ type: "CALLBACK", attemptId, callbackId, result, ...(extra.reason ? { reason: extra.reason } : {}), ...(extra.reconciliation ? { reconciliation: extra.reconciliation } : {}) });
  }, [dispatch]);

  const restart = useCallback(async () => {
    clear();
    lastCallback.current = null;
    const s = await adapter.createSession(inputRef.current, optsRef.current.sessionMinutes);
    ref.current = s; setSession(s);
    dispatch({ type: "OPEN" });
    const ms = new Date(s.expiresAt).getTime() - Date.now();
    later(ms, () => dispatch({ type: "EXPIRE" }));
  }, [adapter, dispatch, later]);

  useEffect(() => () => clear(), []);

  const DECLINE = "The payment was declined (simulated).";

  /** Simulated provider decision once the customer has done their part. */
  const resolve = useCallback((attemptId: string) => {
    const { scenario, delayMs: d } = optsRef.current;
    if (scenario === "failure") return later(d, () => callback("failed", { reason: DECLINE }), attemptId);
    if (scenario === "expired") return later(d, () => dispatch({ type: "EXPIRE" }), attemptId);
    if (scenario === "manual") return later(d, () => callback("pending"), attemptId);
    if (scenario === "pending_success" || scenario === "pending_failure") {
      return later(d, () => {
        callback("pending");
        later(d * 2, () => (scenario === "pending_success" ? callback("succeeded") : callback("failed", { reason: "The provider couldn't confirm the payment (simulated)." })), attemptId);
      }, attemptId);
    }
    later(d, () => callback("succeeded"), attemptId);
  }, [callback, dispatch, later]);

  const selectMethod = useCallback((channel: ChannelId, needsDetails: boolean) => dispatch({ type: "SELECT_METHOD", channel, needsDetails }), [dispatch]);

  /** Start a payment attempt. `outcome: "declined"` forces a decline (e.g. a test card). */
  const initiate = useCallback(async (req: { providerId: string; summary?: string; forceAuth?: boolean; authOverride?: string; declined?: boolean }) => {
    const s = ref.current;
    if (!s?.channel) return;
    const o = optsRef.current;
    const res = await adapter.initiatePayment(s, { channel: s.channel, providerId: req.providerId, ...(req.summary ? { summary: req.summary } : {}), forceAuth: !!req.forceAuth || o.scenario === "auth_required", windowMinutes: o.windowMinutes });
    const after = dispatch({ type: "INITIATE", attemptId: res.attemptId, reference: res.reference, provider: res.provider, ...(req.summary ? { summary: req.summary } : {}) });
    if (after?.currentAttemptId !== res.attemptId) return;
    const id = res.attemptId;
    later(Math.min(700, o.delayMs), () => {
      if (req.authOverride) return dispatch({ type: "REQUIRE_AUTH", attemptId: id, auth: req.authOverride });
      if (res.next.kind === "authorize") return dispatch({ type: "REQUIRE_AUTH", attemptId: id, auth: res.next.auth });
      if (res.next.kind === "await_payment") {
        dispatch({ type: "AWAIT_PAYMENT", attemptId: id, expiresAt: new Date(Date.now() + res.next.windowMinutes * 60_000).toISOString() });
        return;
      }
      if (o.scenario === "cancelled") return dispatch({ type: "CANCEL", reason: "Customer cancelled the payment (simulated)." });
      dispatch({ type: "AUTHORIZE", attemptId: id });
      if (req.declined) return later(o.delayMs, () => callback("failed", { reason: "Declined by the card issuer (simulated)." }), id);
      resolve(id);
    }, id);
  }, [adapter, callback, dispatch, later, resolve]);

  /** The customer finished their step (approved, entered a code, sent the money, came back from a redirect). */
  const complete = useCallback((opt: { via?: "customer" | "redirect_return"; declined?: boolean } = {}) => {
    const s = ref.current; const id = s?.currentAttemptId;
    if (!s || !id) return;
    if (optsRef.current.scenario === "cancelled") return dispatch({ type: "CANCEL", reason: "Customer cancelled the payment (simulated)." });
    dispatch({ type: "AUTHORIZE", attemptId: id, via: opt.via ?? "customer" });
    if (opt.declined) return later(optsRef.current.delayMs, () => callback("failed", { reason: "Declined by the card issuer (simulated)." }), id);
    resolve(id);
  }, [callback, dispatch, later, resolve]);

  const failAuth = useCallback((reason: string) => {
    const id = ref.current?.currentAttemptId;
    if (id) dispatch({ type: "AUTH_FAILED", attemptId: id, reason });
  }, [dispatch]);

  /** Simulated bank notification for transfers: exact, under, over, delayed, or after expiry. */
  const transferNotice = useCallback((kind: "exact" | "underpaid" | "overpaid" | "delayed" | "late") => {
    const s = ref.current; if (!s) return;
    const att = kind === "late" ? [...s.attempts].reverse().find((a) => a.channel === "bank_transfer") : currentAttempt(s);
    if (!att) return;
    const expected = s.amountMinor;
    const rec = (outcome: Reconciliation["outcome"], received: number, note: string): Reconciliation => ({ outcome, expectedMinor: expected, receivedMinor: received, note });
    const d = optsRef.current.delayMs;
    const f = (m: number) => formatMinor(m, s.currency);
    if (kind === "late") return callback("succeeded", { attemptId: att.id, reconciliation: rec("late", expected, "Money arrived after the account expired. Flagged for the merchant to refund — the payment is not marked paid.") });
    if (kind === "underpaid") {
      const got = Math.floor(expected * 0.6);
      return callback("pending", { reconciliation: rec("underpaid", got, `Received ${f(got)} of ${f(expected)}. Not marked paid — the customer must send ${f(expected - got)} more, or the merchant reviews it.`) });
    }
    if (kind === "overpaid") {
      const got = expected + Math.max(1, Math.floor(expected * 0.1));
      return callback("pending", { reconciliation: rec("overpaid", got, `Received ${f(got)} for a ${f(expected)} payment. Held for the merchant to confirm and refund the extra ${f(got - expected)}.`) });
    }
    dispatch({ type: "AUTHORIZE", attemptId: att.id });
    if (kind === "delayed") {
      return later(d, () => { callback("pending"); later(d * 3, () => callback("succeeded", { reconciliation: rec("matched", expected, "Exact amount received after a delay.") }), att.id); }, att.id);
    }
    later(d, () => callback("succeeded", { reconciliation: rec("matched", expected, "Exact amount received.") }), att.id);
  }, [callback, dispatch, later]);

  /** Re-send the last callback with the same id — the session must not change. */
  const duplicateCallback = useCallback(() => {
    const last = lastCallback.current; if (!last) return;
    dispatch({ type: "CALLBACK", attemptId: last.attemptId, callbackId: last.callbackId, result: last.result });
  }, [dispatch]);

  return {
    session,
    attempt: session ? currentAttempt(session) : null,
    hasCallback: !!lastCallback.current && !!session && session.attempts.some((a) => a.id === lastCallback.current?.attemptId),
    restart,
    selectMethod,
    initiate,
    complete,
    failAuth,
    callback,
    transferNotice,
    duplicateCallback,
    submitAuth: (data: Parameters<CheckoutAdapter["submitAuthorization"]>[1]): Promise<{ accepted: boolean; error?: string }> =>
      (ref.current ? adapter.submitAuthorization(ref.current, data) : Promise.resolve({ accepted: false })),
    expire: () => { if (dispatch({ type: "EXPIRE" })?.status === "EXPIRED") clear(); },
    cancel: (reason?: string) => { if (dispatch({ type: "CANCEL", ...(reason ? { reason } : {}) })?.status === "CANCELLED") clear(); },
    retry: (needsDetails: boolean) => dispatch({ type: "RETRY", needsDetails }),
    chooseAnother: () => dispatch({ type: "CHOOSE_ANOTHER" }),
  };
}

export type CheckoutEngine = ReturnType<typeof useCheckoutEngine>;
