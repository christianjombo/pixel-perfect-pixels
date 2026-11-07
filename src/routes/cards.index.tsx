import { createFileRoute } from "@tanstack/react-router";
import { CardsPage } from "@/components/griv/pages/cards/CardsPage";
export const Route = createFileRoute("/cards/")({
  component: CardsPage,
});
