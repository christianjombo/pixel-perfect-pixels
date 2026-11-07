import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, CreditCard, Globe, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DashboardPage } from "@/components/griv/DashboardPage";
import {
  DataTable, DateRangeSelect, ExportButton, Field, FilterSelect, FormDialog, MetricCard, MetricGrid,
  SearchInput, StatusBadge, StatusTabs, Toolbar, useDemoLoading, type Column,
} from "@/components/griv/kit";
import {
  cardExportRows, cardsStore, cardTxnsStore, issueCard, type CardKind, type CardNetwork, type DemoCardFull,
} from "@/lib/demo/cards";
import { exportCsv } from "@/lib/csv";
import { inRange, type DateRange } from "@/lib/dates";
import { formatMoney, formatMoneyCompact, totalsByCurrency, CURRENCIES, type Currency } from "@/lib/money";
import { useGriv } from "@/lib/griv-store";
import { toast } from "sonner";

type Tab = "All cards" | "Active" | "Paused" | "Pending" | "Terminated";

const NETWORKS: CardNetwork[] = ["Visa", "Mastercard", "Verve"];

export function CardsPage() {
  const cards = cardsStore.use();
  const txns = cardTxnsStore.use();
  const g = useGriv();
  const navigate = useNavigate();
  const loading = useDemoLoading();
  const actor = `${g.firstName || "Ada"} ${g.lastName || "Okafor"}`;

  const [tab, setTab] = useState<Tab>("All cards");
  const [search, setSearch] = useState("");
  const [currency, setCurrency] = useState("All");
  const [kind, setKind] = useState("All");
  const [network, setNetwork] = useState("All");
  const [createdBy, setCreatedBy] = useState("All");
  const [range, setRange] = useState<DateRange>("Last 30 days");
  const [issueOpen, setIssueOpen] = useState(false);

  const creators = useMemo(() => [...new Set(cards.map(c => c.createdBy))], [cards]);

  const filtered = useMemo(() => cards.filter(c => {
    if (tab !== "All cards" && c.status !== tab) return false;
    if (currency !== "All" && c.currency !== currency) return false;
    if (kind !== "All" && c.kind !== kind) return false;
    if (network !== "All" && c.network !== network) return false;
    if (createdBy !== "All" && c.createdBy !== createdBy) return false;
    if (range !== "All time" && !inRange(c.createdAt, range)) return false;
    const q = search.trim().toLowerCase();
    if (q && ![c.nickname, c.holder, c.id, c.last4].some(v => v.toLowerCase().includes(q))) return false;
    return true;
  }), [cards, tab, currency, kind, network, createdBy, range, search]);

  const periodTxns = useMemo(() => txns.filter(t => (t.type === "Capture" || t.type === "Fee") && inRange(t.date, range)), [txns, range]);
  const balances = totalsByCurrency(cards.filter(c => c.status === "Active" || c.status === "Paused"), c => c.available, c => c.currency);
  const spend = totalsByCurrency(periodTxns, t => t.amount + t.fee, t => t.currency);
  const active = cards.filter(c => c.status === "Active").length;

  const columns: Column<DemoCardFull>[] = [
    { key: "card", header: "CARD", sort: c => c.nickname, cell: c => (
      <span className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent text-primary"><CreditCard className="h-4 w-4" /></span>
        <span><span className="block font-medium">{c.nickname}</span>
        <span className="block text-xs text-muted-foreground">{c.network} · {c.last4 ? `•••• ${c.last4}` : "not issued yet"}</span></span>
      </span>
    ) },
    { key: "holder", header: "CARDHOLDER", sort: c => c.holder, hideBelow: "md", cell: c => c.holder },
    { key: "kind", header: "TYPE", hideBelow: "lg", cell: c => c.kind },
    { key: "currency", header: "CURRENCY", hideBelow: "lg", cell: c => c.currency },
    { key: "status", header: "STATUS", sort: c => c.status, cell: c => <StatusBadge status={c.status} /> },
    { key: "available", header: "AVAILABLE", align: "right", sort: c => c.available, cell: c => formatMoney(c.available, c.currency) },
    { key: "spent", header: "TOTAL SPEND", align: "right", sort: c => c.totalSpent, hideBelow: "md", cell: c => formatMoney(c.totalSpent, c.currency) },
    { key: "source", header: "SOURCE", hideBelow: "lg", cell: c => c.source },
    { key: "created", header: "CREATED", sort: c => c.createdAt, hideBelow: "md", cell: c => <span className="text-muted-foreground">{new Date(c.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span> },
  ];

  return (
    <DashboardPage
      crumbs={[{ label: "Cards" }]}
      title="Cards"
      description="Issue, manage and monitor all your cards."
      notice="Sample card programme — cards, balances and activity are demo records from a mock issuer. Funding stays processing until a real issuer confirms; no real money moves."
      actions={<>
        <ExportButton label="Export" disabled={!filtered.length} onClick={() => { exportCsv("griv-cards", cardExportRows(filtered)); toast.success(`Exported ${filtered.length} cards (sensitive details excluded)`); }} />
        <Button onClick={() => setIssueOpen(true)}><Plus />Issue card</Button>
      </>}
    >
      <MetricGrid>
        <MetricCard label="Total cards issued" value={cards.length} sub={`${cards.filter(c => c.source === "API").length} via API`} />
        <MetricCard label="Active cards" value={active} sub={`${cards.filter(c => c.status === "Paused").length} paused · ${cards.filter(c => c.status === "Terminated").length} terminated`} />
        <MetricCard label="Available card balance" value={Object.keys(balances).length ? Object.entries(balances).map(([cur, amt]) => formatMoneyCompact(amt, cur as Currency)).join(" · ") : "—"} sub="Per currency, never combined" />
        <MetricCard label={`Card spend · ${range.toLowerCase()}`} value={Object.keys(spend).length ? Object.entries(spend).map(([cur, amt]) => formatMoneyCompact(amt, cur as Currency)).join(" · ") : "—"} sub={`${periodTxns.length} captures and fees`} />
      </MetricGrid>

      <div className="mb-6 flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto gap-1.5 p-0 text-sm font-normal text-muted-foreground hover:bg-transparent hover:text-foreground" aria-label={`Show for: ${currency === "All" ? "All currencies" : currency}`}>
              <Globe className="h-4 w-4" />
              Show for:
              <span className="font-medium text-foreground">{currency === "All" ? "All currencies" : currency}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-32">
            <DropdownMenuRadioGroup value={currency} onValueChange={setCurrency}>
              {["All", ...CURRENCIES].map(c => (
                <DropdownMenuRadioItem key={c} value={c}>{c === "All" ? "All currencies" : c}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <section className="rounded-lg border bg-card">
        <StatusTabs<Tab> value={tab} onChange={setTab} tabs={(["All cards", "Active", "Paused", "Pending", "Terminated"] as Tab[]).map(t => ({
          value: t, label: t, count: t === "All cards" ? cards.length : cards.filter(c => c.status === t).length,
        }))} />
        <Toolbar right={<DateRangeSelect value={range} onChange={setRange} />}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search holder, nickname, ID or last 4" />
          <FilterSelect label="Type" value={kind} onChange={setKind} options={["All", "Virtual", "Physical"]} />
          <FilterSelect label="Network" value={network} onChange={setNetwork} options={["All", ...NETWORKS]} />
          <FilterSelect label="Created by" value={createdBy} onChange={setCreatedBy} options={["All", ...creators]} />
        </Toolbar>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={c => c.id}
          loading={loading}
          pageSize={15}
          initialSort={{ key: "created", dir: "desc" }}
          onRowClick={c => navigate({ to: "/cards/$cardId", params: { cardId: c.id } })}
          caption="All cards issued by this business"
          rowActions={c => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted" aria-label={`Actions for ${c.nickname}`}><MoreHorizontal className="h-4 w-4" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild><Link to="/cards/$cardId" params={{ cardId: c.id }}>View card</Link></DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { navigator.clipboard.writeText(c.id); toast.success("Card ID copied"); }}>Copy card ID</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />
      </section>

      <IssueCardDialog open={issueOpen} onOpenChange={setIssueOpen} actor={actor} />
    </DashboardPage>
  );
}

function IssueCardDialog({ open, onOpenChange, actor }: { open: boolean; onOpenChange: (o: boolean) => void; actor: string }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [nickname, setNickname] = useState("");
  const [holder, setHolder] = useState("");
  const [kind, setKind] = useState<CardKind>("Virtual");
  const [network, setNetwork] = useState<CardNetwork>("Visa");
  const [currency, setCurrency] = useState<Currency>("NGN");
  const [fundingModel, setFundingModel] = useState<"Prefunded" | "Linked balance">("Prefunded");
  const [initialFunding, setInitialFunding] = useState("");
  const [perTxn, setPerTxn] = useState("100000");
  const [daily, setDaily] = useState("300000");
  const [monthly, setMonthly] = useState("1000000");
  const [error, setError] = useState("");

  const reset = () => { setStep(1); setNickname(""); setHolder(""); setKind("Virtual"); setNetwork("Visa"); setCurrency("NGN"); setFundingModel("Prefunded"); setInitialFunding(""); setPerTxn("100000"); setDaily("300000"); setMonthly("1000000"); setError(""); };
  const close = (o: boolean) => { onOpenChange(o); if (!o) reset(); };
  const fundingSource = `${currency} business balance`;
  const amount = Number(initialFunding) || 0;

  const submit = () => {
    try {
      const c = issueCard({
        nickname, holder, kind, network, currency, fundingModel, fundingSource, initialFunding: amount, createdBy: actor,
        limits: { perTransaction: Number(perTxn) || 0, daily: Number(daily) || 0, monthly: Number(monthly) || 0 },
      });
      close(false);
      toast.info(`Issuance requested for "${c.nickname}" — it activates when the demo issuer confirms`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't request this card.");
      setStep(1);
    }
  };

  return (
    <FormDialog open={open} onOpenChange={close} title="Issue card" description={step === 1 ? "Demo issuance — the card stays pending until the issuer confirms. No funds move." : "Review before submitting to the demo issuer."}>
      {step === 1 ? (
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (!nickname.trim() || !holder.trim()) { setError("Enter a card nickname and cardholder."); return; } setError(""); setStep(2); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Card nickname" htmlFor="issue-name"><input id="issue-name" className="field" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="e.g. Marketing spend" /></Field>
            <Field label="Cardholder" htmlFor="issue-holder"><input id="issue-holder" className="field" value={holder} onChange={e => setHolder(e.target.value)} placeholder="Person or team" /></Field>
            <Field label="Card type"><select aria-label="Card type" className="field" value={kind} onChange={e => setKind(e.target.value as CardKind)}><option>Virtual</option><option>Physical</option></select></Field>
            <Field label="Network"><select aria-label="Network" className="field" value={network} onChange={e => setNetwork(e.target.value as CardNetwork)}>{NETWORKS.map(n => <option key={n}>{n}</option>)}</select></Field>
            <Field label="Currency"><select aria-label="Currency" className="field" value={currency} onChange={e => setCurrency(e.target.value as Currency)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Funding model"><select aria-label="Funding model" className="field" value={fundingModel} onChange={e => setFundingModel(e.target.value as "Prefunded" | "Linked balance")}><option>Prefunded</option><option>Linked balance</option></select></Field>
          </div>
          {fundingModel === "Prefunded" && (
            <Field label={`Initial funding (${currency})`} htmlFor="issue-funding" optional hint="Starts as a separate processing funding transaction — not part of issuance.">
              <input id="issue-funding" className="field" inputMode="decimal" value={initialFunding} onChange={e => setInitialFunding(e.target.value)} placeholder="0" />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Per-transaction limit" htmlFor="issue-pt"><input id="issue-pt" className="field" inputMode="numeric" value={perTxn} onChange={e => setPerTxn(e.target.value)} /></Field>
            <Field label="Daily limit" htmlFor="issue-dl"><input id="issue-dl" className="field" inputMode="numeric" value={daily} onChange={e => setDaily(e.target.value)} /></Field>
            <Field label="Monthly limit" htmlFor="issue-ml"><input id="issue-ml" className="field" inputMode="numeric" value={monthly} onChange={e => setMonthly(e.target.value)} /></Field>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button><Button type="submit">Review</Button></div>
        </form>
      ) : (
        <div className="space-y-4">
          <dl className="divide-y rounded-lg border text-sm">
            {([
              ["Nickname", nickname], ["Cardholder", holder], ["Type", `${kind} · ${network}`], ["Currency", currency],
              ["Funding model", fundingModel], ["Funding source", fundingSource],
              ["Initial funding", amount > 0 ? formatMoney(amount, currency) : "None"],
              ["Limits", `${formatMoney(Number(perTxn) || 0, currency)} / txn · ${formatMoney(Number(daily) || 0, currency)} / day · ${formatMoney(Number(monthly) || 0, currency)} / month`],
              ["Requested by", `${actor} · Dashboard`],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 px-4 py-2.5"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
            ))}
          </dl>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button><Button onClick={submit}>Submit issuance request</Button></div>
        </div>
      )}
    </FormDialog>
  );
}
