import { createFileRoute } from "@tanstack/react-router";
import { ContactsPage } from "@/components/griv/pages/customers/ContactsPage";
export const Route = createFileRoute("/suppliers")({
  head: () => ({ meta: [
    { title: "Suppliers — Griv Finance" },
    { name: "description", content: "Manage supplier contacts and purchasing relationships." },
    { property: "og:title", content: "Suppliers — Griv Finance" },
    { property: "og:description", content: "Manage supplier contacts and purchasing relationships." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <ContactsPage suppliers />,
});
