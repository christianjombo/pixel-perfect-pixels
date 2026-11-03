import { createFileRoute } from "@tanstack/react-router";
import { CheckoutDemoPage } from "@/components/griv/pages/checkout-demo/CheckoutDemoPage";

export const Route = createFileRoute("/checkout-demo")({
  head: () => ({
    meta: [
      { title: "Checkout Demo — Griv Finance" },
      { name: "description", content: "Try Griv Checkout with simulated cards, transfers, USSD, QR, mobile money, M-PESA, EFT and wallets across five African markets." },
      { property: "og:title", content: "Checkout Demo — Griv Finance" },
      { property: "og:description", content: "Try Griv Checkout with simulated payment methods across Nigeria, Ghana, Kenya, Côte d'Ivoire and South Africa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckoutDemoPage,
});
