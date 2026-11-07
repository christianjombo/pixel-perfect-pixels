import { createFileRoute } from "@tanstack/react-router";
import { InsightsPage } from "@/components/griv/pages/insights/InsightsPage";
import { CURRENCIES } from "@/lib/money";
import { INSIGHT_TABS, PERIODS, periodWindow } from "@/lib/demo/insights";
export const Route = createFileRoute("/insights")({
  validateSearch: (search: Record<string, unknown>) => {
    const defaults = periodWindow("Last 30 days");
    return {
      tab: INSIGHT_TABS.find(t => t === search.tab) ?? "Overview",
      period: PERIODS.find(p => p === search.period) ?? "Last 30 days",
      currency: CURRENCIES.find(c => c === search.currency) ?? "NGN",
      compare: search.compare !== false && search.compare !== "false",
      from: typeof search.from === "string" ? search.from : defaults.from,
      to: typeof search.to === "string" ? search.to : defaults.to,
      country: typeof search.country === "string" ? search.country : "All",
      account: typeof search.account === "string" ? search.account : "All",
      product: typeof search.product === "string" ? search.product : "All",
    };
  },
  head: () => ({ meta: [
    { title: "Insights — Griv Finance" },
    { name: "description", content: "Analyze payments, customers, commerce, transfers and settlements with currency-safe comparisons and business highlights." },
    { property: "og:title", content: "Insights — Griv Finance" },
    { property: "og:description", content: "Understand business performance across payments, customers, commerce, transfers and settlements." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: InsightsPage,
});
