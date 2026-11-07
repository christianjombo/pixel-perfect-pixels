import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { CreditCard, MoreHorizontal, Pause, Play, Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DashboardPage } from "@/components/griv/DashboardPage";
import { Logo } from "@/components/griv/Logo";
import {
  ConfirmDialog, CopyButton, DataTable, DetailList, EmptyState, Field, FormDialog, StatusBadge, Timeline, type Column,
} from "@/components/griv/kit";
import {
  cardActivity, cardFunding, cardTxns, cardsStore, cardTxnsStore, cardFundingStore, cardActivityStore,
  fundCard, pauseCard, resumeCard, terminateCard, renameCard, updateLimits, setAutoFunding,
  type CardTransaction, type FundingRecord, type DemoCardFull,
} from "@/lib/demo/cards";
import { fmtDateTime } from "@/lib/dates";
import { formatMoney, type Currency } from "@/lib/money";
import { useGriv } from "@/lib/griv-store";
import { toast } from "sonner";

const TABS = ["Overview", "Transactions", "Funding", "Controls", "Activity"] as const;
type Tab = (typeof TABS)[number];

export function CardDetailPage() {
  const { cardId } = useParams({ from: "/cards/$cardId" });
  cardsStore.use(); cardTxnsStore.use(); cardFundingStore.use(); cardActivityStore.use();
  const g = useGriv();
  const actor = `${g.firstName || "Ada"} ${g.lastName || "Okafor"}`;
  const card = cardsStore.get().find(c => c.id === cardId);

  const [tab, setTab] = useState<Tab>("Overview");
  const [fundOpen, setFundOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [sensitiveOpen, setSensitiveOpen] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<CardTransaction | null>(null);

  if (!card) {
    return (
      <DashboardPage title="Card" crumbs={[{ label: "Cards", to: "/cards" }]}>
        <EmptyState title="Card not found" description="This sample card may have been removed or the demo data was reset."
          action={<Link to="/cards" className="btn btn-outline">Back to Cards</Link>} />
      </DashboardPage>
    );
  }

  const txns = cardTxns(card.id);
  const funding = cardFunding(card.id);
  const activity = cardActivity(card.id);
  const canPause = card.status === "Active";
  const canResume = card.status === "Paused";
  const canTerminate = card.status !== "Terminated" && card.status !== "Expired";
  const canFund = card.status === "Active" || card.status === "Paused";

  return (
    <DashboardPage
      crumbs={[{ label: "Cards", to: "/cards" }, { label: card.nickname }]}
      title={card.nickname}
      description={`${card.network} ${card.kind.toLowerCase()} card ${card.last4 ? `•••• ${card.last4}` : "(not issued yet)"} · ${card.currency} · Created ${fmtDateTime(card.createdAt)}`}
      notice="Sample card from the demo issuer. Funding stays processing until a real issuer confirms; full card numbers and security codes are never stored or shown."
      actions={<>
        <Button onClick={() => setFundOpen(true)} disabled={!canFund}><Plus />Fund card</Button>
        {canPause && <Button variant="outline" onClick={() => { pauseCard(card.id, actor); toast.info("Card paused — new authorizations will be declined"); }}><Pause />Pause card</Button>}
        {canResume && <Button variant="outline" onClick={() => { resumeCard(card.id, actor); toast.success("Card resumed"); }}><Play />Resume card</Button>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline"><MoreHorizontal />More actions</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setRenameOpen(true)}>Edit nickname</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setLimitsOpen(true)}>Manage limits</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setAutoOpen(true)}>Manage funding rules</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSensitiveOpen(true)}>View sensitive card details</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" disabled={!canTerminate} onSelect={() => setTerminateOpen(true)}>Terminate card</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>}
    >
      <div className="mb-6 flex gap-1 overflow-x-auto border-b" role="tablist">
        {TABS.map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab card={card} />}
      {tab === "Transactions" && <TransactionsTab txns={txns} currency={card.currency} onSelect={setSelectedTxn} />}
      {tab === "Funding" && <FundingTab card={card} funding={funding} onFund={() => setFundOpen(true)} onAuto={() => setAutoOpen(true)} />}
      {tab === "Controls" && <ControlsTab card={card} onLimits={() => setLimitsOpen(true)} onAuto={() => setAutoOpen(true)} onPause={() => { pauseCard(card.id, actor); toast.info("Card paused"); }} onResume={() => { resumeCard(card.id, actor); toast.success("Card resumed"); }} onTerminate={() => setTerminateOpen(true)} />}
      {tab === "Activity" && <ActivityTab cardId={card.id} />}

      <FundDialog card={card} open={fundOpen} onOpenChange={setFundOpen} actor={actor} />
      <TerminateDialog card={card} open={terminateOpen} onOpenChange={setTerminateOpen} actor={actor} />
      <RenameDialog card={card} open={renameOpen} onOpenChange={setRenameOpen} actor={actor} />
      <LimitsDialog card={card} open={limitsOpen} onOpenChange={setLimitsOpen} actor={actor} />
      <AutoFundingDialog card={card} open={autoOpen} onOpenChange={setAutoOpen} actor={actor} />
      <TxnDialog txn={selectedTxn} onClose={() => setSelectedTxn(null)} />

      <FormDialog open={sensitiveOpen} onOpenChange={setSensitiveOpen} title="Sensitive card details" description="Full card numbers and security codes need an issuer-approved secure display.">
        <div className="flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p>The demo issuer doesn't support revealing card details. In production this opens a PCI-compliant secure frame after extra verification — the full number and security code are never stored in this app, its logs or your browser.</p>
        </div>
        <div className="mt-4 flex justify-end"><Button variant="outline" onClick={() => setSensitiveOpen(false)}>Close</Button></div>
      </FormDialog>
    </DashboardPage>
  );
}

/* ---------- Tabs ---------- */

function OverviewTab({ card }: { card: DemoCardFull }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div>
        <div className="aspect-[1.586] rounded-lg bg-sidebar p-5 text-sidebar-foreground">
          <div className="flex justify-between"><Logo variant="light" className="h-5" /><span className="text-xs text-sidebar-foreground/65">DEMO · {card.currency}</span></div>
          <CreditCard className="mt-5 h-7 w-7 text-sidebar-primary" />
          <p className="mt-3 text-lg tabular-nums">•••• &nbsp;•••• &nbsp;•••• &nbsp;{card.last4 || "••••"}</p>
          <p className="mt-4 text-sm">{card.holder}</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="panel p-3"><p className="text-xs text-muted-foreground">Available</p><p className="mt-1 font-semibold tnum">{formatMoney(card.available, card.currency)}</p></div>
          <div className="panel p-3"><p className="text-xs text-muted-foreground">Pending / held</p><p className="mt-1 font-semibold tnum">{formatMoney(card.held, card.currency)}</p></div>
          <div className="panel p-3"><p className="text-xs text-muted-foreground">Total funded</p><p className="mt-1 font-semibold tnum">{formatMoney(card.totalFunded, card.currency)}</p></div>
          <div className="panel p-3"><p className="text-xs text-muted-foreground">Total spent</p><p className="mt-1 font-semibold tnum">{formatMoney(card.totalSpent, card.currency)}</p></div>
          <div className="panel p-3"><p className="text-xs text-muted-foreground">Total fees</p><p className="mt-1 font-semibold tnum">{formatMoney(card.totalFees, card.currency)}</p></div>
          <div className="panel p-3"><p className="text-xs text-muted-foreground">Status</p><p className="mt-1"><StatusBadge status={card.status} /></p></div>
        </div>
      </div>
      <div className="space-y-6">
        <DetailList items={[
          ["Cardholder", card.holder],
          ["Masked number", card.last4 ? `•••• •••• •••• ${card.last4}` : "Not issued yet"],
          ["Card ID", <span key="id" className="inline-flex items-center gap-2">{card.id}<CopyButton value={card.id} label="Copy" iconOnly /></span>],
          ["Network", card.network],
          ["Card type", card.kind],
          ["Currency", card.currency],
          ["Funding model", card.fundingModel],
          ["Funding source", card.fundingSource],
          ["Creation source", card.source],
          ["Created by", card.createdBy],
          ["Created at", fmtDateTime(card.createdAt)],
          ["Issuer reference", card.providerRef],
          ["Issuance transaction", card.issueRef],
          ...(card.status === "Terminated" ? [["Terminated", `${fmtDateTime(card.terminatedAt!)} by ${card.terminatedBy} — ${card.terminateReason}`] as [string, React.ReactNode]] : []),
        ]} />
        <p className="text-sm text-muted-foreground">
          Related records: <Link to="/balances" className="font-medium text-primary hover:underline">Balances</Link> ·{" "}
          <Link to="/transactions" search={{ q: "" }} className="font-medium text-primary hover:underline">Transactions</Link>
        </p>
      </div>
    </div>
  );
}

function TransactionsTab({ txns, currency, onSelect }: { txns: CardTransaction[]; currency: Currency; onSelect: (t: CardTransaction) => void }) {
  const columns: Column<CardTransaction>[] = [
    { key: "id", header: "Transaction", cell: t => <span className="font-medium">{t.id}</span> },
    { key: "date", header: "Date", sort: t => t.date, cell: t => <span className="text-muted-foreground">{fmtDateTime(t.date)}</span> },
    { key: "merchant", header: "Merchant", sort: t => t.merchant, cell: t => <span><span className="block font-medium">{t.merchant}</span><span className="block text-xs text-muted-foreground">{t.category}</span></span> },
    { key: "type", header: "Type", hideBelow: "md", cell: t => t.type },
    { key: "amount", header: "Amount", align: "right", sort: t => t.amount, cell: t => formatMoney(t.amount, t.currency, { signed: true }) },
    { key: "fee", header: "Fee", align: "right", hideBelow: "lg", cell: t => (t.fee ? formatMoney(t.fee, t.currency) : "—") },
    { key: "status", header: "Status", cell: t => <StatusBadge status={t.status} /> },
    { key: "ref", header: "Reference", hideBelow: "lg", cell: t => <span className="text-muted-foreground">{t.ref}</span> },
  ];
  if (!txns.length) return <EmptyState title="No card activity yet" description={`Transactions on this ${currency} card will appear here.`} />;
  return (
    <section className="rounded-lg border bg-card">
      <DataTable columns={columns} rows={txns} rowKey={t => t.id} pageSize={15} initialSort={{ key: "date", dir: "desc" }} onRowClick={onSelect} caption="Card transactions" />
    </section>
  );
}

function FundingTab({ card, funding, onFund, onAuto }: { card: DemoCardFull; funding: FundingRecord[]; onFund: () => void; onAuto: () => void }) {
  const fees = 0;
  const columns: Column<FundingRecord>[] = [
    { key: "id", header: "Funding ID", cell: f => <span className="font-medium">{f.id}</span> },
    { key: "date", header: "Date", sort: f => f.date, cell: f => <span className="text-muted-foreground">{fmtDateTime(f.date)}</span> },
    { key: "amount", header: "Amount", align: "right", sort: f => f.amount, cell: f => formatMoney(f.amount, f.currency) },
    { key: "source", header: "Source", hideBelow: "md", cell: f => f.source },
    { key: "by", header: "Initiated by", hideBelow: "lg", cell: f => <span className="text-muted-foreground">{f.initiatedBy}</span> },
    { key: "channel", header: "Channel", hideBelow: "md", cell: f => f.channel },
    { key: "status", header: "Status", cell: f => <StatusBadge status={f.status} /> },
    { key: "txn", header: "Linked transaction", hideBelow: "lg", cell: f => <Link to="/transactions" search={{ q: f.linkedTxn }} className="font-medium text-primary hover:underline">{f.linkedTxn}</Link> },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel p-4"><p className="label-caps">Funding model</p><p className="mt-2 font-semibold">{card.fundingModel}</p><p className="mt-1 text-xs text-muted-foreground">{card.fundingSource}</p></div>
        <div className="panel p-4"><p className="label-caps">Total funded</p><p className="mt-2 font-semibold tnum">{formatMoney(card.totalFunded, card.currency)}</p><p className="mt-1 text-xs text-muted-foreground">Funding fees: {formatMoney(fees, card.currency)}</p></div>
        <div className="panel p-4"><p className="label-caps">Available balance</p><p className="mt-2 font-semibold tnum">{formatMoney(card.available, card.currency)}</p><p className="mt-1 text-xs text-muted-foreground">Held: {formatMoney(card.held, card.currency)}</p></div>
        <div className="panel p-4"><p className="label-caps">Automatic funding</p><p className="mt-2 font-semibold">{card.autoFunding.enabled ? "On" : "Off"}</p><p className="mt-1 text-xs text-muted-foreground">{card.autoFunding.enabled ? `Top up ${formatMoney(card.autoFunding.topUp, card.currency)} below ${formatMoney(card.autoFunding.threshold, card.currency)}` : "No rule configured"}</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onFund} disabled={card.status !== "Active" && card.status !== "Paused"}><Plus />Fund card</Button>
        <Button size="sm" variant="outline" onClick={onAuto}>{card.autoFunding.enabled ? "Configure automatic funding" : "Set up automatic funding"}</Button>
      </div>
      <section className="rounded-lg border bg-card">
        <h2 className="border-b bg-muted/50 px-5 py-3 font-semibold">Funding history</h2>
        {funding.length ? <DataTable columns={columns} rows={funding} rowKey={f => f.id} pageSize={10} initialSort={{ key: "date", dir: "desc" }} caption="Card funding history" />
          : <EmptyState title="No funding yet" description="Funding movements appear here once the card is funded." />}
      </section>
    </div>
  );
}

