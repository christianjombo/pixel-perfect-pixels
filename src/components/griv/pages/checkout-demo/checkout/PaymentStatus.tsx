import { useState } from "react";
import { Ban, Check, Clock, Hourglass, Receipt as ReceiptIcon, RotateCcw, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildReceipt } from "@/lib/checkout/adapter";
import type { CheckoutSession } from "@/lib/checkout/machine";
import { formatMinor } from "@/lib/checkout/money";
import { CHANNEL_INFO, needsDetails } from "@/lib/checkout/registry";
import type { CheckoutEngine } from "@/lib/checkout/useCheckoutEngine";
import { cn } from "@/lib/utils";
import { CopyRow, DemoActions, demoBtn } from "./auth";
import { DemoTag, Spinner } from "./parts";

const fmtDate = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const PENDING_HINT: Partial<Record<string, string>> = {
  bank_transfer: "Bank transfers can take a few minutes to arrive. You can close this page — the merchant is told once it's confirmed.",
  ussd: "USSD confirmations can take a minute after you approve on your phone.",
  mpesa: "M-PESA usually confirms within a minute.",
  mobile_money: "Mobile money usually confirms within a few minutes.",
};

function Icon({ tone, children }: { tone: "success" | "pending" | "danger" | "neutral"; children: React.ReactNode }) {
  const cls = { success: "bg-success text-success-foreground", pending: "bg-highlight text-highlight-foreground", danger: "bg-destructive/10 text-destructive", neutral: "bg-muted text-muted-foreground" }[tone];
  return <span className={cn("mx-auto grid h-14 w-14 place-items-center rounded-full", cls)}>{children}</span>;
}

