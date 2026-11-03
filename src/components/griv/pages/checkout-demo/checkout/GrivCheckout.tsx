import { useEffect, useRef, type ComponentType } from "react";
import { canSwitchMethod } from "@/lib/checkout/machine";
import { type ChannelId, type EligibilityContext, getCountry, getEntry, needsDetails, visibleChannels } from "@/lib/checkout/registry";
import type { CheckoutEngine } from "@/lib/checkout/useCheckoutEngine";
import { cn } from "@/lib/utils";
import { BankPaymentForm, BankTransferInstructions, CardPaymentForm, QRPaymentView, USSDInstructions, type FlowProps } from "./flows-bank";
import { ApplePayDemo, CapitecPaymentFlow, EFTPaymentFlow, GooglePayDemo, MobileMoneyForm, MpesaPaymentForm, PayAttitudePaymentFlow } from "./flows-mobile";
import { CheckoutHeader, CheckoutSummary, PaymentMethodSelector, SelectedMethodBar, Spinner } from "./parts";
import { PaymentStatus } from "./PaymentStatus";

const FLOWS: Record<ChannelId, ComponentType<FlowProps>> = {
  card: CardPaymentForm, bank_transfer: BankTransferInstructions, pay_with_bank: BankPaymentForm, ussd: USSDInstructions,
  qr: QRPaymentView, mobile_money: MobileMoneyForm, mpesa: MpesaPaymentForm, eft: EFTPaymentFlow,
  capitec_pay: CapitecPaymentFlow, payattitude: PayAttitudePaymentFlow, apple_pay: ApplePayDemo, google_pay: GooglePayDemo,
};

const STATUS_TEXT: Record<string, string> = {
  INITIATING: "Starting payment", AWAITING_AUTHORIZATION: "Waiting for your approval", AWAITING_PAYMENT: "Waiting for your payment",
  PROCESSING: "Confirming payment", PENDING: "Payment pending confirmation", SUCCEEDED: "Payment successful",
  FAILED: "Payment failed", CANCELLED: "Payment cancelled", EXPIRED: "Checkout expired",
};

export type CheckoutMode = "hosted" | "modal" | "embedded";

/**
 * The reusable Griv Checkout. Everything it shows comes from the session (engine) and the
 * eligibility context, so Payment Links, Invoices, the store or an API session can mount the same
 * component later. Layout responds to its own width (container queries), not the window.
 */
export function GrivCheckout({ engine, ctx, merchantEmail, mode = "embedded", onClose, className }: {
  engine: CheckoutEngine; ctx: EligibilityContext; merchantEmail: string; mode?: CheckoutMode; onClose?: (() => void) | undefined; className?: string | undefined;
}) {
  const s = engine.session;
  const panel = useRef<HTMLDivElement>(null);
  const status = s?.status;
  const attemptAuth = engine.attempt?.auth;

  // Move focus to the new step's heading whenever the payment state changes.
  useEffect(() => {
    if (!status || status === "CREATED" || status === "READY") return;
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true }), 30);
    return () => clearTimeout(t);
  }, [status, attemptAuth]);

  if (!s) return <div className={cn("grid min-h-80 place-items-center bg-card", className)}><Spinner label="Opening checkout…" /></div>;

  const country = getCountry(s.country);
  const channels = visibleChannels(s.enabledChannels, ctx);
  const rows: [string, string][] = [
    ["Merchant", s.merchantName],
    ["Currency", s.currency],
    ...(s.orderReference ? [["Order", s.orderReference] as [string, string]] : []),
    ["Reference", engine.attempt?.reference ?? s.reference ?? "Assigned when you pay"],
  ];
  const resultStates = ["PROCESSING", "PENDING", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"];
  const Flow = s.channel ? FLOWS[s.channel] : null;

  let body: React.ReactNode;
  if (s.status === "CREATED") body = <Spinner label="Opening checkout…" />;
  else if (resultStates.includes(s.status)) body = <PaymentStatus session={s} engine={engine} onClose={onClose} merchantEmail={merchantEmail} />;
  else if (!s.channel || !Flow) {
    body = (
      <div>
        <h2 className="mb-3 text-base font-semibold">Choose how to pay</h2>
        {channels.length === 0
          ? <p className="rounded-lg bg-muted px-3 py-4 text-sm text-muted-foreground">No payment method is available for this payment. The merchant needs to switch one on.</p>
          : <PaymentMethodSelector channels={channels} statusOf={(c) => getEntry(s.country, c).status} selected={null} onSelect={(c) => engine.selectMethod(c, needsDetails(s.country, c))} />}
      </div>
    );
  } else {
    body = (
      <div>
        <SelectedMethodBar channel={s.channel} onChange={canSwitchMethod(s.status) && channels.length > 1 ? engine.chooseAnother : undefined} />
        <Flow key={`${s.channel}-${s.currentAttemptId ?? "new"}-${s.events.filter((e) => e.name === "checkout.retry").length}`} engine={engine} session={s} country={country} device={ctx.device} />
      </div>
    );
  }

  return (
    <div className={cn("@container bg-card text-foreground", className)}>
      <div className="flex min-h-full flex-col">
        <CheckoutHeader onClose={onClose} back={mode === "hosted"} closeLabel={mode === "hosted" ? "Back to the demo" : "Close checkout"} />
        <div className={cn("grid flex-1 @[34rem]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]", mode === "hosted" && "mx-auto w-full max-w-5xl")}>
          <aside className="border-b bg-secondary/60 p-5 @[34rem]:border-b-0 @[34rem]:border-r @[34rem]:p-6" aria-label="Payment summary">
            <CheckoutSummary merchant={s.merchantName} amountMinor={s.amountMinor} currency={s.currency} description={s.description} rows={rows} supportEmail={merchantEmail} />
          </aside>
          <section ref={panel} className="min-w-0 p-5 @[34rem]:p-6" aria-label="Payment">
            <p className="sr-only" aria-live="polite">{STATUS_TEXT[s.status] ?? ""}</p>
            {body}
          </section>
        </div>
      </div>
    </div>
  );
}
