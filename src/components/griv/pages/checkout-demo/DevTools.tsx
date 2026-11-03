import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canTransition, inspectSession, webhookPayload } from "@/lib/checkout/machine";
import { CHANNEL_INFO } from "@/lib/checkout/registry";
import type { CheckoutEngine } from "@/lib/checkout/useCheckoutEngine";

function Json({ value, label }: { value: unknown; label: string }) {
  const [done, setDone] = useState(false);
  const text = JSON.stringify(value, null, 2);
  return (
    <div className="relative">
      <button className="btn btn-outline absolute right-2 top-2 h-7 px-2.5 text-xs" onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); } catch { /* clipboard blocked */ }
      }} aria-label={`Copy ${label}`}>{done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}Copy JSON</button>
      <pre className="max-h-96 overflow-auto rounded-lg bg-blackwood p-4 pr-28 font-mono text-[11px] leading-relaxed text-blackwood-foreground">{text}</pre>
    </div>
  );
}

export function DevTools({ engine }: { engine: CheckoutEngine }) {
  const s = engine.session;
  if (!s) return null;
  const att = engine.attempt;
  const hook = webhookPayload(s);
  const st = s.status;
  const controls = [
    { label: "Simulate success", ok: !!att && canTransition(st, "SUCCEEDED") || (!!att && st === "PROCESSING"), run: () => engine.callback("succeeded") },
    { label: "Simulate failure", ok: !!att && canTransition(st, "FAILED"), run: () => engine.callback("failed", { reason: "Failed from developer tools (simulated)." }) },
    { label: "Simulate pending", ok: !!att && st !== "PENDING" && canTransition(st, "PENDING"), run: () => engine.callback("pending") },
    { label: "Simulate expiry", ok: canTransition(st, "EXPIRED"), run: () => engine.expire() },
    { label: "Simulate cancellation", ok: canTransition(st, "CANCELLED"), run: () => engine.cancel("Cancelled from developer tools (simulated).") },
    { label: "Simulate duplicate callback", ok: engine.hasCallback, run: () => engine.duplicateCallback() },
  ];
  const visible = controls.filter((c) => c.ok);

  return (
    <div className="panel mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <h2 className="text-sm font-semibold">Developer tools</h2>
        <span className="font-mono text-xs text-muted-foreground">{s.id} · <span className="font-semibold text-foreground">{st}</span></span>
      </div>
      <Tabs defaultValue="timeline" className="p-5">
        <TabsList className="flex-wrap">
          <TabsTrigger value="timeline">Event timeline</TabsTrigger>
          <TabsTrigger value="simulate">Simulation controls</TabsTrigger>
          <TabsTrigger value="session">Session inspector</TabsTrigger>
          <TabsTrigger value="webhook">Webhook</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline" className="mt-4">
          <div className="max-h-80 overflow-auto rounded-lg border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-muted text-muted-foreground">
                <tr><th className="px-3 py-2 font-medium">Time</th><th className="px-3 py-2 font-medium">Event</th><th className="px-3 py-2 font-medium">Channel</th><th className="px-3 py-2 font-medium">Attempt</th><th className="px-3 py-2 font-medium">Result</th></tr>
              </thead>
              <tbody className="divide-y">
                {[...s.events].reverse().map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap px-3 py-2 tnum text-muted-foreground">{new Date(e.at).toLocaleTimeString("en-GB")}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono font-medium">{e.name}</td>
                    <td className="whitespace-nowrap px-3 py-2">{e.channel ? CHANNEL_INFO[e.channel].label : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono">{e.attemptRef ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{e.result ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Griv demo event names — not any payment provider's webhook schema.</p>
        </TabsContent>
        <TabsContent value="simulate" className="mt-4">
          {visible.length ? (
            <div className="flex flex-wrap gap-2">{visible.map((c) => <button key={c.label} className="btn btn-outline h-9 text-sm" onClick={c.run}>{c.label}</button>)}</div>
          ) : <p className="text-sm text-muted-foreground">Nothing to simulate in the {st.toLowerCase().replace(/_/g, " ")} state. Start a payment in the checkout, or restart it.</p>}
          <button className="btn btn-ghost mt-3 h-8 text-xs" onClick={() => void engine.restart()}>Restart checkout</button>
        </TabsContent>
        <TabsContent value="session" className="mt-4"><Json value={inspectSession(s)} label="session" /></TabsContent>
        <TabsContent value="webhook" className="mt-4">
          {hook ? <Json value={hook} label="webhook payload" /> : <p className="text-sm text-muted-foreground">No payment event yet. Start a payment to see a sample webhook.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
