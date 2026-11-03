import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ExternalLink, ShieldCheck, Smartphone, Timer } from "lucide-react";
import { DEMO_OTP } from "@/lib/checkout/card";
import { cn } from "@/lib/utils";
import { DemoTag, Spinner } from "./parts";

/** Dashed box for buttons that act out what the customer (or their bank) would do. */
export function DemoActions({ title = "Simulate the customer's side", children }: { title?: string; children: ReactNode }) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-input p-3">
      <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><DemoTag>Demo</DemoTag>{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
export const demoBtn = "btn btn-outline h-8 px-3 text-xs";

export function StepTitle({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-semibold" tabIndex={-1} data-autofocus>{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

/** Ticking "mm:ss" countdown; calls onEnd once when time runs out. */
export function Countdown({ to, onEnd, label = "Expires in" }: { to: string; onEnd?: () => void; label?: string }) {
  const [now, setNow] = useState(() => Date.now());
  const ended = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, new Date(to).getTime() - now);
  useEffect(() => {
    if (left === 0 && !ended.current) { ended.current = true; onEnd?.(); }
  }, [left, onEnd]);
  const m = Math.floor(left / 60000); const s = Math.floor((left % 60000) / 1000);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium tnum", left < 60000 && "bg-warning/15 text-warning-foreground")}>
      <Timer className="h-3.5 w-3.5" />{label} {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

/** One-time code entry. Only demo codes are accepted; real codes must never be typed here. */
export function CodeStep({ title, description, label = "One-time code", length = 6, demoHint = `Use ${DEMO_OTP} in this demo.`, maxTries = 3, onSubmit, onTooMany, onCancel, submitLabel = "Confirm" }: {
  title: string; description?: ReactNode; label?: string; length?: number; demoHint?: string | undefined; maxTries?: number;
  onSubmit: (code: string) => Promise<string | null>; onTooMany: () => void; onCancel?: () => void; submitLabel?: string;
}) {
  const id = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const submit = async () => {
    setBusy(true);
    const err = await onSubmit(code);
    setBusy(false);
    if (!err) return;
    const n = tries + 1; setTries(n);
    if (n >= maxTries) return onTooMany();
    setError(`${err} ${maxTries - n} ${maxTries - n === 1 ? "try" : "tries"} left.`);
    setCode("");
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <StepTitle title={title} description={description} />
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <input id={id} ref={inputRef} className="field tnum tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={length}
        value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, length)); setError(null); }} aria-invalid={!!error} aria-describedby={`${id}-h`} />
      <p id={`${id}-h`} className={cn("mt-1.5 text-xs", error ? "font-medium text-destructive" : "text-muted-foreground")} role={error ? "alert" : undefined}>{error ?? demoHint}</p>
      <div className="mt-4 flex gap-2">
        <button type="submit" className="btn btn-primary h-10 flex-1" disabled={code.length < Math.min(length, 6) || busy}>{busy ? "Checking…" : submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className="btn btn-outline h-10">Cancel</button>}
      </div>
    </form>
  );
}

/** Simulated card-issuer authentication — inline challenge or a full redirect. */
export function ThreeDSStep({ mode, merchant, amount, cardLabel, onComplete, onFail, onCancel }: {
  mode: "challenge" | "redirect"; merchant: string; amount: string; cardLabel: string;
  onComplete: () => void; onFail: () => void; onCancel: () => void;
}) {
  const [stage, setStage] = useState<"intro" | "redirecting" | "issuer">(mode === "challenge" ? "issuer" : "intro");
  useEffect(() => {
    if (stage !== "redirecting") return;
    const t = setTimeout(() => setStage("issuer"), 900);
    return () => clearTimeout(t);
  }, [stage]);
  if (stage === "intro") {
    return (
      <div>
        <StepTitle title="Your bank needs to confirm this payment" description="You'll go to a page run by your card issuer, then come back here automatically." />
        <button className="btn btn-primary h-10 w-full" onClick={() => setStage("redirecting")}><ExternalLink className="h-4 w-4" />Continue to your bank</button>
        <button className="btn btn-ghost mt-2 h-9 w-full text-sm" onClick={onCancel}>Cancel payment</button>
      </div>
    );
  }
  if (stage === "redirecting") return <Spinner label="Opening your bank's secure page…" />;
  return (
    <div>
      <StepTitle title={mode === "challenge" ? "Confirm it's you" : "Back from your bank?"} description={mode === "redirect" ? "Coming back doesn't complete the payment — Griv still checks the result with the bank." : undefined} />
      <div className="rounded-xl border bg-muted/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Card issuer · 3-D Secure</span>
          <DemoTag>Simulated issuer page</DemoTag>
        </div>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Merchant</dt><dd className="font-medium">{merchant}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Amount</dt><dd className="font-medium tnum">{amount}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Card</dt><dd className="font-medium">{cardLabel}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">This is not a real bank screen. No password or PIN is requested.</p>
      </div>
      <DemoActions title="Simulate the issuer's answer">
        <button className={demoBtn} onClick={onComplete}>{mode === "redirect" ? "Approve & return to checkout" : "Complete authentication"}</button>
        <button className={demoBtn} onClick={onFail}>Fail authentication</button>
        <button className={demoBtn} onClick={onCancel}>Customer cancels</button>
      </DemoActions>
    </div>
  );
}

