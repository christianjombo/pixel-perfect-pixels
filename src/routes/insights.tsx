import { createFileRoute } from "@tanstack/react-router";
import { InsightsPage } from "@/components/griv/pages/insights/InsightsPage";
export const Route = createFileRoute("/insights")({
  head: () => ({ meta: [
    { title: "Insights — Griv Finance" },
    { name: "description", content: "Explore collections, customers and payment channel performance." },
    { property: "og:title", content: "Insights — Griv Finance" },
    { property: "og:description", content: "Explore collections, customers and payment channel performance." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: InsightsPage,
});