function ControlsTab({ card, onLimits, onAuto, onPause, onResume, onTerminate }: {
  card: DemoCardFull; onLimits: () => void; onAuto: () => void; onPause: () => void; onResume: () => void; onTerminate: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/50 px-5 py-3"><h2 className="font-semibold">Spending limits</h2><Button size="sm" variant="outline" onClick={onLimits}>Manage limits</Button></div>
        <DetailList className="rounded-none border-0" items={[
          ["Per transaction", formatMoney(card.limits.perTransaction, card.currency)],
          ["Daily", formatMoney(card.limits.daily, card.currency)],
          ["Monthly", formatMoney(card.limits.monthly, card.currency)],
          ["Last modified", `${fmtDateTime(card.limitsModifiedAt)} by ${card.limitsModifiedBy}`],
        ]} />
      </section>
      <section className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/50 px-5 py-3"><h2 className="font-semibold">Restrictions</h2></div>
        <DetailList className="rounded-none border-0" items={[
          ["Merchant categories", card.restrictions.categories.length ? card.restrictions.categories.join(", ") : "All categories allowed"],
          ["Geography", card.restrictions.countries.length ? card.restrictions.countries.join(", ") : "All countries"],
          ["Channels", card.restrictions.channels.join(", ")],
        ]} />
      </section>
      <section className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/50 px-5 py-3"><h2 className="font-semibold">Automatic funding</h2><Button size="sm" variant="outline" onClick={onAuto}>Configure</Button></div>
        <DetailList className="rounded-none border-0" items={card.autoFunding.enabled ? [
          ["Status", "Enabled"],
          ["Low-balance threshold", formatMoney(card.autoFunding.threshold, card.currency)],
          ["Top-up amount", formatMoney(card.autoFunding.topUp, card.currency)],
          ["Funding source", card.autoFunding.source],
          ["Caps", `${formatMoney(card.autoFunding.dailyCap, card.currency)}/day · ${formatMoney(card.autoFunding.monthlyCap, card.currency)}/month`],
          ["Minimum interval", `${card.autoFunding.minIntervalHours}h between top-ups`],
        ] : [["Status", "Disabled"], ["Rule", "No automatic funding rule configured"]] as [string, React.ReactNode][]} />
      </section>
      <section className="rounded-lg border bg-card">
        <div className="border-b bg-muted/50 px-5 py-3"><h2 className="font-semibold">Lifecycle</h2></div>
        <div className="space-y-3 p-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="font-medium">Pause or resume</p><p className="text-xs text-muted-foreground">Paused cards decline new authorizations.</p></div>
            {card.status === "Active" && <Button size="sm" variant="outline" onClick={onPause}><Pause />Pause</Button>}
            {card.status === "Paused" && <Button size="sm" variant="outline" onClick={onResume}><Play />Resume</Button>}
            {(card.status === "Terminated" || card.status === "Expired" || card.status === "Pending") && <StatusBadge status={card.status} />}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <div><p className="font-medium">Terminate</p><p className="text-xs text-muted-foreground">Irreversible. Remaining funds follow the issuer's refund workflow — they are not moved automatically.</p></div>
            <Button size="sm" variant="destructive" disabled={card.status === "Terminated" || card.status === "Expired"} onClick={onTerminate}>Terminate card</Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ActivityTab({ cardId }: { cardId: string }) {
  const events = cardActivity(cardId);
  if (!events.length) return <EmptyState title="No activity yet" />;
  return (
    <div className="max-w-2xl">
      <Timeline events={events.map(e => ({
        label: e.type,
        time: `${fmtDateTime(e.time)} · ${e.actor} · ${e.channel}`,
        note: `${e.description}${e.ref ? ` Ref: ${e.ref}.` : ""} ${e.kind === "financial" ? "Financial event" : "Operational event"} · ${e.correlationId}`,
        tone: e.type.includes("declined") || e.type.includes("failed") || e.type.includes("Terminated") ? "danger" : e.kind === "financial" ? "info" : "neutral",
      }))} />
    </div>
  );
}

/* ---------- Dialogs ---------- */

function FundDialog({ card, open, onOpenChange, actor }: { card: DemoCardFull; open: boolean; onOpenChange: (o: boolean) => void; actor: string }) {
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const fee = Math.round((Number(amount) || 0) * 0.005 * 100) / 100;
  const total = (Number(amount) || 0) + fee;
  const close = (o: boolean) => { onOpenChange(o); if (!o) { setAmount(""); setReference(""); setError(""); } };
  return (
    <FormDialog open={open} onOpenChange={close} title={`Fund ${card.nickname}`} description="Creates a funding transaction that stays processing until the issuer confirms. No money moves in this demo.">
      <form className="space-y-4" onSubmit={e => {
        e.preventDefault();
        try {
          const f = fundCard(card.id, Number(amount), card.fundingSource, actor, reference);
          close(false);
          toast.info(`Funding ${f.id} is processing — it completes only on issuer confirmation`);
        } catch (err) { setError(err instanceof Error ? err.message : "Couldn't start funding."); }
      }}>
        <DetailList items={[["Card", `${card.nickname} · •••• ${card.last4 || "••••"}`], ["Funding source", card.fundingSource], ["Currency", card.currency]]} />
        <Field label={`Amount (${card.currency})`} htmlFor="fund-amount"><input id="fund-amount" className="field" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></Field>
        <Field label="Reference" htmlFor="fund-ref" optional><input id="fund-ref" className="field" value={reference} onChange={e => setReference(e.target.value)} placeholder="Optional note" /></Field>
        <DetailList items={[["Estimated fee (0.5%)", formatMoney(fee, card.currency)], ["Total debit", formatMoney(total, card.currency)]]} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button><Button type="submit">Start funding</Button></div>
      </form>
    </FormDialog>
  );
}

function TerminateDialog({ card, open, onOpenChange, actor }: { card: DemoCardFull; open: boolean; onOpenChange: (o: boolean) => void; actor: string }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  return (
    <ConfirmDialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) { setReason(""); setError(""); } }} danger
      title={`Terminate ${card.nickname}?`}
      description={`This is irreversible — a terminated card can never be resumed. Remaining balance of ${formatMoney(card.available, card.currency)} and any pending transactions are handled by the issuer's settlement/refund workflow, not moved automatically.`}
      confirmLabel="Terminate card"
      onConfirm={() => {
        try { terminateCard(card.id, actor, reason); toast.info("Card terminated"); }
        catch (err) { setError(err instanceof Error ? err.message : "Couldn't terminate."); return; }
      }}>
      <div className="py-2">
        <Field label="Reason" htmlFor="term-reason"><input id="term-reason" className="field" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Staff exit, card compromised" /></Field>
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    </ConfirmDialog>
  );
}

