import { useEffect, useId, useState } from "react";
import { Building2, Lock } from "lucide-react";
import { CAPITEC_IDENTIFIERS, EFT_DEMO_BANKS, channelProviders, getEntry, maskPhone, validatePhone, DEVICES } from "@/lib/checkout/registry";
import { minorToInput } from "@/lib/checkout/money";
import { CodeStep, CopyRow, DemoActions, DeviceApproval, StepTitle, WalletSheet, demoBtn } from "./auth";
import { type FlowProps, FieldBox, ProviderSelect, amountOf } from "./flows-bank";
import { AvailabilityBadge, DemoTag, Spinner } from "./parts";

const twoMinutesAfter = (iso: string) => new Date(new Date(iso).getTime() + 2 * 60_000).toISOString();

function PhoneInput({ id, dial, value, onChange, error, example }: { id: string; dial: string; value: string; onChange: (v: string) => void; error?: string | undefined; example: string }) {
  return (
    <FieldBox label="Phone number" htmlFor={id} error={error}>
      <div className="flex">
        <span className="grid place-items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">{dial}</span>
        <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" className="field rounded-l-none" placeholder={example} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </FieldBox>
  );
}

/* ---------------- Mobile money ---------------- */
export function MobileMoneyForm({ engine, session, country }: FlowProps) {
  const ids = { p: useId(), n: useId() };
  const providers = channelProviders(country.code, "mobile_money");
  const [providerId, setProviderId] = useState(providers.length === 1 ? providers[0]!.id : "");
  const [phone, setPhone] = useState(session.customer.phone);
  const [tried, setTried] = useState(false);
  const provider = providers.find((p) => p.id === providerId);
  const phoneErr = validatePhone(country.code, phone);
  const att = engine.attempt;

  if (session.status === "INITIATING") return <Spinner label={`Sending a request to ${provider?.name ?? "your provider"}…`} />;
  if (session.status === "AWAITING_AUTHORIZATION" && att) {
    const p = providers.find((x) => x.name === att.provider);
    const fail = (r: string) => engine.failAuth(r);
    const extra = <>
      <button className={demoBtn} onClick={() => fail(`This number isn't registered for ${att.provider} (simulated).`)}>Wrong number</button>
      <button className={demoBtn} onClick={() => fail(`Network timeout — we couldn't reach ${att.provider} (simulated).`)}>Network timeout</button>
    </>;
    if (att.auth === "voucher" || att.auth === "ussd_otp") {
      const voucher = att.auth === "voucher";
      return (
        <div>
          <StepTitle title={voucher ? "Enter your payment voucher" : "Enter your one-time code"}
            description={voucher ? `On your ${att.provider} line, generate a payment voucher from the menu.` : <>Dial <span className="font-mono font-semibold">{p?.demoCode}</span> on your {att.provider} line to get a code. <DemoTag>Demo code</DemoTag></>} />
          <CodeStep title="" label={voucher ? "Voucher" : "One-time code"} demoHint={voucher ? "Any 6 digits work in this demo." : undefined}
            onSubmit={async (code) => {
              const r = await engine.submitAuth(voucher ? { voucher: code } : { otp: code });
              if (r.accepted) { engine.complete(); return null; }
              return r.error ?? "That code isn't right.";
            }}
            onTooMany={() => fail("Too many wrong codes (simulated).")} onCancel={() => engine.cancel("Customer cancelled the mobile money payment (simulated).")} />
        </div>
      );
    }
    const app = att.auth === "app_approval";
    return <DeviceApproval title={app ? `Approve in the ${att.provider} app` : "Check your phone"} detail={`${amountOf(session)} to ${session.merchantName} · ${att.summary ?? ""}`}
      steps={app
        ? [`Open the ${att.provider} app.`, "Review the payment request.", "Approve it in the app."]
        : [`A ${att.provider} prompt will appear on your phone.`, `Check it shows ${amountOf(session)} to ${session.merchantName}.`, "Enter your PIN on your phone — never on this page."]}
      approveLabel={app ? "Approve in app" : "Approve on phone"} expiresAt={twoMinutesAfter(att.updatedAt)} extra={extra}
      onApprove={() => engine.complete()} onReject={() => fail("You declined the request on your phone (simulated).")}
      onTimeout={() => fail("The approval request expired before it was approved (simulated).")}
      onCancel={() => engine.cancel("Customer cancelled the mobile money payment (simulated).")} />;
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); setTried(true); if (provider && !phoneErr) void engine.initiate({ providerId: provider.id, summary: `${provider.name} ${maskPhone(country.code, phone)}` }); }} noValidate>
      <div className="space-y-3">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Provider</legend>
          <div className="grid gap-2">
            {providers.map((p) => (
              <label key={p.id} className="choice cursor-pointer text-sm has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary">
                <input type="radio" name={ids.p} value={p.id} checked={providerId === p.id} onChange={() => setProviderId(p.id)} className="accent-[var(--primary)]" />
                <span className="flex-1 font-medium">{p.name}</span><AvailabilityBadge status={p.status ?? "supported"} />
              </label>
            ))}
          </div>
          {tried && !provider && <p className="mt-1 text-xs font-medium text-destructive" role="alert">Choose a provider.</p>}
        </fieldset>
        {provider?.hint && <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{provider.hint}</p>}
        <PhoneInput id={ids.n} dial={country.dialCode} value={phone} onChange={setPhone} error={tried ? phoneErr ?? undefined : undefined} example={country.phone.example} />
      </div>
      <button type="submit" className="btn btn-primary mt-4 h-11 w-full">Send request</button>
    </form>
  );
}