/** "Check your phone" / "approve in your app" step for push, STK and app approvals. */
export function DeviceApproval({ title, steps, detail, approveLabel = "Approve on phone", onApprove, onReject, onTimeout, onCancel, expiresAt, extra }: {
  title: string; steps: ReactNode[]; detail?: ReactNode; approveLabel?: string; extra?: ReactNode;
  onApprove: () => void; onReject: () => void; onTimeout: () => void; onCancel: () => void; expiresAt?: string;
}) {
  return (
    <div>
      <div className="mb-4 flex items-start gap-3">
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
          <Smartphone className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-primary motion-reduce:animate-none" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold" tabIndex={-1} data-autofocus>{title}</h3>
          {detail && <p className="mt-0.5 text-sm text-muted-foreground">{detail}</p>}
        </div>
      </div>
      <ol className="space-y-2 text-sm">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold">{i + 1}</span><span>{s}</span></li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status"><span className="h-2 w-2 animate-pulse rounded-full bg-warning motion-reduce:animate-none" />Waiting for approval…</p>
        {expiresAt && <Countdown to={expiresAt} onEnd={onTimeout} />}
      </div>
      <DemoActions>
        <button className={demoBtn} onClick={onApprove}>{approveLabel}</button>
        <button className={demoBtn} onClick={onReject}>Reject</button>
        <button className={demoBtn} onClick={onTimeout}>Let it time out</button>
        {extra}
      </DemoActions>
      <button className="btn btn-ghost mt-2 h-9 w-full text-sm" onClick={onCancel}>Cancel payment</button>
    </div>
  );
}

/** Clearly simulated wallet sheet. Deliberately not styled like an operating-system prompt. */
export function WalletSheet({ wallet, merchant, amount, card, onAuthorize, onFail, onCancel }: {
  wallet: string; merchant: string; amount: string; card: string; onAuthorize: () => void; onFail: () => void; onCancel: () => void;
}) {
  return (
    <div>
      <StepTitle title={`Confirm with ${wallet}`} />
      <div className="rounded-xl border-2 border-dashed border-input p-4">
        <div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold">{wallet}</span><DemoTag>Simulated wallet sheet</DemoTag></div>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Pay</dt><dd className="font-medium">{merchant}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Card</dt><dd className="font-medium">{card}</dd></div>
          <div className="flex justify-between border-t pt-1.5"><dt className="font-medium">Total</dt><dd className="font-semibold tnum">{amount}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">A real wallet confirms with the device's own security. Nothing is collected here.</p>
      </div>
      <DemoActions title="Simulate the wallet">
        <button className={demoBtn} onClick={onAuthorize}>Authorise</button>
        <button className={demoBtn} onClick={onFail}>Wallet declines</button>
        <button className={demoBtn} onClick={onCancel}>Dismiss sheet</button>
      </DemoActions>
    </div>
  );
}

/** Row with a value and copy button, used for account numbers, codes and references. */
export function CopyRow({ label, value, display, mono }: { label: string; value: string; display?: ReactNode; mono?: boolean }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1400); } catch { /* clipboard blocked: value is visible to copy by hand */ }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("truncate text-sm font-semibold", mono && "font-mono")}>{display ?? value}</p>
      </div>
      <button type="button" onClick={copy} className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-accent" aria-label={`Copy ${label}`}>{done ? "Copied" : "Copy"}</button>
    </div>
  );
}
