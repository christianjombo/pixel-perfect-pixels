import { createFileRoute } from "@tanstack/react-router";
import { AIPage } from "@/components/griv/pages/ai/AIPage";
export const Route = createFileRoute("/ai")({
  head: () => ({ meta: [
    { title: "Griv AI — Griv Finance" },
    { name: "description", content: "Ask business questions using the Griv local demo assistant." },
    { property: "og:title", content: "Griv AI — Griv Finance" },
    { property: "og:description", content: "Ask business questions using the Griv local demo assistant." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AIPage,
});
