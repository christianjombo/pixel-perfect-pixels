import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, Wallet, ArrowLeftRight, CreditCard,
  LineChart, Sparkles, Bot, Settings, Code2, ChevronDown, Bell, HelpCircle,
  PanelLeftClose, PanelLeftOpen, LayoutTemplate, Menu, X, Banknote, ShoppingCart, BarChart3, Trash2,
} from "lucide-react";
import { Logo, LogoMark } from "./Logo";
import { hydrateSimStores } from "@/lib/sim/store";

type NavTo =
  | "/dashboard" | "/balances" | "/balances-old" | "/transactions" | "/transfers" | "/payouts"
  | "/payment-links" | "/invoices" | "/virtual-accounts" | "/payments"
  | "/online-store" | "/orders" | "/products" | "/inventory" | "/pos" | "/merchant-groups" | "/settings" | "/checkout-demo"
  | "/cards" | "/customers" | "/suppliers" | "/ai" | "/credit" | "/insights";
type Item = { label: string; icon: typeof Wallet; to?: NavTo; settings?: string };
type Accordion = { label: string; icon: typeof Wallet; children: { label: string; to?: NavTo }[] };
const NAV: { group?: string; items?: Item[]; accordions?: Accordion[] }[] = [
  { items: [{ label: "Home", icon: LayoutDashboard, to: "/dashboard" }, { label: "Balances", icon: Wallet, to: "/balances" }, { label: "Cards", icon: CreditCard, to: "/cards" }, { label: "Transactions", icon: ArrowLeftRight, to: "/transactions" }] },
  { group: "Products", accordions: [
    { label: "Payments", icon: Banknote, children: [{ label: "Payment Links", to: "/payment-links" }, { label: "Invoices", to: "/invoices" }, { label: "Virtual Accounts", to: "/virtual-accounts" }, { label: "Transfer", to: "/transfers" }, { label: "Checkout Demo", to: "/checkout-demo" }] },
    { label: "Reporting", icon: BarChart3, children: [{ label: "Reports" }] },
    { label: "Marketplace", icon: ShoppingCart, children: [
      { label: "Online Store", to: "/online-store" }, { label: "Orders", to: "/orders" }, { label: "Products", to: "/products" },
      { label: "Inventory", to: "/inventory" }, { label: "POS", to: "/pos" }, { label: "Customers", to: "/customers" }, { label: "Suppliers", to: "/suppliers" },
    ] },
  ] },
  { group: "Grow", items: [{ label: "Insights", icon: LineChart, to: "/insights" }, { label: "Credit", icon: Sparkles, to: "/credit" }, { label: "AI", icon: Bot, to: "/ai" }] },
  { group: "Settings", items: [{ label: "Settings", icon: Settings, to: "/settings" }, { label: "Developers", icon: Code2, settings: "api-keys" }] },
  { group: "Previews", items: [{ label: "Merchant Groups", icon: LayoutTemplate, to: "/merchant-groups" }] },
  { group: "Trashed", items: [{ label: "Balances (old)", icon: Trash2, to: "/balances-old" }] },
];

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const s of NAV) for (const a of s.accordions ?? []) initial[a.label] = a.children.some((c) => c.to && pathname.startsWith(c.to));
    return initial;
  });
  // Keep a section expanded when the user lands on one of its pages.
  useEffect(() => {
    for (const s of NAV) for (const a of s.accordions ?? []) {
      if (a.children.some((c) => c.to && pathname.startsWith(c.to))) setOpen((p) => (p[a.label] ? p : { ...p, [a.label]: true }));
    }
  }, [pathname]);
  const toggle = (label: string) => setOpen((p) => ({ ...p, [label]: !p[label] }));

  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main menu">
      {NAV.map((s, i) => (
        <div key={s.group ?? `nolabel-${i}`} className="mt-4 first:mt-1">
          {!collapsed && s.group && <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">{s.group}</p>}
          {(s.accordions ?? []).map((a) => {
            const isOpen = !!open[a.label];
            const childActive = a.children.some((c) => c.to && pathname.startsWith(c.to));
            if (collapsed) {
              return (
                <button key={a.label} title={a.label} className="flex w-full items-center justify-center rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                  <a.icon className="h-4 w-4 shrink-0" />
                </button>
              );
            }
            return (
              <div key={a.label}>
                <button
                  onClick={() => toggle(a.label)}
                  aria-expanded={isOpen}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${childActive ? "font-semibold text-sidebar-accent-foreground [&>svg:first-child]:text-sidebar-primary" : ""}`}
                >
                  <a.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{a.label}</span>
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="mt-0.5 mb-1 ml-3 space-y-0.5 border-l border-sidebar-border pl-2">
                    {a.children.map((c) =>
                      c.to ? (
                      <Link
                        key={c.label}
                        to={c.to}
                        title={c.label}
                        onClick={onNavigate}
                        className="block rounded-md py-1.5 pl-5 pr-3 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeProps={{ className: "bg-sidebar-accent !text-sidebar-accent-foreground font-semibold" }}
                      >
                        {c.label}
                      </Link>
                      ) : (
                      <button
                        key={c.label}
                        title={`${c.label} — coming soon in this demo`}
                        onClick={onNavigate}
                        className="block w-full rounded-md py-1.5 pl-5 pr-3 text-left text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      >
                        {c.label}
                      </button>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {(s.items ?? []).map(({ label, icon: Icon, to, settings }) => {
            const cls = `flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${collapsed ? "justify-center" : ""}`;
            const active = { className: "bg-sidebar-accent !text-sidebar-accent-foreground font-semibold [&>svg]:text-sidebar-primary" };
            if (settings) return (
              <Link key={label} to="/settings/$slug" params={{ slug: settings }} title={label} onClick={onNavigate} className={cls} activeProps={active}>
                <Icon className="h-4 w-4 shrink-0" />{!collapsed && label}
              </Link>
            );
            return to ? (
              <Link key={label} to={to} title={label} onClick={onNavigate} className={cls} activeOptions={{ exact: to === "/settings" }} activeProps={active}>
                <Icon className="h-4 w-4 shrink-0" />{!collapsed && label}
              </Link>
            ) : (
              <button key={label} title={`${label} — coming soon in this demo`} className={`${cls} opacity-60`}>
                <Icon className="h-4 w-4 shrink-0" />{!collapsed && label}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ business, initials, live, onLiveChange, children }: {
  business: string; initials: string; live: boolean; onLiveChange: (v: boolean) => void; children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  // Apply persisted demo-data mutations after hydration (SSR renders the base dataset).
  useEffect(() => hydrateSimStores(), []);
  const switcher = (
    <button className="flex min-w-0 max-w-[16rem] items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left hover:bg-muted" aria-label="Switch business">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">{business.slice(0, 1)}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{business}</span>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
  return (
    <div className="flex min-h-screen bg-background">
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex ${collapsed ? "w-[72px]" : "w-64"}`}>
        <div className="flex h-16 items-center justify-between px-4">
          {collapsed ? <LogoMark className="mx-auto h-7 w-7" /> : <Logo variant="light" className="h-6" />}
        </div>
        <NavList collapsed={collapsed} />
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-2 border-t border-sidebar-border px-5 py-3 text-xs text-sidebar-foreground/60 hover:text-sidebar-accent-foreground">
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" />Collapse</>}
        </button>
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-blackwood/60" aria-label="Close menu" onClick={() => setDrawer(false)} />
          <aside className="relative flex h-full w-72 flex-col bg-sidebar text-sidebar-foreground">
            <div className="flex h-16 items-center justify-between px-4">
              <Logo variant="light" className="h-6" />
              <button onClick={() => setDrawer(false)} className="text-sidebar-foreground/70 hover:text-sidebar-accent-foreground" aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>
            <NavList collapsed={false} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {!live && <div className="bg-highlight py-1 text-center text-xs font-semibold uppercase tracking-[0.14em] text-highlight-foreground">Test mode — no real money moves</div>}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:gap-4 sm:px-6">
          <button onClick={() => setDrawer(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          {switcher}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-lg border p-0.5 text-xs font-semibold">
              {(["Test", "Live"] as const).map((m) => (
                <button key={m} onClick={() => onLiveChange(m === "Live")} className={`rounded-md px-3 py-1.5 ${(m === "Live") === live ? (live ? "bg-blackwood text-blackwood-foreground" : "bg-highlight text-highlight-foreground") : "text-muted-foreground"}`}>{m}</button>
              ))}
            </div>
            <button className="hidden h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground sm:grid" aria-label="Help"><HelpCircle className="h-4.5 w-4.5" /></button>
            <button className="relative grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Notifications">
              <Bell className="h-4.5 w-4.5" /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
            </button>
            <span className="ml-1 grid h-9 w-9 place-items-center rounded-full bg-blackwood text-xs font-semibold text-blackwood-foreground">{initials}</span>
          </div>
        </header>
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
