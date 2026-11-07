import { createFileRoute, Outlet } from "@tanstack/react-router";
export const Route = createFileRoute("/cards")({
  head: () => ({ meta: [
    { title: "Cards — Griv Finance" },
    { name: "description", content: "Issue, manage and monitor business cards with Griv." },
    { property: "og:title", content: "Cards — Griv Finance" },
    { property: "og:description", content: "Issue, manage and monitor business cards in your Griv workspace." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  // Parent shell only; the list is the index route and each card gets its own child page.
  component: () => <Outlet />,
});
