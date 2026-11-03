import { useId, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type DemoConfig, configErrors, defaultConfig, eligibilityContext, switchCountry } from "@/lib/checkout/demo-config";
import { currencyName } from "@/lib/checkout/money";
import {
  CHANNEL_INFO, CHANNEL_ORDER, COUNTRIES, DEVICES, type ChannelId, type CountryCode, channelEligibility, configurableChannels, getCountry, getEntry,
} from "@/lib/checkout/registry";
import { SCENARIOS, type Scenario } from "@/lib/checkout/useCheckoutEngine";
import { CHANNEL_ICON, AvailabilityBadge, MerchantIdentity } from "./checkout/parts";

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-b px-5 py-5 last:border-b-0">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{title}</h2>{aside}</div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function F({ label, children, error, hint, optional }: { label: string; children: (id: string) => ReactNode; error?: string | undefined; hint?: string; optional?: boolean }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-center justify-between text-xs font-medium">{label}{optional && <span className="font-normal text-muted-foreground">Optional</span>}</label>
      {children(id)}
      {error ? <p className="mt-1 text-xs font-medium text-destructive" role="alert">{error}</p> : hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
const input = "field h-9 text-sm";

export function CheckoutConfiguration({ cfg, onChange }: { cfg: DemoConfig; onChange: (c: DemoConfig) => void }) {
  const set = <K extends keyof DemoConfig>(k: K, v: DemoConfig[K]) => onChange({ ...cfg, [k]: v });
  const { errors, amountMinor } = configErrors(cfg);
  const country = getCountry(cfg.country);
  const ctx = eligibilityContext(cfg, amountMinor);
  const configurable = configurableChannels(cfg.country);
  const toggle = (c: ChannelId, on: boolean) => set("enabled", on ? [...cfg.enabled, c] : cfg.enabled.filter((x) => x !== c));

  return (
    <TooltipProvider delayDuration={150}>
      <div className="panel overflow-hidden">
        <Section title="Merchant">
          <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2"><MerchantIdentity name={cfg.merchantName} size="sm" /><span className="text-xs text-muted-foreground">Logo preview</span></div>
          <F label="Display name" error={errors.merchantName}>{(id) => <input id={id} className={input} value={cfg.merchantName} onChange={(e) => set("merchantName", e.target.value)} />}</F>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Support email" error={errors.merchantEmail}>{(id) => <input id={id} type="email" className={input} value={cfg.merchantEmail} onChange={(e) => set("merchantEmail", e.target.value)} />}</F>
            <F label="Merchant reference">{(id) => <input id={id} className={input} value={cfg.merchantRef} onChange={(e) => set("merchantRef", e.target.value)} />}</F>
          </div>
          <F label="Country" hint="Changes currency, phone format and which methods can be offered.">
            {(id) => (
              <select id={id} className={input} value={cfg.country} onChange={(e) => onChange(switchCountry(cfg, e.target.value as CountryCode))}>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name} — {c.currency}</option>)}
              </select>
            )}
          </F>
        </Section>

        <Section title="Payment">
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
            <F label="Amount" error={errors.amount}>{(id) => <input id={id} className={`${input} tnum`} inputMode="decimal" value={cfg.amount} onChange={(e) => set("amount", e.target.value)} />}</F>
            <F label="Currency">
              {(id) => (
                <select id={id} className={input} value={cfg.currency} onChange={(e) => set("currency", e.target.value as DemoConfig["currency"])} title={currencyName(cfg.currency)}>
                  {country.currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </F>
          </div>
          <F label="Description">{(id) => <input id={id} className={input} value={cfg.description} onChange={(e) => set("description", e.target.value)} />}</F>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Customer name">{(id) => <input id={id} className={input} value={cfg.customerName} onChange={(e) => set("customerName", e.target.value)} />}</F>
            <F label="Customer email" error={errors.customerEmail}>{(id) => <input id={id} type="email" className={input} value={cfg.customerEmail} onChange={(e) => set("customerEmail", e.target.value)} />}</F>
          </div>
          <F label={`Customer phone (${country.dialCode})`} optional hint={`Pre-fills phone-based methods. Example: ${country.phone.example}`}>
            {(id) => <input id={id} type="tel" className={input} value={cfg.customerPhone} placeholder={country.phone.example} onChange={(e) => set("customerPhone", e.target.value)} />}
          </F>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Transaction reference" optional hint="Leave empty to generate one.">{(id) => <input id={id} className={input} value={cfg.txnRef} onChange={(e) => set("txnRef", e.target.value)} />}</F>
            <F label="Order reference" optional>{(id) => <input id={id} className={input} value={cfg.orderRef} onChange={(e) => set("orderRef", e.target.value)} />}</F>
          </div>
        </Section>

        <Section title="Payment methods" aside={<span className="text-xs text-muted-foreground">{country.flag} {country.name}</span>}>
          <div className="flex flex-wrap gap-1.5">
            <button className="btn btn-outline h-7 px-2.5 text-xs" onClick={() => set("enabled", configurable)}>Enable all available</button>
            <button className="btn btn-outline h-7 px-2.5 text-xs" onClick={() => set("enabled", [])}>Disable all</button>
            <button className="btn btn-outline h-7 px-2.5 text-xs" onClick={() => set("enabled", defaultConfig(cfg.country).enabled)}>Restore defaults</button>
          </div>
          {errors.channels && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive" role="alert">{errors.channels}</p>}
          <ul className="divide-y rounded-lg border">
            {CHANNEL_ORDER.map((c) => {
              const entry = getEntry(cfg.country, c);
              const Icon = CHANNEL_ICON[c];
              const off = entry.status === "unavailable";
              const on = cfg.enabled.includes(c);
              const elig = channelEligibility(c, ctx);
              const row = (
                <li key={c} className={`flex items-center gap-2.5 px-3 py-2 ${off ? "opacity-50" : ""}`}>
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium">{CHANNEL_INFO[c].label}<AvailabilityBadge status={entry.status} /></span>
                    {on && !elig.eligible && <span className="block text-[11px] text-warning-foreground">Hidden from customer: {elig.reason}</span>}
                  </span>
                  {off && <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
                  <Switch checked={on && !off} disabled={off} onCheckedChange={(v) => toggle(c, v)} aria-label={`${CHANNEL_INFO[c].label} ${on ? "on" : "off"}`} />
                </li>
              );
              return off ? (
                <Tooltip key={c}><TooltipTrigger asChild>{row}</TooltipTrigger><TooltipContent side="left">{elig.reason}</TooltipContent></Tooltip>
              ) : row;
            })}
          </ul>
          <p className="text-[11px] text-muted-foreground">Demo registry based on public provider docs. It isn't a list of what Griv supports in production. "Unverified" methods are shown for preview only.</p>
        </Section>

        <Section title="Simulation" aside={<span className="text-[11px] text-muted-foreground">Demo payments only</span>}>
          <F label="Outcome">
            {(id) => (
              <select id={id} className={input} value={cfg.scenario} onChange={(e) => set("scenario", e.target.value as Scenario)}>
                {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            )}
          </F>
          <div>
            <p className="mb-2 flex justify-between text-xs font-medium"><span>Processing delay</span><span className="tnum text-muted-foreground">{cfg.delaySec.toFixed(1)}s</span></p>
            <Slider min={0.5} max={8} step={0.5} value={[cfg.delaySec]} onValueChange={(v) => set("delaySec", v[0] ?? 2)} aria-label="Processing delay in seconds" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Payment window" hint="Transfer, USSD and QR countdown.">
              {(id) => (
                <select id={id} className={input} value={cfg.windowMinutes} onChange={(e) => set("windowMinutes", Number(e.target.value))}>
                  {[1, 5, 10, 30].map((m) => <option key={m} value={m}>{m} minute{m > 1 ? "s" : ""}</option>)}
                </select>
              )}
            </F>
            <F label="Customer device" hint="Decides wallet eligibility.">
              {(id) => (
                <select id={id} className={input} value={cfg.device} onChange={(e) => set("device", e.target.value as DemoConfig["device"])}>
                  {DEVICES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              )}
            </F>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Card saved in customer's wallet</span>
            <Switch checked={cfg.walletReady} onCheckedChange={(v) => set("walletReady", v)} aria-label="Card saved in customer's wallet" />
          </label>
        </Section>
      </div>
    </TooltipProvider>
  );
}
