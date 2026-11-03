import { useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, CreditCard } from "lucide-react";
import {
  BRAND_LABEL, TEST_CARDS, cardBehaviour, detectBrand, formatCardNumber, formatExpiry, last4, validateCard, type CardBrand,
} from "@/lib/checkout/card";
import type { CheckoutSession } from "@/lib/checkout/machine";
import { formatMinor, minorToInput } from "@/lib/checkout/money";
import { type Country, type DeviceId, channelProviders } from "@/lib/checkout/registry";
import type { CheckoutEngine } from "@/lib/checkout/useCheckoutEngine";
import { cn } from "@/lib/utils";
import { CodeStep, CopyRow, Countdown, DemoActions, DeviceApproval, StepTitle, ThreeDSStep, demoBtn } from "./auth";
import { DemoTag, Spinner } from "./parts";

export type FlowProps = { engine: CheckoutEngine; session: CheckoutSession; country: Country; device: DeviceId };

export const amountOf = (s: CheckoutSession) => formatMinor(s.amountMinor, s.currency);
const BRAND_ID: Record<CardBrand, string> = { visa: "visa", mastercard: "mastercard", verve: "verve", amex: "american_express", unknown: "" };

export function FieldBox({ label, error, hint, children, htmlFor }: { label: string; error?: string | undefined; hint?: string | undefined; children: React.ReactNode; htmlFor: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs font-medium text-destructive" role="alert">{error}</p> : hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Shared provider/bank picker. */
export function ProviderSelect({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: { id: string; name: string; note?: string | undefined }[] }) {
  return (
    <FieldBox label={label} htmlFor={id}>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>Choose…</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}{o.note ? ` — ${o.note}` : ""}</option>)}
      </select>
    </FieldBox>
  );
}