function RenameDialog({ card, open, onOpenChange, actor }: { card: DemoCardFull; open: boolean; onOpenChange: (o: boolean) => void; actor: string }) {
  const [name, setName] = useState(card.nickname);
  const [error, setError] = useState("");
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Edit nickname">
      <form className="space-y-4" onSubmit={e => {
        e.preventDefault();
        try { renameCard(card.id, name, actor); onOpenChange(false); toast.success("Nickname updated"); }
        catch (err) { setError(err instanceof Error ? err.message : "Couldn't rename."); }
      }}>
        <Field label="Nickname" htmlFor="rename-card"><input id="rename-card" className="field" defaultValue={card.nickname} onChange={e => setName(e.target.value)} /></Field>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit">Save</Button></div>
      </form>
    </FormDialog>
  );
}

function LimitsDialog({ card, open, onOpenChange, actor }: { card: DemoCardFull; open: boolean; onOpenChange: (o: boolean) => void; actor: string }) {
  const [perTxn, setPerTxn] = useState(String(card.limits.perTransaction));
  const [daily, setDaily] = useState(String(card.limits.daily));
  const [monthly, setMonthly] = useState(String(card.limits.monthly));
  const [error, setError] = useState("");
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Manage spending limits" description={`Amounts in ${card.currency}. Per-transaction ≤ daily ≤ monthly.`}>
      <form className="space-y-4" onSubmit={e => {
        e.preventDefault();
        try { updateLimits(card.id, { perTransaction: Number(perTxn), daily: Number(daily), monthly: Number(monthly) }, actor); onOpenChange(false); toast.success("Limits updated"); }
        catch (err) { setError(err instanceof Error ? err.message : "Couldn't update limits."); }
      }}>
        <Field label="Per-transaction limit" htmlFor="lim-pt"><input id="lim-pt" className="field" inputMode="numeric" defaultValue={card.limits.perTransaction} onChange={e => setPerTxn(e.target.value)} /></Field>
        <Field label="Daily limit" htmlFor="lim-d"><input id="lim-d" className="field" inputMode="numeric" defaultValue={card.limits.daily} onChange={e => setDaily(e.target.value)} /></Field>
        <Field label="Monthly limit" htmlFor="lim-m"><input id="lim-m" className="field" inputMode="numeric" defaultValue={card.limits.monthly} onChange={e => setMonthly(e.target.value)} /></Field>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit">Save limits</Button></div>
      </form>
    </FormDialog>
  );
}

