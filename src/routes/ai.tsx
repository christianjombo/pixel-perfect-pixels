import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AIPage } from "@/components/griv/pages/ai/AIPage";
export const Route = createFileRoute("/ai")({
  head: () => ({ meta: [
    { title: "Griv AI — Griv Finance" },
    { name: "description", content: "Your intelligent business copilot for grounded analysis, financial investigations and saved conversations." },
    { property: "og:title", content: "Griv AI — Griv Finance" },
    { property: "og:description", content: "Analyze your business, investigate transactions and prepare actions with Griv AI." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <Outlet />,
});