/* ---------------- Card ---------------- */
export function CardPaymentForm({ engine, session, country }: FlowProps) {
  const ids = { n: useId(), e: useId(), c: useId(), h: useId() };
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [holder, setHolder] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const att = engine.attempt;
  const providers = channelProviders(country.code, "card");
  const v = validateCard({ number, expiry, cvv }, new Date());
  const brand = detectBrand(number);
  const accepted = brand === "unknown" || providers.some((p) => p.id === BRAND_ID[brand]);
  const needHolder = session.currency === "USD";
  const holderErr = needHolder && !holder.trim() ? "Enter the name on the card." : undefined;
  const brandErr = !accepted && number.replace(/\D/g, "").length >= 4 ? `${BRAND_LABEL[brand]} cards aren't accepted for ${country.name} payments.` : undefined;
  const ready = v.valid && accepted && !holderErr;
  const amount = amountOf(session);

  if (session.status === "INITIATING") return <Spinner label="Contacting your card issuer…" />;
  if (session.status === "AWAITING_AUTHORIZATION" && att) {
    const cardLabel = att.summary ?? "Card";
    if (att.auth === "3ds_challenge" || att.auth === "3ds_redirect") {
      return <ThreeDSStep mode={att.auth === "3ds_challenge" ? "challenge" : "redirect"} merchant={session.merchantName} amount={amount} cardLabel={cardLabel}
        onComplete={() => engine.complete({ via: att.auth === "3ds_redirect" ? "redirect_return" : "customer" })}
        onFail={() => engine.failAuth("Your bank couldn't confirm it was you (simulated).")}
        onCancel={() => engine.cancel("Customer cancelled during card authentication (simulated).")} />;
    }
    const failing = att.auth === "otp_fail";
    return <CodeStep title="Enter the code your bank sent" description={`Your bank texted a one-time code for ${cardLabel}.`}
      onSubmit={async (code) => {
        if (failing) { engine.failAuth("Card authentication failed (simulated)."); return null; }
        const r = await engine.submitAuth({ otp: code });
        if (r.accepted) { engine.complete(); return null; }
        return r.error ?? "That code isn't right.";
      }}
      onTooMany={() => engine.failAuth("Too many wrong codes. Card authentication failed.")}
      onCancel={() => engine.cancel("Customer cancelled at the one-time code step (simulated).")} />;
  }

  const pay = () => {
    setTouched({ n: true, e: true, c: true, h: true });
    if (!ready) return;
    const behaviour = cardBehaviour(number, false);
    const override = behaviour === "otp" || behaviour === "3ds_challenge" || behaviour === "3ds_redirect" ? behaviour : behaviour === "auth_failed" ? "otp_fail" : undefined;
    const summary = `${BRAND_LABEL[brand]} •••• ${last4(number)}`;
    // Card details stop here: only the brand and last four digits go into the attempt.
    setNumber(""); setCvv("");
    void engine.initiate({ providerId: BRAND_ID[brand] || "visa", summary, ...(override ? { authOverride: override } : {}), declined: behaviour === "declined" });
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); pay(); }} noValidate>
      <div className="space-y-3">
        <FieldBox label="Card number" htmlFor={ids.n} error={touched.n ? brandErr ?? v.errors.number : brandErr}>
          <div className="relative">
            <input id={ids.n} className="field pr-24 tnum" inputMode="numeric" autoComplete="off" placeholder="0000 0000 0000 0000"
              value={number} onChange={(e) => setNumber(formatCardNumber(e.target.value))} onBlur={() => setTouched((t) => ({ ...t, n: true }))} aria-invalid={!!(touched.n && (v.errors.number || brandErr))} />
            <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs font-semibold text-muted-foreground">
              <CreditCard className="h-4 w-4" />{brand !== "unknown" ? BRAND_LABEL[brand] : ""}
            </span>
          </div>
        </FieldBox>
        <div className="grid grid-cols-2 gap-3">
          <FieldBox label="Expiry" htmlFor={ids.e} error={touched.e ? v.errors.expiry : undefined}>
            <input id={ids.e} className="field tnum" inputMode="numeric" autoComplete="off" placeholder="MM/YY" value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))} onBlur={() => setTouched((t) => ({ ...t, e: true }))} />
          </FieldBox>
          <FieldBox label="Security code" htmlFor={ids.c} error={touched.c ? v.errors.cvv : undefined}>
            <input id={ids.c} className="field tnum" inputMode="numeric" autoComplete="off" placeholder={brand === "amex" ? "4 digits" : "3 digits"} type="password"
              value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} onBlur={() => setTouched((t) => ({ ...t, c: true }))} />
          </FieldBox>
        </div>
        {needHolder && (
          <FieldBox label="Name on card" htmlFor={ids.h} error={touched.h ? holderErr : undefined} hint="Needed for international (USD) card payments.">
            <input id={ids.h} className="field" autoComplete="off" value={holder} onChange={(e) => setHolder(e.target.value)} />
          </FieldBox>
        )}
      </div>
      <button type="submit" className="btn btn-primary mt-4 h-11 w-full" disabled={!ready}>Pay {amount}</button>
      <details className="group mt-4 rounded-lg border border-dashed border-input">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-2"><DemoTag>Demo</DemoTag>Fictional test cards</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <ul className="divide-y border-t text-xs">
          {TEST_CARDS.filter((c) => providers.some((p) => p.id === BRAND_ID[c.brand])).map((c) => (
            <li key={c.number}>
              <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted"
                onClick={() => { setNumber(formatCardNumber(c.number)); setExpiry("12/30"); setCvv(c.brand === "amex" ? "1234" : "123"); if (needHolder) setHolder(session.customer.name); }}>
                <span className="font-mono">{formatCardNumber(c.number)}</span><span className="text-muted-foreground">{c.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </details>
    </form>
  );
}

/* ---------------- Bank transfer ---------------- */
const demoAccount = (attemptId: string) => {
  const digits = attemptId.replace(/\D/g, "").padEnd(8, "4").slice(0, 8);
  return `DEMO-${digits.slice(0, 4)}-${digits.slice(4, 8)}`;
};

export function BankTransferInstructions({ engine, session }: FlowProps) {
  const att = engine.attempt;
  if (session.status === "INITIATING") return <Spinner label="Creating a one-time account…" />;
  if (session.status === "AWAITING_PAYMENT" && att) {
    const acct = demoAccount(att.id);
    return (
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold" tabIndex={-1} data-autofocus>Transfer {amountOf(session)}</h3>
          {att.expiresAt && <Countdown to={att.expiresAt} onEnd={() => engine.expire()} />}
        </div>
        <p className="mb-3 text-sm text-muted-foreground">Send the exact amount to this account from your banking app. It's for this payment only.</p>
        <div className="divide-y rounded-lg border px-3">
          <CopyRow label="Bank" value={att.provider} />
          <CopyRow label="Account name" value={`Griv Demo / ${session.merchantName}`} />
          <CopyRow label="Account number" value={acct} mono display={<span className="flex items-center gap-2">{acct}<DemoTag>Not a real account</DemoTag></span>} />
          <CopyRow label="Exact amount" value={minorToInput(session.amountMinor, session.currency)} display={amountOf(session)} />
          <CopyRow label="Reference" value={att.reference} mono />
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground" role="status"><span className="h-2 w-2 animate-pulse rounded-full bg-warning motion-reduce:animate-none" />Waiting for your transfer…</p>
        <button className="btn btn-primary mt-3 h-11 w-full" onClick={() => engine.complete()}>I've sent the money</button>
        <DemoActions title="Simulate the bank's notification">
          <button className={demoBtn} onClick={() => engine.transferNotice("exact")}>Exact amount arrives</button>
          <button className={demoBtn} onClick={() => engine.transferNotice("underpaid")}>Customer underpays</button>
          <button className={demoBtn} onClick={() => engine.transferNotice("overpaid")}>Customer overpays</button>
          <button className={demoBtn} onClick={() => engine.transferNotice("delayed")}>Confirmation delayed</button>
        </DemoActions>
      </div>
    );
  }
  return (
    <div>
      <StepTitle title="Pay by bank transfer" description="We'll give you a one-time account number. Transfer from any bank app and we'll confirm automatically." />
      <button className="btn btn-primary h-11 w-full" onClick={() => void engine.initiate({ providerId: "griv_demo_settlement" })}>Get account details</button>
    </div>
  );
}

/* ---------------- Pay with bank ---------------- */
export function BankPaymentForm({ engine, session, country }: FlowProps) {
  const ids = { b: useId(), a: useId(), d: useId() };
  const banks = channelProviders(country.code, "pay_with_bank");
  const [bankId, setBankId] = useState("");
  const [acct, setAcct] = useState("");
  const [dob, setDob] = useState("");
  const [tried, setTried] = useState(false);
  const bank = banks.find((b) => b.id === bankId);
  const att = engine.attempt;
  const needDob = !!bank?.fields?.includes("dob");
  const errs = {
    bank: !bank ? "Choose your bank." : undefined,
    acct: !/^\d{10}$/.test(acct) ? "Account numbers are 10 digits." : undefined,
    dob: needDob && !dob ? "Enter your date of birth." : undefined,
  };
  const ok = !errs.bank && !errs.acct && !errs.dob;

  if (session.status === "INITIATING") return <Spinner label={`Connecting to ${bank?.name ?? "your bank"}…`} />;
  if (session.status === "AWAITING_AUTHORIZATION" && att) {
    if (att.auth === "app_approval") {
      return <DeviceApproval title={`Approve in your ${att.provider} app`} detail={`${amountOf(session)} to ${session.merchantName}`}
        steps={["Open your bank app on your phone.", "Find the payment request from Griv Checkout.", "Approve it. Never share your banking password."]}
        approveLabel="Approve in bank app" expiresAt={new Date(new Date(att.updatedAt).getTime() + 3 * 60_000).toISOString()}
        onApprove={() => engine.complete()} onReject={() => engine.failAuth("You declined the request in your bank app (simulated).")}
        onTimeout={() => engine.failAuth("The bank approval request expired (simulated).")} onCancel={() => engine.cancel("Customer cancelled at bank approval (simulated).")} />;
    }
    const token = att.auth === "token";
    return <CodeStep title={token ? "Enter your token code" : `Enter the code from ${att.provider}`}
      description={token ? "Use the code shown on your bank's hardware or soft token." : "Your bank sent a one-time code to the phone linked to this account."}
      label={token ? "Token code" : "One-time code"} length={token ? 8 : 6} demoHint={token ? "Any 6–8 digits work in this demo." : undefined}
      onSubmit={async (code) => {
        const r = await engine.submitAuth(token ? { token: code } : { otp: code });
        if (r.accepted) { engine.complete(); return null; }
        return r.error ?? "That code isn't right.";
      }}
      onTooMany={() => engine.failAuth("Too many wrong codes. Bank authorisation failed.")}
      onCancel={() => engine.cancel("Customer cancelled at bank authorisation (simulated).")} />;
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); setTried(true); if (ok && bank) void engine.initiate({ providerId: bank.id, summary: `${bank.name} ••••${acct.slice(-4)}` }); }} noValidate>
      <div className="space-y-3">
        <ProviderSelect id={ids.b} label="Your bank" value={bankId} onChange={setBankId} options={banks} />
        {tried && errs.bank && <p className="-mt-2 text-xs font-medium text-destructive" role="alert">{errs.bank}</p>}
        {bank?.hint && <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{bank.hint}</p>}
        <FieldBox label="Account number" htmlFor={ids.a} error={tried ? errs.acct : undefined} hint="Use any 10 digits — this demo doesn't check real accounts.">
          <input id={ids.a} className="field tnum" inputMode="numeric" autoComplete="off" maxLength={10} value={acct} onChange={(e) => setAcct(e.target.value.replace(/\D/g, "").slice(0, 10))} />
        </FieldBox>
        {needDob && (
          <FieldBox label="Date of birth" htmlFor={ids.d} error={tried ? errs.dob : undefined}>
            <input id={ids.d} type="date" className="field" value={dob} onChange={(e) => setDob(e.target.value)} />
          </FieldBox>
        )}
      </div>
      <button type="submit" className="btn btn-primary mt-4 h-11 w-full">Continue</button>
      <p className="mt-2 text-center text-xs text-muted-foreground">Griv never asks for your internet banking password.</p>
    </form>
  );
}