function AutoFundingDialog({ card, open, onOpenChange, actor }: { card: DemoCardFull; open: boolean; onOpenChange: (o: boolean) => void; actor: string }) {
  const r = card.autoFunding;
  const [enabled, setEnabled] = useState(r.enabled);
  const [threshold, setThreshold] = useState(String(r.threshold || ""));
  const [topUp, setTopUp] = useState(String(r.topUp || ""));
  const [maxPer, setMaxPer] = useState(String(r.maxPerTopUp || ""));
  const [dailyCap, setDailyCap] = useState(String(r.dailyCap || ""));
  const [monthlyCap, setMonthlyCap] = useState(String(r.monthlyCap || ""));
  const [interval, setIntervalH] = useState(String(r.minIntervalHours || 24));
  const [error, setError] = useState("");
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Automatic funding" description="Top up this card when its balance runs low. Caps and a minimum interval protect against funding loops and duplicate top-ups.">
      <form className="space-y-4" onSubmit={e => {
        e.preventDefault();
        try {
          setAutoFunding(card.id, {
            enabled, threshold: Number(threshold) || 0, topUp: Number(topUp) || 0, source: card.fundingSource,
            maxPerTopUp: Number(maxPer) || 0, dailyCap: Number(dailyCap) || 0, monthlyCap: Number(monthlyCap) || 0,
            minIntervalHours: Number(interval) || 0,
          }, actor);
          onOpenChange(false);
          toast.success(enabled ? "Automatic funding enabled" : "Automatic funding disabled");
        } catch (err) { setError(err instanceof Error ? err.message : "Couldn't save the rule."); }
      }}>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-4 w-4" defaultChecked={r.enabled} onChange={e => setEnabled(e.target.checked)} />Enable automatic funding</label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Low-balance threshold (${card.currency})`} htmlFor="af-th"><input id="af-th" className="field" inputMode="numeric" defaultValue={r.threshold || ""} onChange={e => setThreshold(e.target.value)} placeholder="e.g. 50000" /></Field>
          <Field label={`Top-up amount (${card.currency})`} htmlFor="af-tu"><input id="af-tu" className="field" inputMode="numeric" defaultValue={r.topUp || ""} onChange={e => setTopUp(e.target.value)} placeholder="e.g. 200000" /></Field>
          <Field label="Max per top-up" htmlFor="af-mp"><input id="af-mp" className="field" inputMode="numeric" defaultValue={r.maxPerTopUp || ""} onChange={e => setMaxPer(e.target.value)} /></Field>
          <Field label="Daily funding cap" htmlFor="af-dc"><input id="af-dc" className="field" inputMode="numeric" defaultValue={r.dailyCap || ""} onChange={e => setDailyCap(e.target.value)} /></Field>
          <Field label="Monthly funding cap" htmlFor="af-mc"><input id="af-mc" className="field" inputMode="numeric" defaultValue={r.monthlyCap || ""} onChange={e => setMonthlyCap(e.target.value)} /></Field>
          <Field label="Min hours between top-ups" htmlFor="af-int"><input id="af-int" className="field" inputMode="numeric" defaultValue={r.minIntervalHours || 24} onChange={e => setIntervalH(e.target.value)} /></Field>
        </div>
        <p className="text-xs text-muted-foreground">Funding source: {card.fundingSource}. Every automatic top-up creates a funding record and an audit event, and fails safely if the source has insufficient funds.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit">Save rule</Button></div>
      </form>
    </FormDialog>
  );
}

