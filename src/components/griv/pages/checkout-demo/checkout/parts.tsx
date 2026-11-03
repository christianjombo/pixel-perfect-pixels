import type { ReactNode } from "react";
import {
  Apple, ArrowLeft, BadgeCheck, Building2, ChevronDown, CreditCard, Hash, Landmark, Lock, PhoneCall, QrCode,
  Send, Smartphone, SmartphoneNfc, Wallet, X, type LucideIcon,
} from "lucide-react";
import { LogoMark } from "@/components/griv/Logo";
import { formatMinor, type CheckoutCurrency } from "@/lib/checkout/money";
import { CHANNEL_INFO, type Availability, type ChannelId } from "@/lib/checkout/registry";
import { cn } from "@/lib/utils";

export const CHANNEL_ICON: Record<ChannelId, LucideIcon> = {
  card: CreditCard, bank_transfer: Send, pay_with_bank: Landmark, ussd: Hash, qr: QrCode,
  mobile_money: Smartphone, mpesa: SmartphoneNfc, eft: Building2, capitec_pay: BadgeCheck,
  payattitude: PhoneCall, apple_pay: Apple, google_pay: Wallet,
};

export type MerchantInfo = { name: string; email: string; country: string };

/** Small "Demo" marker every simulated screen carries. */
export function DemoTag({ children = "Demo", className }: { children?: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full border border-dashed border-primary/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary", className)}>{children}</span>;
}

export function MerchantIdentity({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "M";
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className={cn("grid shrink-0 place-items-center rounded-lg bg-blackwood font-semibold text-blackwood-foreground", size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm")} aria-hidden>{initials}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{name || "Merchant"}</span>
        <span className="block text-xs text-muted-foreground">Checkout</span>
      </span>
    </div>
  );
}

export function CheckoutHeader({ onClose, closeLabel = "Close checkout", back }: { onClose?: (() => void) | undefined; closeLabel?: string; back?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
      <div className="flex items-center gap-2">
        <LogoMark className="h-5 w-5" />
        <span className="text-xs font-semibold">Griv Checkout</span>
        <DemoTag>Test mode</DemoTag>
      </div>
      {onClose && (
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" aria-label={closeLabel}>
          {back ? <><ArrowLeft className="h-3.5 w-3.5" />Back</> : <X className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

export type SummaryRow = [string, ReactNode];

/** Amount + order details. Shows no fees: the demo never adds charges the merchant didn't configure. */
export function CheckoutSummary({ merchant, amountMinor, currency, description, rows, supportEmail }: {
  merchant: string; amountMinor: number; currency: CheckoutCurrency; description: string; rows: SummaryRow[]; supportEmail: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <MerchantIdentity name={merchant} />
      <p className="mt-6 text-xs font-medium text-muted-foreground">Amount due</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tnum" aria-live="polite">{formatMinor(amountMinor, currency)}</p>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      <SummaryDetails rows={rows} className="mt-5 hidden @[34rem]:block" />
      <details className="group mt-4 rounded-lg border bg-card @[34rem]:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium">
          Payment summary <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <SummaryDetails rows={rows} className="border-t px-3 pb-2" />
      </details>
      <div className="mt-auto hidden pt-8 text-xs text-muted-foreground @[34rem]:block">
        <p className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Card details are never stored by this demo.</p>
        <p className="mt-1.5">Questions about this payment? <span className="font-medium text-foreground">{supportEmail}</span></p>
      </div>
    </div>
  );
}

function SummaryDetails({ rows, className }: { rows: SummaryRow[]; className?: string }) {
  return (
    <dl className={cn("space-y-1.5 text-xs", className)}>
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-3 pt-1.5">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-all text-right font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AvailabilityBadge({ status }: { status: Availability }) {
  if (status !== "experimental") return null;
  return <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning-foreground">Unverified</span>;
}

export function PaymentMethodCard({ channel, status, selected, onSelect }: { channel: ChannelId; status: Availability; selected?: boolean; onSelect: () => void }) {
  const Icon = CHANNEL_ICON[channel];
  const info = CHANNEL_INFO[channel];
  return (
    <button type="button" onClick={onSelect} aria-pressed={!!selected}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        selected && "border-primary ring-1 ring-primary",
      )}>
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-foreground", selected && "bg-primary text-primary-foreground")}><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold">{info.label}<AvailabilityBadge status={status} /></span>
        <span className="block truncate text-xs text-muted-foreground">{info.description}</span>
      </span>
      <span className={cn("h-4 w-4 shrink-0 rounded-full border-2", selected ? "border-[5px] border-primary" : "border-input")} aria-hidden />
    </button>
  );
}

export function PaymentMethodSelector({ channels, statusOf, selected, onSelect }: {
  channels: ChannelId[]; statusOf: (c: ChannelId) => Availability; selected: ChannelId | null; onSelect: (c: ChannelId) => void;
}) {
  return (
    <div role="group" aria-label="Payment methods" className="grid gap-2 @[26rem]:grid-cols-2">
      {channels.map((c) => <PaymentMethodCard key={c} channel={c} status={statusOf(c)} selected={selected === c} onSelect={() => onSelect(c)} />)}
    </div>
  );
}

/** Compact "Paying with …" row shown once a method is picked. */
export function SelectedMethodBar({ channel, onChange }: { channel: ChannelId; onChange?: (() => void) | undefined }) {
  const Icon = CHANNEL_ICON[channel];
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2">
      <span className="flex items-center gap-2 text-sm"><Icon className="h-4 w-4 text-primary" /><span className="text-muted-foreground">Paying with</span><span className="font-semibold">{CHANNEL_INFO[channel].label}</span></span>
      {onChange && <button type="button" onClick={onChange} className="text-xs font-semibold text-primary hover:underline">Change</button>}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center py-10 text-center" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary motion-reduce:animate-none" aria-hidden />
      <p className="mt-3 text-sm font-medium">{label}</p>
    </div>
  );
}
