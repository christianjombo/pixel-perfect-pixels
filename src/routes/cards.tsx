import { createFileRoute } from "@tanstack/react-router";
import { CardsPage } from "@/components/griv/pages/cards/CardsPage";
export const Route = createFileRoute("/cards")({
  head: () => ({ meta: [
    { title: "Cards — Griv Finance" },
    { name: "description", content: "Manage business cards and spending controls." },
    { property: "og:title", content: "Cards — Griv Finance" },
    { property: "og:description", content: "Manage business cards and spending controls." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CardsPage,
});