/* ---------------- USSD ---------------- */
export function USSDInstructions({ engine, session, country }: FlowProps) {
  const id = useId();
  const banks = channelProviders(country.code, "ussd");
  const [bankId, setBankId] = useState("");
  const bank = banks.find((b) => b.id === bankId);
  const att = engine.attempt;
  if (session.status === "INITIATING") return <Spinner label="Generating your code…" />;
  if (session.status === "AWAITING_PAYMENT" && att) {
    const base = banks.find((b) => b.name === att.provider)?.demoCode ?? "*000*000";
    const code = `${base}*${att.reference.slice(-4).replace(/\D/g, "7").padStart(4, "1")}#`;
    return (
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold" tabIndex={-1} data-autofocus>Dial this code</h3>
          {att.expiresAt && <Countdown to={att.expiresAt} onEnd={() => engine.expire()} />}
        </div>
        <p className="text-sm text-muted-foreground">On the phone number registered with {att.provider}, dial:</p>
        <div className="my-3 rounded-xl bg-blackwood px-4 py-5 text-center">
          <p className="font-mono text-2xl font-semibold tracking-wider text-blackwood-foreground">{code}</p>
          <p className="mt-1 text-[11px] text-blackwood-foreground/70">Demo code — it won't work on a real phone</p>
        </div>
        <div className="rounded-lg border px-3"><CopyRow label="USSD code" value={code} mono /></div>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground" role="status"><span className="h-2 w-2 animate-pulse rounded-full bg-warning motion-reduce:animate-none" />Waiting for payment…</p>
        <button className="btn btn-primary mt-3 h-11 w-full" onClick={() => engine.complete()}>I've dialled and approved</button>
        <button className="btn btn-ghost mt-2 h-9 w-full text-sm" onClick={() => engine.cancel("Customer cancelled the USSD payment (simulated).")}>Cancel payment</button>
      </div>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (bank) void engine.initiate({ providerId: bank.id, summary: `${bank.name} USSD` }); }}>
      <StepTitle title="Pay with USSD" description="Works on any phone, no internet needed." />
      <ProviderSelect id={id} label="Your bank" value={bankId} onChange={setBankId} options={banks} />
      <button type="submit" className="btn btn-primary mt-4 h-11 w-full" disabled={!bank}>Get code</button>
    </form>
  );
}

