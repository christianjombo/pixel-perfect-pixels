import { createFileRoute } from "@tanstack/react-router";
import { CreditPage } from "@/components/griv/pages/credit/CreditPage";
export const Route = createFileRoute("/credit")({
  head: () => ({ meta: [
    { title: "Credit — Griv Finance" },
    { name: "description", content: "Review business credit requests and applications." },
    { property: "og:title", content: "Credit — Griv Finance" },
    { property: "og:description", content: "Review business credit requests and applications." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CreditPage,
});
