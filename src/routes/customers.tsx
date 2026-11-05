import { createFileRoute } from "@tanstack/react-router";
import { ContactsPage } from "@/components/griv/pages/customers/ContactsPage";
export const Route = createFileRoute("/customers")({
  head: () => ({ meta: [
    { title: "Customers — Griv Finance" },
    { name: "description", content: "Manage customer contacts and billing details." },
    { property: "og:title", content: "Customers — Griv Finance" },
    { property: "og:description", content: "Manage customer contacts and billing details." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ContactsPage,
});
