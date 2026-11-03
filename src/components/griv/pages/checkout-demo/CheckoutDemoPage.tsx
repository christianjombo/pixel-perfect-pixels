import { useEffect, useMemo, useState } from "react";
import { Expand, Lock, Maximize2, Monitor, RotateCcw, Smartphone } from "lucide-react";
import { DashboardPage } from "@/components/griv/DashboardPage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { configErrors, defaultConfig, eligibilityContext, toSessionInput, type DemoConfig } from "@/lib/checkout/demo-config";
import { useCheckoutEngine } from "@/lib/checkout/useCheckoutEngine";
import { cn } from "@/lib/utils";
import { CheckoutConfiguration } from "./CheckoutConfiguration";
import { DevTools } from "./DevTools";
import { GrivCheckout } from "./checkout/GrivCheckout";

export function CheckoutDemoPage() {
  const [cfg, setCfg] = useState<DemoConfig>(() => defaultConfig());
  const [nonce, setNonce] = useState(0);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [modal, setModal] = useState(false);
  const [full, setFull] = useState(false);
  const { valid, amountMinor } = configErrors(cfg);
  const input = useMemo(() => toSessionInput(cfg, amountMinor), [cfg, amountMinor]);
  const engine = useCheckoutEngine(input, { scenario: cfg.scenario, delayMs: cfg.delaySec * 1000, sessionMinutes: 30, windowMinutes: cfg.windowMinutes });
  const ctx = eligibilityContext(cfg, amountMinor);

  // Anything that changes what the customer is paying, or which methods they see, starts a fresh session.
  const key = JSON.stringify([input, cfg.device, cfg.walletReady, nonce]);
  useEffect(() => {
    if (!valid) return;
    const t = setTimeout(() => void engine.restart(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, valid]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  const reset = () => { setCfg(defaultConfig()); setNonce((n) => n + 1); setDevice("desktop"); };
  const checkout = (mode: "embedded" | "modal" | "hosted", onClose?: () => void, className?: string) =>
    valid
      ? <GrivCheckout engine={engine} ctx={ctx} merchantEmail={cfg.merchantEmail} mode={mode} onClose={onClose} className={className} />
      : <div className="grid min-h-80 place-items-center bg-card p-6 text-center text-sm text-muted-foreground">Fix the highlighted settings to preview the checkout.</div>;

  return (
    <DashboardPage
      crumbs={[{ label: "Payments" }, { label: "Checkout Demo" }]}
      title="Checkout Demo"
      description="Explore and test how customers complete payments with Griv across different payment methods and markets."
      notice="Simulation only: no real payments, no real credentials and no calls to any payment provider. Never enter real card or bank details."
      actions={<>
        <button className="btn btn-outline h-9 text-sm" onClick={reset}><RotateCcw className="h-4 w-4" />Reset demo</button>
        <button className="btn btn-outline h-9 text-sm" onClick={() => setModal(true)} disabled={!valid}><Expand className="h-4 w-4" />Preview checkout</button>
        <button className="btn btn-primary h-9 text-sm" onClick={() => setFull(true)} disabled={!valid}><Maximize2 className="h-4 w-4" />Fullscreen preview</button>
      </>}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="min-w-0"><CheckoutConfiguration cfg={cfg} onChange={setCfg} /></div>
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-lg bg-muted p-1" role="radiogroup" aria-label="Preview size">
              {([["desktop", Monitor, "Desktop"], ["mobile", Smartphone, "Mobile"]] as const).map(([id, Icon, label]) => (
                <button key={id} role="radio" aria-checked={device === id} onClick={() => setDevice(id)}
                  className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium", device === id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button className="btn btn-outline h-8 px-3 text-xs" onClick={() => setFull(true)} disabled={!valid}><Maximize2 className="h-3.5 w-3.5" />Open in fullscreen</button>
              <button className="btn btn-outline h-8 px-3 text-xs" onClick={() => void engine.restart()} disabled={!valid}><RotateCcw className="h-3.5 w-3.5" />Restart checkout</button>
            </div>
          </div>

          <div className="rounded-2xl border bg-muted/60 p-3 sm:p-5">
            {device === "desktop" ? (
              <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="flex items-center gap-2 border-b bg-muted/70 px-3 py-2">
                  <span className="flex gap-1" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-border" />)}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
                    <Lock className="h-3 w-3 shrink-0" /><span className="truncate">checkout.griv.example/c/{engine.session?.id ?? "…"}</span>
                  </span>
                </div>
                {checkout("embedded", undefined, "min-h-[560px]")}
              </div>
            ) : (
              <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[2rem] border-[6px] border-blackwood bg-card shadow-sm">
                <div className="h-[720px] overflow-y-auto overscroll-contain">{checkout("embedded", undefined, "min-h-full")}</div>
              </div>
            )}
          </div>

          <DevTools engine={engine} />
        </div>
      </div>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0 [&>button]:hidden">
          <DialogTitle className="sr-only">Griv Checkout preview</DialogTitle>
          {checkout("modal", () => setModal(false))}
        </DialogContent>
      </Dialog>

      {full && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background" role="dialog" aria-modal="true" aria-label="Fullscreen checkout preview">
          {checkout("hosted", () => setFull(false), "min-h-full")}
        </div>
      )}
    </DashboardPage>
  );
}