/* ---------------- M-PESA ---------------- */
export function MpesaPaymentForm({ engine, session, country }: FlowProps) {
  const ids = { n: useId(), m: useId() };
  const [mode, setMode] = useState<"mpesa_stk" | "mpesa_till">("mpesa_stk");
  const [phone, setPhone] = useState(session.customer.phone);
  const [tried, setTried] = useState(false);
  const phoneErr = validatePhone(country.code, phone);
  const att = engine.attempt;

  if (session.status === "INITIATING") return <Spinner label="Contacting M-PESA…" />;
  if (session.status === "AWAITING_AUTHORIZATION" && att) {
    return <DeviceApproval title="Check your phone" detail={`M-PESA prompt sent to ${att.summary?.replace("M-PESA ", "") ?? "your phone"}`}
      steps={[`An M-PESA prompt shows ${amountOf(session)} to ${session.merchantName}.`, "Enter your M-PESA PIN on your phone. Griv will never ask for it.", "Wait here while we confirm."]}
      approveLabel="Enter PIN on phone" expiresAt={twoMinutesAfter(att.updatedAt)}
      onApprove={() => engine.complete()} onReject={() => engine.failAuth("You declined the M-PESA request (simulated).")}
      onTimeout={() => engine.failAuth("The M-PESA request timed out (simulated).")}
      onCancel={() => engine.cancel("Customer cancelled the M-PESA request (simulated).")} />;
  }
  if (session.status === "AWAITING_PAYMENT" && att) {
    return (
      <div>
        <StepTitle title="Pay with Till number" description="Use the M-PESA menu on your phone." />
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm">
          <li>Open M-PESA → Lipa na M-PESA → Buy Goods and Services.</li>
          <li>Enter the Till number and amount below.</li>
          <li>Enter your PIN on your phone, then come back.</li>
        </ol>
        <div className="divide-y rounded-lg border px-3">
          <CopyRow label="Till number" value="000000" mono display={<span className="flex items-center gap-2">000 000<DemoTag>Demo till</DemoTag></span>} />
          <CopyRow label="Amount" value={minorToInput(session.amountMinor, session.currency)} display={amountOf(session)} />
          <CopyRow label="Reference" value={att.reference} mono />
        </div>
        <button className="btn btn-primary mt-3 h-11 w-full" onClick={() => engine.complete()}>I've paid</button>
        <button className="btn btn-ghost mt-2 h-9 w-full text-sm" onClick={() => engine.cancel("Customer cancelled the Till payment (simulated).")}>Cancel payment</button>
      </div>
    );
  }
  return (
    <form onSubmit={(e) => {
      e.preventDefault(); setTried(true);
      if (mode === "mpesa_till") return void engine.initiate({ providerId: "mpesa_till", summary: "M-PESA Till" });
      if (!phoneErr) void engine.initiate({ providerId: "mpesa_stk", summary: `M-PESA ${maskPhone(country.code, phone)}` });
    }} noValidate>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="M-PESA option">
        {(["mpesa_stk", "mpesa_till"] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === m ? "bg-card shadow-sm" : "text-muted-foreground"}`}>{m === "mpesa_stk" ? "Phone prompt" : "Till number"}</button>
        ))}
      </div>
      {mode === "mpesa_stk"
        ? <PhoneInput id={ids.n} dial={country.dialCode} value={phone} onChange={setPhone} error={tried ? phoneErr ?? undefined : undefined} example={country.phone.example} />
        : <p className="text-sm text-muted-foreground">You'll pay from the M-PESA menu on your phone using a Till number.</p>}
      <button type="submit" className="btn btn-primary mt-4 h-11 w-full">{mode === "mpesa_stk" ? "Send M-PESA prompt" : "Show Till details"}</button>
    </form>
  );
}

/* ---------------- Instant EFT ---------------- */
export function EFTPaymentFlow({ engine, session, country }: FlowProps) {
  const id = useId();
  const [bank, setBank] = useState("");
  const [stage, setStage] = useState<"redirecting" | "provider">("redirecting");
  const att = engine.attempt;
  const provider = channelProviders(country.code, "eft")[0];
  useEffect(() => {
    if (session.status !== "AWAITING_AUTHORIZATION") { setStage("redirecting"); return; }
    const t = setTimeout(() => setStage("provider"), 900);
    return () => clearTimeout(t);
  }, [session.status]);

  if (session.status === "INITIATING") return <Spinner label="Preparing secure bank connection…" />;
  if (session.status === "AWAITING_AUTHORIZATION" && att) {
    if (stage === "redirecting") return <Spinner label={`Taking you to ${att.provider}…`} />;
    return (
      <div>
        <div className="rounded-xl border-2 border-dashed border-input p-4">
          <div className="mb-3 flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-sm font-semibold"><Building2 className="h-4 w-4" />{att.provider}</span><DemoTag>Simulated provider screen</DemoTag></div>
          <p className="text-sm">You're paying <span className="font-semibold">{amountOf(session)}</span> to {session.merchantName} from <span className="font-semibold">{att.summary}</span>.</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" />A real provider would ask you to sign in to your bank on its own secure page. This demo asks for nothing.</p>
        </div>
        <DemoActions title="Simulate the bank">
          <button className={demoBtn} onClick={() => engine.complete({ via: "redirect_return" })}>Approve & return to checkout</button>
          <button className={demoBtn} onClick={() => engine.failAuth("Your bank declined the EFT payment (simulated).")}>Bank declines</button>
          <button className={demoBtn} onClick={() => engine.cancel("Customer left the bank page (simulated).")}>Customer cancels</button>
        </DemoActions>
      </div>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (bank && provider) void engine.initiate({ providerId: provider.id, summary: bank }); }}>
      <StepTitle title="Pay with Instant EFT" description={`Through ${provider?.name ?? "our EFT partner"}. You'll approve the payment in your online banking.`} />
      <ProviderSelect id={id} label="Your bank" value={bank} onChange={setBank} options={EFT_DEMO_BANKS.map((b) => ({ id: b, name: b }))} />
      <button type="submit" className="btn btn-primary mt-4 h-11 w-full" disabled={!bank}>Continue to your bank</button>
    </form>
  );
}

/* ---------------- Capitec Pay ---------------- */
export function CapitecPaymentFlow({ engine, session, country }: FlowProps) {
  const ids = { t: useId(), v: useId() };
  const [kind, setKind] = useState<(typeof CAPITEC_IDENTIFIERS)[number]["id"]>("mobile");
  const [value, setValue] = useState("");
  const [tried, setTried] = useState(false);
  const err = kind === "mobile" ? validatePhone(country.code, value)
    : kind === "id_number" ? (/^\d{13}$/.test(value.replace(/\s/g, "")) ? null : "SA ID numbers are 13 digits.")
    : /^\d{10}$/.test(value.replace(/\s/g, "")) ? null : "Capitec account numbers are 10 digits.";
  const att = engine.attempt;
  if (session.status === "INITIATING") return <Spinner label="Sending request to Capitec…" />;
  if (session.status === "AWAITING_AUTHORIZATION" && att) {
    return <DeviceApproval title="Approve in the Capitec app" detail={`${amountOf(session)} to ${session.merchantName}`}
      steps={["Open the Capitec app on your phone.", "Tap the Capitec Pay request.", "Approve it in the app. Never share your banking PIN or password."]}
      approveLabel="Approve in Capitec app" expiresAt={twoMinutesAfter(att.updatedAt)}
      onApprove={() => engine.complete()} onReject={() => engine.failAuth("You declined the Capitec Pay request (simulated).")}
      onTimeout={() => engine.failAuth("The Capitec Pay request timed out (simulated).")}
      onCancel={() => engine.cancel("Customer cancelled Capitec Pay (simulated).")} />;
  }
  const label = CAPITEC_IDENTIFIERS.find((i) => i.id === kind)!.label;
  return (
    <form onSubmit={(e) => { e.preventDefault(); setTried(true); if (!err) void engine.initiate({ providerId: "capitec", summary: `Capitec · ${label} ••${value.replace(/\D/g, "").slice(-3)}` }); }} noValidate>
      <div className="space-y-3">
        <FieldBox label="Find my account by" htmlFor={ids.t}>
          <select id={ids.t} className="field" value={kind} onChange={(e) => { setKind(e.target.value as typeof kind); setValue(""); setTried(false); }}>
            {CAPITEC_IDENTIFIERS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
        </FieldBox>
        <FieldBox label={label} htmlFor={ids.v} error={tried ? err ?? undefined : undefined} hint="Use made-up details — this demo doesn't look up real accounts.">
          <input id={ids.v} className="field tnum" inputMode={kind === "mobile" ? "tel" : "numeric"} autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === "mobile" ? country.phone.example : ""} />
        </FieldBox>
      </div>
      <button type="submit" className="btn btn-primary mt-4 h-11 w-full">Send to Capitec app</button>
    </form>
  );
}

/* ---------------- PayAttitude ---------------- */
export function PayAttitudePaymentFlow({ engine, session, country }: FlowProps) {
  const id = useId();
  const [phone, setPhone] = useState(session.customer.phone);
  const [tried, setTried] = useState(false);
  const err = validatePhone(country.code, phone);
  const att = engine.attempt;
  const hint = channelProviders(country.code, "payattitude")[0]?.hint;
  if (session.status === "INITIATING") return <Spinner label="Contacting PayAttitude…" />;
  if (session.status === "AWAITING_AUTHORIZATION" && att) {
    return <DeviceApproval title="Confirm on your phone" detail={`${amountOf(session)} to ${session.merchantName} · ${att.summary ?? ""}`}
      steps={["Your bank will send a PayAttitude prompt to your phone.", "Check the merchant and amount.", "Confirm on your phone using your bank's usual method."]}
      approveLabel="Confirm on phone" expiresAt={twoMinutesAfter(att.updatedAt)}
      onApprove={() => engine.complete()} onReject={() => engine.failAuth("You declined the PayAttitude request (simulated).")}
      onTimeout={() => engine.failAuth("The PayAttitude request timed out (simulated).")}
      onCancel={() => engine.cancel("Customer cancelled PayAttitude (simulated).")} />;
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); setTried(true); if (!err) void engine.initiate({ providerId: "payattitude", summary: `PayAttitude ${maskPhone(country.code, phone)}` }); }} noValidate>
      <StepTitle title="Pay with your phone number" description={hint} />
      <PhoneInput id={id} dial={country.dialCode} value={phone} onChange={setPhone} error={tried ? err ?? undefined : undefined} example={country.phone.example} />
      <button type="submit" className="btn btn-primary mt-4 h-11 w-full">Continue</button>
    </form>
  );
}

