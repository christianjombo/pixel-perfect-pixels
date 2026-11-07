import { createFileRoute } from "@tanstack/react-router";
import { CardDetailPage } from "@/components/griv/pages/cards/CardDetailPage";
export const Route = createFileRoute("/cards/$cardId")({
  component: CardDetailPage,
});