function Heading({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mt-4 text-center">
      <h3 className="text-lg font-semibold" tabIndex={-1} data-autofocus>{children}</h3>
      {sub && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function PaymentStatus({ session, engine, onClose, merchantEmail }: { session: CheckoutSession; engine: CheckoutEngine; onClose?: (() => void) | undefined; merchantEmail: string }) {
  const [receipt, setReceipt] = useState(false);
  const [checked, setChecked] = useState<string | null>(null);
  const att = engine.attempt ?? session.attempts.at(-1) ?? null;
  const amount = formatMinor(session.amountMinor, session.currency);
  const method = att ? CHANNEL_INFO[att.channel].label : "";
  const rec = att?.reconciliation;

  if (session.status === "PROCESSING") return <Spinner label={`Confirming with ${att?.provider ?? "the provider"}…`} />;

  if (session.status === "PENDING") {
    return (
      <div className="py-4" role="status">
        <Icon tone="pending"><Hourglass className="h-6 w-6" /></Icon>
        <Heading sub={rec?.note ?? (att ? PENDING_HINT[att.channel] ?? "We're waiting for the provider to confirm. This page updates by itself." : undefined)}>We're confirming your payment</Heading>
        <div className="mt-4 rounded-lg border px-3"><CopyRow label="Reference" value={att?.reference ?? ""} mono /></div>
        {rec && rec.outcome !== "matched" && (
          <p className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
            Reconciliation: <span className="font-semibold capitalize">{rec.outcome}</span> · expected {formatMinor(rec.expectedMinor, session.currency)}, received {formatMinor(rec.receivedMinor, session.currency)}
          </p>
        )}
        <button className="btn btn-outline mt-4 h-10 w-full" onClick={() => setChecked(`Still waiting for confirmation · checked ${new Date().toLocaleTimeString("en-GB")}`)}>
          <RotateCcw className="h-4 w-4" />Check status
        </button>
        {checked && <p className="mt-2 text-center text-xs text-muted-foreground" aria-live="polite">{checked}</p>}
      </div>
    );
  }

  if (session.status === "SUCCEEDED") {
    const r = buildReceipt(session);
    return (
      <div className="py-4">
        <Icon tone="success"><Check className="h-7 w-7" strokeWidth={2.5} /></Icon>
        <Heading sub={<span className="inline-flex items-center gap-1.5">{amount} paid to {session.merchantName} <DemoTag>Simulated</DemoTag></span>}>Payment successful</Heading>
        <dl className="mt-5 divide-y rounded-lg border text-sm">
          {[["Amount", amount], ["Merchant", session.merchantName], ["Method", att?.summary ? `${method} · ${att.summary}` : method], ["Reference", att?.reference ?? ""], ["Date", fmtDate(session.completedAt ?? session.updatedAt)]].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-all text-right font-medium">{v}</dd></div>
          ))}
        </dl>
        {rec && rec.outcome === "matched" && <p className="mt-2 text-xs text-muted-foreground">Reconciliation: {rec.note}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="btn btn-outline h-10" onClick={() => setReceipt(true)}><ReceiptIcon className="h-4 w-4" />View receipt</button>
          <button className="btn btn-primary h-10" onClick={() => (onClose ? onClose() : void engine.restart())}>{onClose ? "Close checkout" : "Done"}</button>
        </div>
        <Dialog open={receipt} onOpenChange={setReceipt}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Receipt</DialogTitle>
              <DialogDescription>Demo receipt — no money moved.</DialogDescription>
            </DialogHeader>
            {r && (
              <div className="text-sm">
                <p className="text-2xl font-semibold tnum">{formatMinor(r.amountMinor, r.currency)}</p>
                <p className="text-muted-foreground">to {r.merchant}</p>
                <dl className="mt-4 divide-y rounded-lg border">
                  {[["Reference", r.reference], ["Method", r.method], ["Provider", r.provider], ...(r.detail ? [["Paid with", r.detail]] : []), ["Paid", fmtDate(r.paidAt)], ["Session", r.sessionId]].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-all text-right font-medium">{v}</dd></div>
                  ))}
                </dl>
                <button className="btn btn-outline mt-4 h-9 w-full" onClick={() => window.print()}>Print</button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (session.status === "FAILED") {
    return (
      <div className="py-4" role="alert">
        <Icon tone="danger"><X className="h-7 w-7" strokeWidth={2.5} /></Icon>
        <Heading sub={att?.failureReason ?? "The payment didn't go through. Nothing was charged."}>Payment didn't go through</Heading>
        <div className="mt-5 grid gap-2">
          <button className="btn btn-primary h-10" onClick={() => session.channel && engine.retry(needsDetails(session.country, session.channel))}>Retry payment</button>
          <button className="btn btn-outline h-10" onClick={engine.chooseAnother}>Choose another method</button>
          <a className="btn btn-ghost h-9 text-sm" href={`mailto:${merchantEmail}?subject=${encodeURIComponent(`Payment ${att?.reference ?? ""}`)}`}>Contact {session.merchantName}</a>
        </div>
      </div>
    );
  }

  if (session.status === "EXPIRED") {
    const lastTransfer = [...session.attempts].reverse().find((a) => a.channel === "bank_transfer");
    return (
      <div className="py-4">
        <Icon tone="neutral"><Clock className="h-6 w-6" /></Icon>
        <Heading sub="This checkout ran out of time before the payment was confirmed. Nothing was charged. Start again to get fresh payment details.">Session expired</Heading>
        {lastTransfer?.reconciliation?.outcome === "late" && <p className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning-foreground">{lastTransfer.reconciliation.note}</p>}
        <button className="btn btn-primary mt-5 h-10 w-full" onClick={() => void engine.restart()}>Restart payment</button>
        {lastTransfer && !lastTransfer.reconciliation && (
          <DemoActions title="Simulate the bank">
            <button className={demoBtn} onClick={() => engine.transferNotice("late")}>Money arrives after expiry</button>
          </DemoActions>
        )}
      </div>
    );
  }

  if (session.status === "CANCELLED") {
    return (
      <div className="py-4">
        <Icon tone="neutral"><Ban className="h-6 w-6" /></Icon>
        <Heading sub={att?.status === "cancelled" ? "You stopped this payment. Nothing was charged." : "This checkout was cancelled. Nothing was charged."}>Payment cancelled</Heading>
        <div className="mt-5 grid gap-2">
          <button className="btn btn-primary h-10" onClick={() => void engine.restart()}>Try again</button>
          <button className="btn btn-outline h-10" onClick={() => (onClose ? onClose() : void engine.restart())}>Return to {session.merchantName}</button>
        </div>
      </div>
    );
  }
  return null;
}