/* ---------------- Wallets ---------------- */
function WalletFlow({ engine, session, country, device, wallet }: FlowProps & { wallet: "apple_pay" | "google_pay" }) {
  const name = wallet === "apple_pay" ? "Apple Pay" : "Google Pay";
  const entry = getEntry(country.code, wallet);
  const att = engine.attempt;
  if (session.status === "INITIATING") return <Spinner label={`Opening ${name}…`} />;
  if (session.status === "AWAITING_AUTHORIZATION" && att) {
    return <WalletSheet wallet={name} merchant={session.merchantName} amount={amountOf(session)} card="Visa •••• 0000 (demo wallet card)"
      onAuthorize={() => engine.complete()} onFail={() => engine.failAuth(`${name} declined the payment (simulated).`)}
      onCancel={() => engine.selectMethod(wallet, false)} />;
  }
  return (
    <div>
      <StepTitle title={`Pay with ${name}`} description="Confirm the payment with the card saved in your wallet." />
      <dl className="mb-4 space-y-1.5 rounded-lg bg-muted px-3 py-2.5 text-xs">
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Device</dt><dd className="font-medium">{DEVICES.find((d) => d.id === device)?.label} · eligible</dd></div>
        {entry.merchantEligibility && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Merchant</dt><dd className="text-right font-medium">{entry.merchantEligibility}</dd></div>}
        {entry.customerEligibility && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Customer</dt><dd className="text-right font-medium">{entry.customerEligibility}</dd></div>}
        {entry.note && <div className="pt-1 font-medium text-warning-foreground">{entry.note}</div>}
      </dl>
      <button className="btn btn-dark h-11 w-full" onClick={() => void engine.initiate({ providerId: wallet, summary: `${name} · Visa •••• 0000` })}>Pay with {name}</button>
      <p className="mt-2 text-center text-xs text-muted-foreground">Demo button. Real wallets use the official {name} button and branding.</p>
    </div>
  );
}
export const ApplePayDemo = (p: FlowProps) => <WalletFlow {...p} wallet="apple_pay" />;
export const GooglePayDemo = (p: FlowProps) => <WalletFlow {...p} wallet="google_pay" />;