function TxnDialog({ txn, onClose }: { txn: CardTransaction | null; onClose: () => void }) {
  return (
    <FormDialog open={!!txn} onOpenChange={o => { if (!o) onClose(); }} title={txn ? `${txn.merchant}` : "Transaction"} description={txn ? `${txn.type} · ${fmtDateTime(txn.date)}` : undefined}>
      {txn && (
        <div className="space-y-4">
          <DetailList items={[
            ["Transaction ID", txn.id],
            ["Merchant", `${txn.merchant} (${txn.category})`],
            ["Type", txn.type],
            ["Amount", formatMoney(txn.amount, txn.currency, { signed: true })],
            ["Fee", txn.fee ? formatMoney(txn.fee, txn.currency) : "—"],
            ...(txn.settleAmount != null && txn.settleCurrency && txn.settleCurrency !== txn.currency
              ? [["Settlement amount", formatMoney(txn.settleAmount, txn.settleCurrency)] as [string, React.ReactNode]] : []),
            ["Status", <StatusBadge key="s" status={txn.status} />],
            ...(txn.declineReason ? [["Decline reason", txn.declineReason] as [string, React.ReactNode]] : []),
            ["Reference", txn.ref],
            ["Status history", `${txn.type === "Decline" ? "Requested → Declined" : txn.status === "Refunded" ? "Authorized → Captured → Refunded" : "Authorized → " + txn.status}`],
          ]} />
          <p className="text-sm text-muted-foreground">Linked Griv record: <Link to="/transactions" search={{ q: txn.ref }} className="font-medium text-primary hover:underline">{txn.ref}</Link></p>
        </div>
      )}
    </FormDialog>
  );
}