/* ---------------- QR ---------------- */
export function QRPaymentView({ engine, session, country }: FlowProps) {
  const id = useId();
  const providers = channelProviders(country.code, "qr");
  const [providerId, setProviderId] = useState(providers.length === 1 ? providers[0]!.id : "");
  const [qr, setQr] = useState<string | null>(null);
  const att = engine.attempt;
  const payload = useMemo(() => (att ? `GRIV-DEMO-QR|NOT-PAYABLE|session=${session.id}|ref=${att.reference}` : ""), [att, session.id]);
  useEffect(() => {
    if (!payload || session.status !== "AWAITING_PAYMENT") return;
    let alive = true;
    void import("qrcode").then((Q) => Q.toDataURL(payload, { margin: 1, width: 320 })).then((d) => { if (alive) setQr(d); });
    return () => { alive = false; };
  }, [payload, session.status]);
  const provider = providers.find((p) => p.id === providerId);

  if (session.status === "INITIATING") return <Spinner label="Creating your QR code…" />;
  if (session.status === "AWAITING_PAYMENT" && att) {
    const hint = providers.find((p) => p.name === att.provider)?.hint;
    return (
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold" tabIndex={-1} data-autofocus>Scan to pay {amountOf(session)}</h3>
          {att.expiresAt && <Countdown to={att.expiresAt} onEnd={() => engine.expire()} />}
        </div>
        <div className="mx-auto w-fit rounded-xl border p-3 text-center">
          {qr ? <img src={qr} alt="Demo QR code. It is not payable." className="h-44 w-44" /> : <div className="h-44 w-44 animate-pulse rounded bg-muted" />}
          <p className="mt-2 text-xs font-semibold text-primary">Demo QR — Not payable</p>
        </div>
        <p className="mt-3 text-center text-sm text-muted-foreground">{session.merchantName} · {att.provider}</p>
        {hint && <p className="mt-1 text-center text-xs text-muted-foreground">{hint}</p>}
        <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground" role="status"><span className="h-2 w-2 animate-pulse rounded-full bg-warning motion-reduce:animate-none" />Waiting for payment…</p>
        <DemoActions>
          <button className={demoBtn} onClick={() => engine.complete()}>Scan & pay in app</button>
          <button className={demoBtn} onClick={() => engine.cancel("Customer abandoned the QR payment (simulated).")}>Customer gives up</button>
        </DemoActions>
      </div>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (provider) void engine.initiate({ providerId: provider.id, summary: provider.name }); }}>
      <StepTitle title="Pay with a QR code" description="Scan the code with a supported banking or wallet app." />
      {providers.length > 1 && <ProviderSelect id={id} label="Pay with" value={providerId} onChange={setProviderId} options={providers} />}
      <button type="submit" className={cn("btn btn-primary h-11 w-full", providers.length > 1 && "mt-4")} disabled={!provider}>Show QR code</button>
    </form>
  );
}
